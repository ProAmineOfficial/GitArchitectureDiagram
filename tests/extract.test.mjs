// Project: Git Architecture Diagram | Tests: full-repository project extract from the GitHub archive | Author: Amine Saoud ibn al-Bashir.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { patternMatcher, compileFilter, parsePatterns, sections, allText, asMarkdown, directoryTree, languageOf } from '../public/extract-core.js';
import { extractRepository, validateExtractInput } from '../src/extract.mjs';
import { createWorker } from '../worker.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-extract-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, data) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), data); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@e.com'); git('config', 'user.name', 'T');
write('README.md', '# Demo\n'); write('src/app.js', 'export const app = 1;\n'); write('src/util/math.ts', 'export const add = (a: number, b: number) => a + b;\n');
write('docs/guide.md', '# Guide\n'); write('docs/deep/api.md', '# API\n'); write('.env', 'SECRET=never-read\n'); write('keys/server.pem', '-----BEGIN PRIVATE KEY-----\n');
write('assets/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0])); write('data/blob.txt', Buffer.from('text\0binary'));
write('big/huge.txt', 'x'.repeat(60000)); write('node_modules/lib/index.js', 'module.exports = 1;\n'); write('firmware/src/main.cpp', 'void setup() {}\n');
git('add', '-f', '.'); git('commit', '-q', '-m', 'c'); const sha = git('rev-parse', 'HEAD').trim();
const requests = []; const github = createGitHubFetch({ 'acme/demo': { dir } }, { requests, failures: {
  'acme/evil': () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/acme/demo/legacy.tar.gz/x' } }),
  'acme/limited': () => new Response('{}', { status: 403, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300) } }),
} });
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('patterns: file names anywhere, folders, anchored paths, and globstars', () => {
  assert.ok(patternMatcher('*.md')('docs/deep/api.md')); assert.ok(patternMatcher('*.md')('README.md')); assert.ok(!patternMatcher('*.md')('src/app.js'));
  assert.ok(patternMatcher('src/')('src/app.js')); assert.ok(patternMatcher('src/')('firmware/src/main.cpp'), 'a folder name matches at any depth');
  assert.ok(patternMatcher('/src/')('src/app.js')); assert.ok(!patternMatcher('/src/')('firmware/src/main.cpp'), 'a leading slash anchors to the root');
  assert.ok(patternMatcher('docs/**/*.md')('docs/deep/api.md')); assert.ok(!patternMatcher('docs/*.md')('docs/deep/api.md'));
  const filter = compileFilter({ include: parsePatterns('src/, *.md'), exclude: parsePatterns('docs/deep/') });
  assert.deepEqual(['src/app.js', 'README.md', 'docs/deep/api.md', 'big/huge.txt'].filter(filter), ['src/app.js', 'README.md']);
  assert.equal(languageOf('a/b.tsx'), 'TypeScript'); assert.match(directoryTree('demo', ['a/b.js', 'c.md']), /^demo\/\n├── a\/\n│   └── b\.js\n└── c\.md$/);
});

test('the archive is read in one API request; credentials, binaries, and oversized files are never included', async () => {
  requests.length = 0; const events = [];
  const result = await extractRepository({ repository: 'acme/demo', commit: sha, githubToken: 'visitor-token' }, { fetchImpl: github, progress: event => events.push(event) });
  const paths = result.files.map(file => file.path);
  assert.deepEqual(paths, ['README.md', 'docs/deep/api.md', 'docs/guide.md', 'firmware/src/main.cpp', 'src/app.js', 'src/util/math.ts']);
  assert.deepEqual(result.skipped.credentials.sort(), ['.env', 'keys/server.pem']); assert.equal(result.skipped.binary, 2); assert.deepEqual(result.skipped.tooLarge.map(item => item.path), ['big/huge.txt']); assert.equal(result.skipped.filtered, 1, 'node_modules is excluded by default');
  assert.ok(!JSON.stringify(result).includes('never-read') && !JSON.stringify(result).includes('PRIVATE KEY'));
  assert.deepEqual(requests.map(item => [item.host, item.authorization]), [['api.github.com', true], ['codeload.github.com', false]], 'the token never leaves api.github.com');
  assert.ok(!JSON.stringify(result).includes('codeload'), 'the archive URL is not returned');
  assert.equal(result.stats.languages.find(item => item.name === 'Documentation').files, 3); assert.ok(events.some(event => event.stage === 'Asking GitHub for the archive'));
});

