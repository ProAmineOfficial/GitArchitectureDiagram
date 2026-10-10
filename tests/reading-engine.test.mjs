// Project: Git Architecture Diagram | Tests: GitHub Reading Engine 2.0.
// Commit-pinned raw reads with blob verification and API fallback, truncated-tree recovery, request accounting,
// deterministic selection with prefetch, and breadth-first retention. A temporary Git repository is served through the
// GitHub emulator (API and raw hosts); no network and no real credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitHubReader, parseRepository, ingest, retainEntries, gitBlobSha } from '../src/github.mjs';
import { runAnalysis } from '../src/service.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

// A repository with nested folders: 3 top-level files plus 4 packages × 2 folders × 3 files = 27 blobs.
const dir = mkdtempSync(join(tmpdir(), 'gad-engine-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
write('README.md', '# Engine fixture\nA repository with nested packages.\n');
write('package.json', JSON.stringify({ name: 'engine', main: './pkg/a/src/index.js' }));
write('index.js', "export * from './pkg/a/src/index.js';\n");
for (const name of ['a', 'b', 'c', 'd']) {
  write(`pkg/${name}/src/index.js`, `import { helper } from './helper.js';\nexport const ${name} = helper;\n`);
  write(`pkg/${name}/src/helper.js`, `export const helper = '${name}';\n`);
  write(`pkg/${name}/src/util.js`, `export const util = '${name}';\n`);
  write(`pkg/${name}/docs/README.md`, `# Package ${name}\n`);
  write(`pkg/${name}/docs/guide.md`, `Guide for ${name}.\n`);
  write(`pkg/${name}/docs/notes.txt`, `Notes for ${name}.\n`);
}
git('add', '.'); git('commit', '-q', '-m', 'initial');
const head = git('rev-parse', 'HEAD').trim();
const fullTree = git('ls-tree', '-r', '-t', '--name-only', 'HEAD').trim().split('\n').sort();
test.after(() => rmSync(dir, { recursive: true, force: true }));

/** A fresh emulator with its own request log. */
function emulator(options = {}) {
  const requests = [];
  const fetchImpl = createGitHubFetch({ 'acme/engine': { dir }, 'acme/secret': { dir, private: true } }, { requests, ...options });
  const count = host => requests.filter(item => item.host === host).length;
  return { fetchImpl, requests, api: () => count('api.github.com'), raw: () => count('raw.githubusercontent.com') };
}

test('public files are read from the raw host at the commit, verified, with three API calls in total', async () => {
  const github = emulator();
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl, token: 'server-placeholder-token' });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'));
  assert.equal(github.api(), 3, 'metadata, commit, and tree');
  const { files, coverage } = await ingest(snapshot, reader, 20, () => {}, { concurrency: 1 });
  assert.equal(files.length, 20);
  assert.equal(github.api(), 3, 'no per-file API calls');
  assert.equal(github.raw(), 20);
  for (const file of files) assert.equal(gitBlobSha(Buffer.from(file.content)), file.sha, `${file.path} verified`);
  assert.deepEqual(coverage.requests, { api: 3, raw: 20, rawFallbacks: 0, treeRequests: 1, prefetchUnused: 0 });
  // Raw reads are pinned to the commit and never carry the server token.
  for (const item of github.requests.filter(request => request.host === 'raw.githubusercontent.com')) {
    assert.ok(item.path.startsWith(`/acme/engine/${head}/`), item.path);
    assert.equal(item.authorization, false);
  }
});

test('content that fails blob verification is never used; the API read replaces it', async () => {
  const github = emulator({ failures: { 'raw:acme/engine': () => new Response('tampered content\n', { status: 200 }) } });
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'));
  const { files, coverage } = await ingest(snapshot, reader, 6, () => {}, { concurrency: 1 });
  assert.equal(files.length, 6);
  assert.ok(files.every(file => !file.content.includes('tampered')), 'tampered bytes were rejected');
  for (const file of files) assert.equal(gitBlobSha(Buffer.from(file.content)), file.sha);
  // After three consecutive failures the reader stops trying the raw host for this run.
  assert.equal(coverage.requests.raw, 3);
  assert.equal(coverage.requests.rawFallbacks, 3);
  assert.equal(coverage.requests.api, 3 + 6);
});

