// Project: Git Architecture Diagram | Tests: saved analyses (memory and file stores) and restart persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryStore, createFileStore, defaultAnalysisStore } from '../src/store.mjs';
import { runAnalysis, analysisKey } from '../src/service.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

const temp = prefix => mkdtempSync(join(tmpdir(), prefix));
const cleanup = [];
test.after(() => cleanup.forEach(path => rmSync(path, { recursive: true, force: true })));

test('the memory store expires entries, bounds its size, and returns copies', async () => {
  const store = createMemoryStore({ ttlMs: 50, maxEntries: 2 });
  await store.put('a', { n: 1 }); await store.put('b', { n: 2 }); await store.put('c', { n: 3 });
  assert.equal(await store.get('a'), null, 'oldest entry evicted');
  const copy = await store.get('c'); copy.n = 99;
  assert.deepEqual(await store.get('c'), { n: 3 }, 'callers cannot modify the saved value');
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(await store.get('c'), null, 'expired');
});

test('the file store survives a restart, rejects stale formats, and writes atomically', async () => {
  const dir = temp('gad-store-'); cleanup.push(dir);
  const first = await createFileStore({ dir });
  await first.put('analysis|acme/demo|sha|', { files: [{ path: 'README.md', content: '# Demo' }] });
  const second = await createFileStore({ dir }); // A new process reading the same folder.
  assert.deepEqual(await second.get('analysis|acme/demo|sha|'), { files: [{ path: 'README.md', content: '# Demo' }] });
  assert.equal(await second.get('analysis|acme/demo|other|'), null);
  const upgraded = await createFileStore({ dir, version: 2 });
  assert.equal(await upgraded.get('analysis|acme/demo|sha|'), null, 'a different store format is a miss');
  assert.ok(readdirSync(dir).every(name => /^[0-9a-f]{64}\.json$/.test(name)), 'no temporary files left behind');
  // A corrupted entry is a miss, not a crash.
  writeFileSync(join(dir, readdirSync(dir)[0]), '{not json');
  assert.equal(await second.get('analysis|acme/demo|sha|'), null);
});

test('the file store skips oversized entries and keeps only the newest entries within its limits', async () => {
  const dir = temp('gad-store-limits-'); cleanup.push(dir);
  const store = await createFileStore({ dir, maxEntries: 3, maxEntryBytes: 2000 });
  await store.put('big', { text: 'x'.repeat(5000) });
  assert.equal(await store.get('big'), null);
  assert.equal(store.describe().skipped, 1);
  for (let index = 0; index < 6; index++) { await store.put(`k${index}`, { index }); await new Promise(resolve => setTimeout(resolve, 15)); }
  await store.cleanup();
  assert.ok(readdirSync(dir).length <= 3, `entries: ${readdirSync(dir).length}`);
  assert.deepEqual(await store.get('k5'), { index: 5 }, 'the newest entry is kept');
});

test('the default store uses GAD_CACHE_DIR, honors "off", and falls back to memory when the folder is not writable', async () => {
  const dir = temp('gad-store-env-'); cleanup.push(dir);
  assert.equal((await defaultAnalysisStore({ root: dir, env: { GAD_CACHE_DIR: join(dir, 'saved') } })).kind, 'file');
  assert.equal((await defaultAnalysisStore({ root: dir, env: { GAD_CACHE_DIR: 'off' } })).kind, 'memory');
  writeFileSync(join(dir, 'a-file'), 'not a folder');
  const messages = [];
  const fallback = await defaultAnalysisStore({ root: dir, env: { GAD_CACHE_DIR: join(dir, 'a-file', 'saved') }, log: message => messages.push(message) });
  assert.equal(fallback.kind, 'memory');
  assert.ok(messages.length === 1 && !messages[0].includes(dir), 'the log names an error code, not the path');
});

test('a public analysis is reused after a restart without reading files again; private and changed commits are never reused', async () => {
  const repo = temp('gad-store-repo-'); const saved = temp('gad-store-saved-'); cleanup.push(repo, saved);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  const write = (path, text) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), text); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T');
  write('README.md', '# Saved\n'); write('package.json', JSON.stringify({ name: 'saved', main: './src/main.js' }));
  write('src/main.js', "import { a } from './a.js';\nexport default a;\n"); write('src/a.js', 'export const a = 1;\n');
  git('add', '.'); git('commit', '-q', '-m', 'one');
  const requests = [];
  const fetchImpl = createGitHubFetch({ 'acme/saved': { dir: repo }, 'acme/hidden': { dir: repo, private: true } }, { requests });
  const reads = () => requests.filter(item => item.host === 'raw.githubusercontent.com' || /\/git\/blobs\//.test(item.path)).length;

  const before = await createFileStore({ dir: saved });
  const first = await runAnalysis({ repository: 'acme/saved', maxFiles: 8 }, { env: {}, fetchImpl, analysisStore: before, retainSession: false });
  assert.equal(first.cacheHit, false);
  assert.ok(reads() >= 4, 'files were read');

  const afterRestart = await createFileStore({ dir: saved }); // A fresh process: nothing in memory.
  const readsBefore = reads();
  const second = await runAnalysis({ repository: 'acme/saved', maxFiles: 8 }, { env: {}, fetchImpl, analysisStore: afterRestart, retainSession: false });
  assert.equal(second.cacheHit, true);
  assert.equal(reads(), readsBefore, 'no file was read again');
  assert.deepEqual(second.files.map(file => file.path), first.files.map(file => file.path));
  assert.equal(second.repository.sha, first.repository.sha);

  // A new commit is a new key: the saved analysis of the old commit is not reused.
  write('src/a.js', 'export const a = 2;\n'); git('commit', '-qam', 'two');
  const third = await runAnalysis({ repository: 'acme/saved', maxFiles: 8 }, { env: {}, fetchImpl, analysisStore: afterRestart, retainSession: false });
  assert.equal(third.cacheHit, false);
  assert.notEqual(third.repository.sha, first.repository.sha);
  assert.match(third.files.find(file => file.path === 'src/a.js').content, /a = 2/);

  // Private repositories are never written to the store.
  const entries = readdirSync(saved).length;
  await runAnalysis({ repository: 'acme/hidden', maxFiles: 4, githubToken: 'caller-placeholder-token' }, { env: {}, fetchImpl, analysisStore: afterRestart, retainSession: false });
  assert.equal(readdirSync(saved).length, entries, 'nothing saved for the private repository');
  for (const name of readdirSync(saved)) assert.ok(!readFileSync(join(saved, name), 'utf8').includes('caller-placeholder-token'), 'no credential is ever stored');
  assert.match(analysisKey({ fullName: 'acme/saved', sha: 'abc', scope: '' }, 8), /^analysis\|acme\/saved\|abc\|\|8\|/);
});
