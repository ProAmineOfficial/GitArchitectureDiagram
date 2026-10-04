// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Full-repository project extract | Author: Amine Saoud ibn al-Bashir.
// One GitHub API request returns a redirect to the commit's archive on codeload.github.com. The archive is streamed,
// decompressed, and parsed file by file under hard limits; nothing is written to disk or kept after the response.
// Security decisions: only api.github.com and codeload.github.com are contacted; the visitor's token goes to
// api.github.com only; the archive URL is never logged or returned.
import { AppError, VERSION, rateLimitInfo, rateLimitMessage } from './github.mjs';
import { compileFilter, isCredentialPath, isBinaryPath, statistics, DEFAULT_EXCLUDE, SIZE_CHOICES } from '../public/extract-core.js';

export const EXTRACT_LIMITS = {
  node: { compressedBytes: 120e6, scannedBytes: 800e6, contentBytes: 20e6, entries: 200000 },
  worker: { compressedBytes: 30e6, scannedBytes: 200e6, contentBytes: 6e6, entries: 60000 },
};
const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

/** Validate the request before any network access. */
export function validateExtractInput(input) {
  if (!input || typeof input !== 'object') throw new AppError(400, 'An extract request is required.');
  const [owner, repo, ...rest] = String(input.repository || '').split('/');
  if (rest.length || !SEGMENT.test(owner || '') || !SEGMENT.test(repo || '')) throw new AppError(400, 'Give the repository as owner/name.');
  if (!/^[0-9a-f]{40}$/i.test(String(input.commit || ''))) throw new AppError(400, 'A full 40-character commit SHA is required, so the extract matches the analysis.');
  const scope = String(input.scope || '').replace(/^\/+|\/+$/g, ''); if (scope.length > 1000 || scope.split('/').some(part => part === '..')) throw new AppError(400, 'Invalid folder.');
  const list = value => (Array.isArray(value) ? value : []).filter(item => typeof item === 'string' && item.length <= 200).slice(0, 40);
  const maxFileSize = SIZE_CHOICES.includes(Number(input.maxFileSize)) ? Number(input.maxFileSize) : 50000;
  return { owner, repo, commit: input.commit.toLowerCase(), scope, include: list(input.include), exclude: Array.isArray(input.exclude) ? list(input.exclude) : DEFAULT_EXCLUDE, maxFileSize, token: typeof input.githubToken === 'string' ? input.githubToken.slice(0, 400) : '' };
}

/** Count bytes flowing through a stream and stop when a limit is passed. */
function meter(limit, message, onBytes = () => {}) {
  let total = 0;
  return new TransformStream({ transform(chunk, controller) { total += chunk.byteLength; onBytes(total); if (total > limit) controller.error(new AppError(413, message)); else controller.enqueue(chunk); } });
}

/** A minimal chunk queue so file data can be read or skipped without concatenating the whole archive. */
class Chunks {
  constructor(reader) { this.reader = reader; this.list = []; this.length = 0; this.done = false; }
  async need(count) { while (this.length < count && !this.done) { const { value, done } = await this.reader.read(); if (done) { this.done = true; break; } if (value?.byteLength) { this.list.push(value); this.length += value.byteLength; } } return this.length >= count; }
  async take(count) { if (!(await this.need(count))) throw new AppError(502, 'The repository archive ended unexpectedly.'); const out = new Uint8Array(count); let offset = 0; while (offset < count) { const head = this.list[0]; const part = Math.min(head.byteLength, count - offset); out.set(head.subarray(0, part), offset); offset += part; if (part === head.byteLength) this.list.shift(); else this.list[0] = head.subarray(part); } this.length -= count; return out; }
  async skip(count) { while (count > 0) { if (!this.length && !(await this.need(1))) throw new AppError(502, 'The repository archive ended unexpectedly.'); const head = this.list[0]; const part = Math.min(head.byteLength, count); if (part === head.byteLength) this.list.shift(); else this.list[0] = head.subarray(part); this.length -= part; count -= part; } }
}
const text = (bytes, start, length) => { const slice = bytes.subarray(start, start + length); const end = slice.indexOf(0); return new TextDecoder().decode(end >= 0 ? slice.subarray(0, end) : slice); };
function size(bytes) { if (bytes[124] & 0x80) { let value = 0; for (let index = 125; index < 136; index++) value = value * 256 + bytes[index]; return value; } return parseInt(text(bytes, 124, 12).trim() || '0', 8); } // Octal, or base-256 for very large entries.
function pax(data) { const fields = {}; const source = new TextDecoder().decode(data); let offset = 0; while (offset < source.length) { const space = source.indexOf(' ', offset); if (space < 0) break; const length = Number(source.slice(offset, space)); if (!length) break; const record = source.slice(space + 1, offset + length - 1); const equals = record.indexOf('='); if (equals > 0) fields[record.slice(0, equals)] = record.slice(equals + 1); offset += length; } return fields; }

