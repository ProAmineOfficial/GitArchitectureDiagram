// Project: Git Architecture Diagram | Component: GitHub REST emulator for tests | Author: Amine Saoud ibn al-Bashir.
// Serves real repository content from local Git checkouts through the exact REST routes the reader uses.
// It is a test transport only: results prove analyzer behavior on real files, not live GitHub availability.
import { execFileSync } from 'node:child_process'; // Read objects with the Git CLI instead of reimplementing the object store.

const git = (dir, args, encoding = 'utf8') => execFileSync('git', ['-C', dir, ...args], { encoding, maxBuffer: 64 * 1024 * 1024 }); // Run one read-only Git command.

function jsonResponse(status, data, headers = {}) { // Mirror GitHub's JSON content type and rate-limit headers.
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4999', ...headers } });
}

function refsOf(dir) { // List branches and tags with the commits they point to.
  return git(dir, ['for-each-ref', '--format=%(refname) %(objectname) %(*objectname)', 'refs/heads', 'refs/tags']).trim().split('\n').filter(Boolean).map(line => { const [ref, object, peeled] = line.split(' '); return { ref, sha: peeled || object }; });
}

function resolveCommit(dir, ref) { // Resolve a branch, tag, or commit prefix the way GitHub's commits endpoint does.
  const candidates = [`refs/heads/${ref}`, `refs/tags/${ref}`];
  for (const name of candidates) { try { return git(dir, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`]).trim(); } catch { /* Try the next namespace. */ } }
  if (/^[0-9a-f]{7,40}$/i.test(ref)) { try { return git(dir, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim(); } catch { /* Unknown SHA. */ } }
  return null;
}

/**
 * Create a fetch implementation that answers api.github.com requests from local clones.
 * @param {Record<string, {dir: string, description?: string, private?: boolean}>} repositories keyed by "owner/repo"
 * @param {object} options fallback fetch for non-GitHub URLs, request log, and scripted failures
 */
export function createGitHubFetch(repositories, { fallback, log = [], failures = {}, requests = [] } = {}) {
  const byLowerName = new Map(Object.entries(repositories).map(([name, repo]) => [name.toLowerCase(), { name, ...repo }]));
  return async function emulatedFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ host: url.hostname, path: url.pathname, authorization: Boolean(init.headers?.Authorization || init.headers?.authorization) }); // Lets tests prove where credentials were sent.
    if (url.hostname === 'codeload.github.com') { // Serve the commit archive the way GitHub's codeload does.
      const [, owner, name, kind, sha] = url.pathname.split('/'); const repo = byLowerName.get(`${owner}/${name}`.toLowerCase());
      const scripted = failures[`codeload:${owner}/${name}`.toLowerCase()]; if (scripted) return typeof scripted === 'function' ? scripted(url) : scripted;
      if (!repo || kind !== 'legacy.tar.gz') return new Response('Not Found', { status: 404 });
      const bytes = git(repo.dir, ['archive', '--format=tar.gz', `--prefix=${owner}-${name}-${sha.slice(0, 7)}/`, sha], 'buffer');
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/x-gzip', 'Content-Length': String(bytes.length) } });
    }
    if (url.hostname !== 'api.github.com') { if (!fallback) throw new TypeError(`Unexpected outbound request to ${url.hostname}`); return fallback(input, init); }
    log.push(url.pathname + url.search);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const match = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!match) return jsonResponse(404, { message: 'Not Found' });
    const fullName = `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`.toLowerCase();
    const scripted = failures[fullName]; // Allow tests to reproduce GitHub and gateway failure modes.
    if (scripted) { const result = typeof scripted === 'function' ? scripted(url) : scripted; if (result) return result; }
    const repo = byLowerName.get(fullName);
    if (!repo) return jsonResponse(404, { message: 'Not Found' });
    const rest = match[3] || '';
    if (!rest) { const head = git(repo.dir, ['symbolic-ref', '--short', 'HEAD']).trim(); return jsonResponse(200, { full_name: repo.name, description: repo.description ?? '', private: Boolean(repo.private), default_branch: head, html_url: `https://github.com/${repo.name}` }); }
    let part;
    if ((part = rest.match(/^\/commits\/(.+)$/))) { const ref = decodeURIComponent(part[1]); const sha = resolveCommit(repo.dir, ref); if (!sha) return jsonResponse(ref.includes('/') ? 422 : 404, { message: 'No commit found for SHA: ' + ref }); const tree = git(repo.dir, ['rev-parse', `${sha}^{tree}`]).trim(); const date = git(repo.dir, ['show', '-s', '--format=%cI', sha]).trim(); return jsonResponse(200, { sha, commit: { tree: { sha: tree }, committer: { date } } }); }
    if ((part = rest.match(/^\/git\/matching-refs\/(heads|tags)\/(.*)$/))) { const prefix = `refs/${part[1]}/${decodeURIComponent(part[2])}`; return jsonResponse(200, refsOf(repo.dir).filter(item => item.ref.startsWith(prefix)).map(item => ({ ref: item.ref, object: { sha: item.sha, type: 'commit' } }))); }
    if ((part = rest.match(/^\/git\/trees\/([0-9a-f]{40})$/))) { const lines = git(repo.dir, ['ls-tree', '-r', '-t', '-l', '-z', part[1]]).split('\0').filter(Boolean); const tree = lines.map(line => { const [meta, path] = line.split('\t'); const [mode, type, sha, size] = meta.split(/\s+/); return { path, mode, type, sha, ...(type === 'blob' ? { size: Number(size) } : {}) }; }); return jsonResponse(200, { sha: part[1], tree, truncated: false }); }
    if ((part = rest.match(/^\/git\/blobs\/([0-9a-f]{40})$/))) { const bytes = git(repo.dir, ['cat-file', 'blob', part[1]], 'buffer'); return jsonResponse(200, { sha: part[1], size: bytes.length, encoding: 'base64', content: bytes.toString('base64').replace(/(.{60})/g, '$1\n') }); }
    if ((part = rest.match(/^\/tarball\/(.+)$/))) { const sha = resolveCommit(repo.dir, decodeURIComponent(part[1])); if (!sha) return jsonResponse(404, { message: 'Not Found' }); return new Response(null, { status: 302, headers: { Location: `https://codeload.github.com/${repo.name}/legacy.tar.gz/${sha}`, 'x-ratelimit-remaining': '4998' } }); }
    if ((part = rest.match(/^\/contents\/(.+)$/))) { const ref = url.searchParams.get('ref') || 'HEAD'; const file = decodeURIComponent(part[1]); try { const bytes = git(repo.dir, ['show', `${ref}:${file}`], 'buffer'); return jsonResponse(200, { type: 'file', path: file, encoding: 'base64', content: bytes.toString('base64').replace(/(.{60})/g, '$1\n') }); } catch { return jsonResponse(404, { message: 'Not Found' }); } }
    return jsonResponse(404, { message: 'Not Found' });
  };
}