test('a raw outage falls back to the API without losing files', async () => {
  const github = emulator({ failures: { 'raw:acme/engine': () => new Response('Service Unavailable', { status: 503 }) } });
  const result = await runAnalysis({ repository: 'acme/engine', maxFiles: 8 }, { env: {}, fetchImpl: github.fetchImpl, cachePublic: false, retainSession: false });
  assert.equal(result.coverage.readFiles, 8);
  assert.ok(result.coverage.requests.raw <= 3 + 4, 'raw attempts stop after the failure limit (plus reads already in flight)');
  assert.ok(result.coverage.requests.api >= 3 + 8 - 0);
});

test('private repositories are read only through the authenticated API', async () => {
  const github = emulator();
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl, token: 'caller-placeholder-token' });
  const snapshot = await reader.snapshot(parseRepository('acme/secret'), { suppliedToken: true });
  assert.equal(snapshot.private, true);
  const { files, coverage } = await ingest(snapshot, reader, 5, () => {}, { concurrency: 4 });
  assert.equal(files.length, 5);
  assert.equal(github.raw(), 0, 'private content never goes to the raw host');
  assert.equal(coverage.requests.raw, 0);
  assert.equal(coverage.requests.prefetchUnused, 0, 'no speculative reads spend API quota');
});

test('a truncated tree is recovered folder by folder and reported as complete', async () => {
  const github = emulator({ truncateTreesOver: 5 }); // GitHub truncates every recursive listing above five entries here.
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'));
  assert.deepEqual(snapshot.entries.map(entry => entry.path), fullTree);
  assert.equal(snapshot.treeRecovered, true);
  assert.equal(snapshot.treeTruncated, false);
  assert.ok(reader.stats.treeRequests > 1, `extra listings: ${reader.stats.treeRequests}`);
});

test('a truncated tree under a scope lists that folder completely', async () => {
  const github = emulator({ truncateTreesOver: 5 });
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'), { scope: 'pkg/b' });
  const expected = fullTree.filter(path => path === 'pkg/b' || path.startsWith('pkg/b/'));
  assert.deepEqual(snapshot.entries.map(entry => entry.path), expected);
  assert.equal(snapshot.treeTruncated, false);
});

test('when the recovery budget runs out, the tree is reported as partial, never as complete', async () => {
  const github = emulator({ truncateTreesOver: 5 });
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl, maxTreeRequests: 1 });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'));
  assert.equal(snapshot.treeRecovered, true);
  assert.equal(snapshot.treeTruncated, true);
  assert.ok(snapshot.entries.length < fullTree.length);
  const result = await runAnalysis({ repository: 'acme/engine', maxFiles: 4 }, { env: {}, fetchImpl: emulator({ truncateTreesOver: 2 }).fetchImpl, cachePublic: false, retainSession: false });
  assert.ok(typeof result.coverage.treeRecovered === 'boolean');
});

test('prefetching never changes which files are selected', async () => {
  const run = async concurrency => {
    const github = emulator();
    const reader = new GitHubReader({ fetchImpl: github.fetchImpl });
    const snapshot = await reader.snapshot(parseRepository('acme/engine'));
    const { files, coverage } = await ingest(snapshot, reader, 12, () => {}, { concurrency });
    return { paths: files.map(file => `${file.path}:${file.reason}`), coverage };
  };
  const sequential = await run(1);
  const prefetched = await run(4);
  assert.deepEqual(prefetched.paths, sequential.paths);
  assert.equal(sequential.coverage.requests.prefetchUnused, 0);
  assert.ok(prefetched.coverage.requests.raw >= 12);
});

test('a hosted request budget disables prefetch and counts raw reads against the budget', async () => {
  const github = emulator();
  const reader = new GitHubReader({ fetchImpl: github.fetchImpl, maxRequests: 48 });
  const snapshot = await reader.snapshot(parseRepository('acme/engine'));
  const { files, coverage } = await ingest(snapshot, reader, 20, () => {}, { concurrency: 4 });
  assert.equal(files.length, 20);
  assert.equal(coverage.requests.prefetchUnused, 0);
  assert.equal(coverage.requests.raw, 20);
  assert.equal(reader.requests, 23, 'three API calls plus one raw read per file');
});

test('retention keeps shallow levels first, then restores path order', () => {
  const entries = ['a/deep/x/1.js', 'a/deep/x/2.js', 'a/top.js', 'b.js', 'z/src/main.js', 'z/README.md'].map(path => ({ path }));
  assert.deepEqual(retainEntries(entries, 3).map(entry => entry.path), ['a/top.js', 'b.js', 'z/README.md']);
  assert.equal(retainEntries(entries, 10), entries, 'small trees are returned unchanged');
});
