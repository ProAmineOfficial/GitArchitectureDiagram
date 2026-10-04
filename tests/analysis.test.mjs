// Project: Git Architecture Diagram | Tests: routing, ingestion, overview, and graph contracts | Author: Amine Saoud ibn al-Bashir.
// A temporary Git repository supplies real commits, branches, tags, and blobs through the GitHub REST emulator.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitHubReader, parseRepository, rateLimitMessage, AppError } from '../src/github.mjs';
import { runAnalysis } from '../src/service.mjs';
import { validateGraph, compileGraph } from '../src/graph.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-repo-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
write('README.md', '# Demo\nA small web service.\n');
write('package.json', JSON.stringify({ name: 'demo', main: './lib/app.js' }));
write('index.js', "module.exports = require('./lib/app.js');\n");
write('lib/app.js', "import { route } from './router.js';\nimport express from 'express';\nimport path from 'node:path';\n");
write('lib/router.js', "import { db } from '../store/db.js';\nexport const route = 1;\n");
write('store/db.js', 'export const db = {};\n');
for (let index = 0; index < 6; index++) write(`examples/demo${index}/index.js`, "const app = require('../../');\n");
write('test/app.test.js', "import '../lib/app.js';\n");
write('docs/flow.mmd', 'flowchart LR\n  A[Request] --> B[Router]\n  classDef hot fill:#f96\n');
write('firmware/platformio.ini', '[env:esp32]\nboard = esp32dev\n');
write('firmware/src/main.cpp', '#include <Arduino.h>\n#include <cmath>\n#include "sensor.h"\n');
write('firmware/include/sensor.h', 'int read();\n');
git('add', '.'); git('commit', '-q', '-m', 'initial');
git('branch', 'feature/deep/ui'); git('tag', 'v1.0');
const head = git('rev-parse', 'HEAD').trim();
const log = [];
const fetchImpl = createGitHubFetch({ 'acme/demo': { dir, description: 'Fixture' } }, { log, failures: {
  'acme/limited': () => new Response('{"message":"API rate limit exceeded"}', { status: 403, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) } }),
  'acme/portal': () => new Response('<!doctype html><title>Sign in</title>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
} });
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('tree URLs resolve slash branches through the ref listing in few requests', async () => {
  log.length = 0;
  const snapshot = await new GitHubReader({ fetchImpl }).snapshot(parseRepository('https://github.com/acme/demo/tree/feature/deep/ui/lib'));
  assert.equal(snapshot.branch, 'feature/deep/ui'); assert.equal(snapshot.refKind, 'branch'); assert.equal(snapshot.scope, 'lib'); assert.equal(snapshot.sha, head);
  assert.ok(log.length <= 5, `expected at most 5 GitHub requests, saw ${log.length}: ${log.join(', ')}`);
});

test('tags and commit SHAs resolve from tree URLs', async () => {
  const reader = new GitHubReader({ fetchImpl });
  const tagged = await reader.snapshot(parseRepository('acme/demo/tree/v1.0/store'));
  assert.equal(tagged.branch, 'v1.0'); assert.equal(tagged.refKind, 'tag'); assert.equal(tagged.scope, 'store');
  const pinned = await reader.snapshot(parseRepository(`acme/demo/tree/${head.slice(0, 12)}/docs`));
  assert.equal(pinned.refKind, 'commit'); assert.equal(pinned.sha, head); assert.equal(pinned.scope, 'docs');
  await assert.rejects(reader.snapshot(parseRepository('acme/demo/tree/no-such-branch/lib')), /No branch, tag, or commit named "no-such-branch"/);
});

test('blob URLs open the file inside its nearest project folder', async () => {
  const snapshot = await new GitHubReader({ fetchImpl }).snapshot(parseRepository('acme/demo/blob/main/firmware/src/main.cpp'));
  assert.equal(snapshot.scope, 'firmware'); assert.equal(snapshot.focus, 'firmware/src/main.cpp');
  const result = await runAnalysis({ repository: 'acme/demo/blob/main/firmware/src/main.cpp', maxFiles: 3 }, { env: {}, fetchImpl, cachePublic: false });
  assert.equal(result.files[0].path, 'firmware/src/main.cpp'); assert.equal(result.files[0].reason, 'Opened from the URL');
});