/**
 * Parse a tar stream, asking `want(path, size)` whether to read each regular file's data.
 * Calls `visit({ path, size, type, data })`; data is present only when wanted.
 */
export async function readTar(readable, want, visit, { maxEntries = Infinity } = {}) {
  const chunks = new Chunks(readable.getReader()); let longName = null; let extended = {}; let count = 0;
  while (await chunks.need(512)) {
    const header = await chunks.take(512);
    if (header.every(byte => byte === 0)) break; // End-of-archive marker.
    const type = String.fromCharCode(header[156] || 48); const length = size(header); const padded = Math.ceil(length / 512) * 512;
    if (type === 'x' || type === 'g' || type === 'L') { const data = await chunks.take(padded); if (type === 'x') extended = pax(data.subarray(0, length)); if (type === 'L') longName = text(data, 0, length); continue; } // Metadata for the next entry, or global (ignored).
    const prefix = text(header, 345, 155); let path = extended.path || longName || (prefix ? `${prefix}/${text(header, 0, 100)}` : text(header, 0, 100)); const entrySize = extended.size ? Number(extended.size) : length; longName = null; extended = {};
    path = path.split('/').slice(1).join('/'); // Drop GitHub's top-level "owner-repo-sha/" folder.
    if (++count > maxEntries) throw new AppError(413, `The archive has more than ${maxEntries.toLocaleString('en')} entries, more than this server processes.`);
    const kind = type === '0' || type === '\0' || type === '7' ? 'file' : type === '5' ? 'directory' : type === '2' || type === '1' ? 'link' : 'other';
    const read = kind === 'file' && path && want(path, entrySize);
    const data = read ? await chunks.take(entrySize) : null; if (!read) await chunks.skip(entrySize);
    await chunks.skip(Math.ceil(entrySize / 512) * 512 - entrySize);
    if (path) await visit({ path, size: entrySize, type: kind, data });
  }
}

