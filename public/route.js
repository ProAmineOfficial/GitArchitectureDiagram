// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-WORKSPACE-UI-001
// Project: Git Architecture Diagram | Component: Workspace routes | Author: Amine Saoud ibn al-Bashir.
// Maps GitHub-shaped paths (/owner/repo, /tree/ref/path, /blob/ref/file#L1-L9) to analysis requests and back.
// Pure functions only, so the same rules are unit-tested in Node and used by the browser.

export const DEFAULT_FILES = 32; // The file budget used when a link does not specify one.
const PAGES = { '': 'home', examples: 'browse', browse: 'browse' }; // Application pages that are not repositories.
const SEGMENT = /^[A-Za-z0-9_.-]+$/; // GitHub owner and repository name characters.

/** Parse a GitHub-style line anchor such as #L12 or #L12-L20. */
export function parseLines(hash = '') {
  const match = String(hash).match(/^#L(\d{1,7})(?:-L?(\d{1,7}))?$/);
  if (!match) return null;
  const start = Number(match[1]); const end = Math.max(start, Number(match[2] || match[1]));
  return start >= 1 ? { start, end } : null;
}

/** Format a line range as a GitHub anchor. */
export function lineAnchor(lines) {
  if (!lines) return '';
  return lines.end > lines.start ? `#L${lines.start}-L${lines.end}` : `#L${lines.start}`;
}

function decode(segment) { try { return decodeURIComponent(segment); } catch { return null; } }
const encodePath = value => value.split('/').filter(Boolean).map(encodeURIComponent).join('/');

/**
 * Parse a workspace location.
 * @returns {{page: 'home'|'browse'} | {page: 'repo', owner: string, repo: string, kind: string, rest: string, repository: string, ref: string, scope: string, files: number|null, lines: object|null} | {page: 'invalid', reason: string}}
 */
export function parseRoute(pathname = '/', search = '', hash = '') {
  const parts = String(pathname).split('/').filter(Boolean).map(decode);
  if (parts.some(part => part === null)) return { page: 'invalid', reason: 'The address contains invalid encoding.' };
  if (parts.length === 0) return { page: 'home' };
  if (parts.length === 1 && Object.hasOwn(PAGES, parts[0].toLowerCase())) return { page: PAGES[parts[0].toLowerCase()] };
  if (parts.length < 2) return { page: 'invalid', reason: 'Add the repository name after the owner, as on GitHub.' };
  const [owner, rawRepo, kind = '', ...rest] = parts;
  const repo = rawRepo.replace(/\.git$/, '');
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) return { page: 'invalid', reason: 'That is not a GitHub owner/repository path.' };
  if (kind && !['tree', 'blob'].includes(kind)) return { page: 'invalid', reason: `GitHub "${kind}" pages are not repositories. Open the repository, a folder, or a file instead.` };
  if (kind && !rest.length) return { page: 'invalid', reason: 'Add a branch, tag, or commit after /tree or /blob.' };
  const query = new URLSearchParams(search);
  const files = Number(query.get('files'));
  const repository = `https://github.com/${owner}/${repo}${kind ? `/${kind}/${rest.map(encodeURIComponent).join('/')}` : ''}`;
  return { page: 'repo', owner, repo, kind: kind || 'root', rest: rest.join('/'), repository, ref: query.get('ref') || '', scope: query.get('scope') || '', files: Number.isInteger(files) && files > 0 ? files : null, lines: parseLines(hash) };
}

/**
 * Build the workspace address for an analyzed snapshot.
 * By default the visitor's ref name is kept (so the address still mirrors GitHub); `pinned` uses the commit.
 */
export function workspacePath(repository, { pinned = false, focus = '', lines = null, files = DEFAULT_FILES } = {}) {
  const [owner, repo] = repository.fullName.split('/');
  const base = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const ref = pinned ? repository.sha : repository.branch;
  const refPath = ref.split('/').map(encodeURIComponent).join('/');
  const query = files && files !== DEFAULT_FILES ? `?files=${files}` : '';
  if (focus) return `${base}/blob/${refPath}/${encodePath(focus)}${query}${lineAnchor(lines)}`;
  const plain = !pinned && !repository.scope && (repository.refKind === 'default' || repository.branch === repository.defaultBranch);
  if (plain) return `${base}${query}`;
  return `${base}/tree/${refPath}${repository.scope ? '/' + encodePath(repository.scope) : ''}${query}`;
}

/** Convert pasted input (GitHub URL, workspace URL, or owner/repo) into a workspace path. */
export function inputToPath(input, host = '') {
  const value = String(input || '').trim();
  if (!value) return null;
  let path = value;
  const url = /^https?:\/\//i.test(value) ? safeURL(value) : /^(github\.com|www\.github\.com)\//i.test(value) ? safeURL(`https://${value}`) : null;
  if (url) {
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com' && hostname !== String(host).toLowerCase()) return null;
    path = url.pathname + url.search + url.hash;
  }
  const [pathname, hash = ''] = path.split('#');
  const [cleanPath, search = ''] = pathname.split('?');
  const route = parseRoute('/' + cleanPath.replace(/^\/+/, ''), search, hash ? '#' + hash : '');
  if (route.page !== 'repo') return null;
  return `/${route.owner}/${route.repo}${route.kind === 'root' ? '' : `/${route.kind}/${route.rest.split('/').map(encodeURIComponent).join('/')}`}${search ? '?' + search : ''}${route.lines ? lineAnchor(route.lines) : ''}`;
}
function safeURL(value) { try { return new URL(value); } catch { return null; } }