test('scope, include/exclude, and the size limit apply on the server', async () => {
  const scoped = await extractRepository({ repository: 'acme/demo', commit: sha, scope: 'docs', include: ['*.md'], exclude: ['deep/'] }, { fetchImpl: github });
  assert.deepEqual(scoped.files.map(file => file.path), ['docs/guide.md']); assert.equal(scoped.listed, 2);
  const bigger = await extractRepository({ repository: 'acme/demo', commit: sha, include: ['big/'], maxFileSize: 100000 }, { fetchImpl: github });
  assert.deepEqual(bigger.files.map(file => file.path), ['big/huge.txt']);
  const parts = sections(scoped, [{ path: 'docs/guide.md', why: 'documentation' }]);
  assert.match(parts.summary, new RegExp(`Commit: ${sha}`)); assert.match(parts.summary, /Source: entire repository archive/); assert.match(allText(parts), /FILE: docs\/guide\.md/); assert.match(asMarkdown(scoped, parts), /### docs\/guide\.md\n\n```md\n# Guide/);
});

test('unsafe redirects, bad input, rate limits, and size limits fail clearly', async () => {
  await assert.rejects(extractRepository({ repository: 'acme/evil', commit: sha }, { fetchImpl: github }), /unexpected address; it was not followed/);
  assert.ok(!requests.some(item => item.host === 'evil.example'));
  const before = requests.length; await assert.rejects(extractRepository({ repository: 'acme/demo', commit: 'main' }, { fetchImpl: github }), /40-character commit SHA/); assert.equal(requests.length, before, 'rejected before any request');
  assert.throws(() => validateExtractInput({ repository: '../../x', commit: sha }), /owner\/name/); assert.throws(() => validateExtractInput({ repository: 'a/b', commit: sha, scope: 'a/../../etc' }), /Invalid folder/);
  await assert.rejects(extractRepository({ repository: 'acme/limited', commit: sha }, { fetchImpl: github }), /rate limit was reached\. It resets in about 5 minutes/);
  await assert.rejects(extractRepository({ repository: 'acme/demo', commit: sha }, { fetchImpl: github, limits: { compressedBytes: 200 } }), /reads archives up to 0\.0002 MB|larger than the 0\.0002 MB/);
  await assert.rejects(extractRepository({ repository: 'acme/demo', commit: sha }, { fetchImpl: github, limits: { scannedBytes: 4000 } }), /unpacks to more than/);
  const budget = await extractRepository({ repository: 'acme/demo', commit: sha }, { fetchImpl: github, limits: { contentBytes: 40 } }); assert.ok(budget.skipped.budget > 0 && budget.files.length < 6);
});

test('the hosted Worker streams the extract as NDJSON with the same admission rules', async () => {
  const worker = createWorker({ extract: (input, options) => extractRepository(input, { ...options, fetchImpl: github }) });
  const post = body => new Request('https://diagram.example/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://diagram.example' }, body: JSON.stringify(body) });
  const response = await worker.fetch(post({ repository: 'acme/demo', commit: sha, include: ['src/'] }), {});
  assert.equal(response.headers.get('Content-Type'), 'application/x-ndjson');
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line)); const result = events.find(event => event.type === 'result').result;
  assert.deepEqual(result.files.map(file => file.path), ['firmware/src/main.cpp', 'src/app.js', 'src/util/math.ts']); assert.equal(result.limits.compressedBytes, 30e6);
  assert.equal((await worker.fetch(post({ repository: 'acme/demo', commit: 'main' }), {})).status, 400);
});