/** Download, filter, and read the whole repository at one commit. */
export async function extractRepository(input, { fetchImpl = fetch, signal, progress = () => {}, runtime = 'node', limits: override } = {}) {
  const request = validateExtractInput(input); const limits = { ...(EXTRACT_LIMITS[runtime] || EXTRACT_LIMITS.node), ...override }; // Tests may lower limits.
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': `GitArchitectureDiagram/${VERSION}` }; if (request.token) headers.Authorization = `Bearer ${request.token}`;
  progress({ stage: 'Asking GitHub for the archive', detail: `${request.owner}/${request.repo} at ${request.commit.slice(0, 7)}` });
  let first; try { first = await fetchImpl(`https://api.github.com/repos/${request.owner}/${request.repo}/tarball/${request.commit}`, { headers, redirect: 'manual', signal }); } catch { if (signal?.aborted) throw new AppError(408, 'The extract was cancelled.'); throw new AppError(502, 'Cannot reach GitHub.'); }
  await first.body?.cancel().catch(() => {});
  if (first.status === 404) throw new AppError(404, 'Repository or commit not found. Only public repositories can be extracted on this site.');
  if (first.status === 401) throw new AppError(401, 'GitHub rejected the read token.');
  const rate = rateLimitInfo(first.headers); if (first.status === 429 || (first.status === 403 && rate?.remaining === 0)) throw new AppError(429, rateLimitMessage(rate, first.headers.get('retry-after'), Boolean(request.token)));
  if (first.status === 403) throw new AppError(403, 'GitHub denied access to the archive (HTTP 403).');
  if (![301, 302, 303, 307, 308].includes(first.status)) throw new AppError(502, `GitHub answered the archive request with HTTP ${first.status} instead of a download link.`);
  let target; try { target = new URL(first.headers.get('location') || ''); } catch { target = null; }
  if (!target || target.protocol !== 'https:' || target.hostname !== 'codeload.github.com' || target.username || target.password) throw new AppError(502, 'GitHub pointed the archive to an unexpected address; it was not followed.');
  let archive; try { archive = await fetchImpl(target.href, { redirect: 'manual', signal, headers: { 'User-Agent': headers['User-Agent'] } }); } catch { if (signal?.aborted) throw new AppError(408, 'The extract was cancelled.'); throw new AppError(502, 'The archive download failed.'); } // No Authorization header leaves api.github.com.
  if (!archive.ok || !archive.body) { await archive.body?.cancel().catch(() => {}); throw new AppError(502, `The archive download failed (HTTP ${archive.status}).`); }
  const declared = Number(archive.headers.get('content-length')); if (declared > limits.compressedBytes) { await archive.body.cancel().catch(() => {}); throw new AppError(413, `This repository's archive is ${(declared / 1e6).toFixed(0)} MB; this server reads archives up to ${limits.compressedBytes / 1e6} MB. Use the analyzed files, or run the app locally for larger repositories.`); }
  let lastReport = 0; const report = (stage, detail) => { const now = Date.now(); if (now - lastReport > 400) { lastReport = now; progress({ stage, detail }); } };
  const stream = archive.body
    .pipeThrough(meter(limits.compressedBytes, `The archive is larger than the ${limits.compressedBytes / 1e6} MB this server reads. Use the analyzed files, or run the app locally.`, total => report('Downloading the archive', `${(total / 1e6).toFixed(1)} MB`)))
    .pipeThrough(new DecompressionStream('gzip'))
    .pipeThrough(meter(limits.scannedBytes, `The repository unpacks to more than ${limits.scannedBytes / 1e6} MB, more than this server reads.`));
  const filter = compileFilter(request); const inScope = path => !request.scope || path === request.scope || path.startsWith(request.scope + '/'); const relative = path => (request.scope ? path.slice(request.scope.length + 1) : path);
  const files = []; const skipped = { filtered: 0, tooLarge: [], binary: 0, credentials: [], budget: 0, symlinks: 0 }; let listed = 0; let contentBytes = 0;
  const decision = (path, entrySize) => { if (!inScope(path)) return 'scope'; if (isCredentialPath(path)) return 'credential'; if (!filter(relative(path))) return 'filtered'; if (entrySize > request.maxFileSize) return 'large'; if (isBinaryPath(path)) return 'binary'; if (contentBytes + entrySize > limits.contentBytes) return 'budget'; return 'read'; };
  await readTar(stream, (path, entrySize) => decision(path, entrySize) === 'read', async entry => {
    if (entry.type === 'link' && inScope(entry.path)) { skipped.symlinks++; listed++; return; }
    if (entry.type !== 'file' || !inScope(entry.path)) return;
    listed++; report('Reading files', `${listed.toLocaleString('en')} files`);
    if (!entry.data) { const why = decision(entry.path, entry.size); if (why === 'credential') skipped.credentials.push(entry.path); else if (why === 'filtered') skipped.filtered++; else if (why === 'large') skipped.tooLarge.push({ path: entry.path, size: entry.size }); else if (why === 'binary') skipped.binary++; else if (why === 'budget') skipped.budget++; return; }
    if (entry.data.subarray(0, 8000).includes(0)) { skipped.binary++; return; } // NUL bytes mean binary content.
    const content = new TextDecoder().decode(entry.data); contentBytes += entry.size;
    files.push({ path: entry.path, size: entry.size, lines: content ? content.split('\n').length : 0, content });
  }, { maxEntries: limits.entries });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)); skipped.tooLarge.sort((a, b) => b.size - a.size); skipped.tooLarge = skipped.tooLarge.slice(0, 200);
  return { repository: `${request.owner}/${request.repo}`, commit: request.commit, scope: request.scope, source: 'archive', listed, files, skipped, stats: statistics(files), filters: { include: request.include, exclude: request.exclude, maxFileSize: request.maxFileSize }, limits };
}