test('rate limits and HTML interstitials produce actionable messages', async () => {
  await assert.rejects(new GitHubReader({ fetchImpl }).get('/repos/acme/limited'), error => error.status === 429 && /resets in about 10 minutes/.test(error.message) && /server-side GITHUB_TOKEN/.test(error.message));
  await assert.rejects(new GitHubReader({ fetchImpl }).get('/repos/acme/portal'), error => error.status === 502 && /text\/html instead of JSON/.test(error.message));
  assert.match(rateLimitMessage({ reset: Math.floor(Date.now() / 1000) + 90 }, null, true), /token's allowance/);
});

test('transient GitHub failures are retried once, client errors are not', async () => {
  let calls = 0;
  const flaky = async () => (++calls === 1 ? new Response('bad gateway', { status: 502 }) : Response.json({ ok: true }));
  assert.deepEqual(await new GitHubReader({ fetchImpl: flaky }).get('/repos/acme/x'), { ok: true }); assert.equal(calls, 2);
  let missing = 0;
  await assert.rejects(new GitHubReader({ fetchImpl: async () => { missing++; return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }); } }).get('/repos/acme/x'), error => error instanceof AppError && error.status === 404);
  assert.equal(missing, 1);
});

test('ingestion follows manifest entry points and imports before examples', async () => {
  const result = await runAnalysis({ repository: 'acme/demo', maxFiles: 7 }, { env: {}, fetchImpl, cachePublic: false });
  const read = result.files.map(file => file.path);
  for (const core of ['lib/app.js', 'lib/router.js', 'store/db.js']) assert.ok(read.includes(core), `${core} should be read; read ${read.join(', ')}`);
  assert.match(result.files.find(file => file.path === 'lib/app.js').reason, /Declared as "main"/);
  assert.match(result.files.find(file => file.path === 'store/db.js').reason, /Imported by lib\/router\.js:1/);
  assert.equal(result.entrypoints[0].path, 'lib/app.js'); assert.equal(result.entrypoints[0].basis, 'manifest');
  assert.ok(result.readingOrder.length >= 3 && result.readingOrder[0].path === 'README.md');
});

test('the component overview draws only observed relationships and skips standard libraries', async () => {
  const result = await runAnalysis({ repository: 'acme/demo', maxFiles: 20 }, { env: {}, fetchImpl, cachePublic: false });
  const { overview, components } = result.diagrams;
  const kinds = Object.fromEntries(components.map(item => [item.name, item.kind]));
  assert.equal(kinds.test, 'tests'); assert.equal(kinds.docs, 'docs'); assert.equal(kinds.examples, 'examples'); assert.equal(kinds.lib, 'source');
  assert.match(overview, /imports ×6/, 'six examples import the package root through require("../../")');
  assert.match(overview, /express/); assert.match(overview, /Arduino\.h/);
  assert.doesNotMatch(overview, /node:path|cmath/);
  assert.ok(!/-\.->/.test(overview), 'deterministic overview contains no inferred edges');
  assert.equal(result.documented.find(item => item.path === 'docs/flow.mmd')?.line, 1);
  assert.ok(result.diagrams.componentGraphs.lib.architecture.startsWith('flowchart'));
  assert.equal(result.diagrams.overviewPaths.n0.type, 'tree');
});

test('graph validation keeps verified paths, demotes unsupported claims, and remaps identifiers', () => {
  const inventory = { paths: new Set(['src/a.js', 'src/b.js']), folders: new Set(['src']), lineLimits: new Map([['src/a.js', 10]]) };
  const { graph, discarded } = validateGraph({ nodes: [
    { id: 'api', label: 'API', kind: 'service', path: 'src/a.js' },
    { id: 'core', label: 'Core', kind: 'source', path: 'src' },
    { id: 'ghost', label: 'Ghost', kind: 'source', path: 'src/invented.js' },
    { id: 'bad id!', label: 'x' },
  ], edges: [
    { from: 'api', to: 'core', label: 'calls', basis: 'observed', evidencePath: 'src/a.js', evidenceLine: 4 },
    { from: 'core', to: 'ghost', label: 'uses', basis: 'observed', evidencePath: 'src/a.js', evidenceLine: 99 },
    { from: 'api', to: 'missing' },
  ] }, inventory);
  assert.equal(graph.nodes.length, 3); assert.equal(graph.nodes[2].kind, 'concept'); assert.equal(graph.nodes[2].path, '');
  assert.equal(graph.edges[0].basis, 'observed'); assert.equal(graph.edges[1].basis, 'inferred');
  assert.ok(discarded.length >= 3);
  const compiled = compileGraph(graph);
  assert.match(compiled.mermaid, /n0\[\["API"\]\]:::service/); assert.match(compiled.mermaid, /n1 -\.->\|uses\| n2/);
  assert.deepEqual(compiled.nodePaths, { n0: { path: 'src/a.js', type: 'blob' }, n1: { path: 'src', type: 'tree' } });
  assert.ok(!compiled.mermaid.includes('bad id') && !compiled.mermaid.includes('ghost'));
});
