// Project: Git Architecture Diagram | Tests: highlights, hierarchy, mind map, skills, prompts, and exports | Author: Amine Saoud ibn al-Bashir.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { computeHighlight, MODES } from '../public/highlights.js';
import * as knowledge from '../public/knowledge.js';
import { runAnalysis } from '../src/service.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-know-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@e.com'); git('config', 'user.name', 'T');
write('README.md', '# Shop\nAn online shop.\n\n## Features\n- Product search\n- Secure checkout\n- Order history\n\n## Other\n- not a feature\n');
write('package.json', JSON.stringify({ name: 'shop', main: 'server/index.js', dependencies: { express: '4', react: '18', pg: '8' }, devDependencies: { vitest: '1' } }));
write('server/index.js', "import { route } from './routes/api.js';\nimport express from 'express';\n");
write('server/routes/api.js', "import { auth } from '../auth/token.js';\nimport { db } from '../db/store.js';\nexport const route = 1;\n");
write('server/auth/token.js', 'export const auth = 1;\n'); write('server/db/store.js', "import pg from 'pg';\nexport const db = 1;\n");
write('web/App.jsx', "import React from 'react';\n"); write('test/api.test.js', "import '../server/routes/api.js';\n");
write('.github/workflows/ci.yml', 'on: push\n'); write('Dockerfile', 'FROM node:22\n');
git('add', '.'); git('commit', '-q', '-m', 'c');
const fetchImpl = createGitHubFetch({ 'acme/shop': { dir, description: 'Shop' } });
let result; test.before(async () => { result = await runAnalysis({ repository: 'acme/shop', maxFiles: 20 }, { env: {}, fetchImpl, cachePublic: false }); });
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('highlights isolate flows, layers, and keyword selections with honest basis labels', () => {
  const model = { nodes: [{ id: 'a', label: 'index.js', kind: 'entry', path: 'server/index.js' }, { id: 'b', label: 'api.js', kind: 'source', path: 'server/routes/api.js' }, { id: 'c', label: 'store.js', kind: 'source', path: 'server/db/store.js' }, { id: 'd', label: 'token.js', kind: 'source', path: 'server/auth/token.js' }, { id: 'e', label: 'App.jsx', kind: 'ui', path: 'web/App.jsx' }, { id: 'f', label: 'api.test.js', kind: 'test', path: 'test/api.test.js' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'b', to: 'd' }, { from: 'f', to: 'b' }] };
  const flow = computeHighlight(model, 'flow'); // App.jsx is a component, not an entry point the analyzer verified. assert.deepEqual([...flow.nodes].sort(), ['a', 'b', 'c', 'd']); assert.equal(flow.basis, 'source'); assert.ok(flow.edges.has('a>b') && !flow.edges.has('f>b'));
  assert.deepEqual([...computeHighlight(model, 'storage').nodes], ['c']); assert.deepEqual([...computeHighlight(model, 'security').nodes], ['d']); assert.deepEqual([...computeHighlight(model, 'frontend').nodes], ['e']); assert.deepEqual([...computeHighlight(model, 'tests').nodes], ['f']);
  const query = computeHighlight(model, 'query', { query: 'Highlight authentication token flow' }); assert.ok(query.nodes.has('d') && query.nodes.has('b')); assert.equal(query.basis, 'keyword');
  const tour = computeHighlight(model, 'flow', { flowEdges: [['a', 'b']] }); assert.equal(tour.basis, 'genius');
  assert.equal(computeHighlight(model, 'paths', { paths: ['server/db'] }).basis, 'selection');
  assert.ok(MODES.length >= 16);
});

test('the software hierarchy is organized by layer, not by folder listing, with meaningful badges', () => {
  const root = result.hierarchy.source.root; const labels = root.children.map(layer => layer.label);
  assert.equal(result.hierarchy.source.type, 'application');
  for (const layer of ['Frontend', 'Tests', 'Build, CI, and automation']) assert.ok(labels.includes(layer), `${layer} in ${labels.join(', ')}`);
  const text = knowledge.hierarchyText(root, { depth: 5 });
  assert.match(text, /index\.js \[ENTRY POINT/); assert.match(text, /EXTERNAL/); assert.match(text, /├── |└── /);
  assert.ok(knowledge.hierarchyMermaid(root).startsWith('flowchart TD'));
});

test('the repository mind map holds concepts that map to paths, including README features', () => {
  const { conceptMindmap, conceptMindmapPaths } = result.diagrams;
  assert.match(conceptMindmap, /README features/); assert.match(conceptMindmap, /Secure checkout/); assert.doesNotMatch(conceptMindmap, /not a feature/);
  assert.match(conceptMindmap, /Infrastructure/); assert.match(conceptMindmap, /CI workflows/); assert.match(conceptMindmap, /Containers/);
  const ci = Object.values(conceptMindmapPaths).find(item => item.concept === 'CI workflows'); assert.deepEqual(ci.paths, ['.github/workflows/ci.yml']);
});

test('development skills separate observed evidence from recommendations', () => {
  const observed = name => result.skills.observed.find(item => item.name === name);
  assert.deepEqual(observed('Express (Node.js HTTP)').evidence, ['package.json', 'server/index.js'], 'declared and imported'); assert.ok(observed('React')); assert.ok(observed('PostgreSQL')); assert.ok(observed('Vitest')); assert.ok(observed('Docker containers')); assert.ok(observed('GitHub Actions CI'));
  assert.ok(!result.skills.observed.some(item => /Arduino|ESP32/.test(item.name)), 'no invented skills');
  const markdown = knowledge.skillsMarkdown(result); assert.ok(markdown.indexOf('## Observed development skills') < markdown.indexOf('## Recommended development skills'));
  assert.equal(JSON.parse(knowledge.skillsJSON(result)).commit, result.repository.sha);
  assert.match(knowledge.skillsForYourApp(result, 'a web dashboard with user logins'), /### Security/);
});

test('development prompts, blueprints, roadmaps, and context carry the required sections and provenance', () => {
  const prompt = knowledge.developmentPrompt(result, 'rebuild');
  for (const section of ['Project objective', 'Project summary', 'Observed architecture', 'Software hierarchy', 'Technology stack', 'Core components', 'Entry points', 'Dependencies', 'Important files', 'Data flow', 'Implementation requirements', 'Development skills', 'Development plan', 'Constraints', 'Testing requirements', 'Acceptance criteria', 'Known limitations of this analysis']) assert.match(prompt, new RegExp(`## ${section}`), section);
  assert.match(prompt, new RegExp(result.repository.sha)); assert.match(prompt, /Write original code/);
  assert.equal(Object.keys(knowledge.PROMPT_MODES).length, 11);
  assert.match(knowledge.implementationRoadmap(result), /## Phase 1: Project setup/); assert.match(knowledge.appBlueprint(result), /## Recommended folder structure/);
  assert.match(knowledge.aiReadyContext(result), /## Relationships \(observed imports\)/);
});

test('exports: clone command, README badge and picture, project extract, reconstruction pack', () => {
  const clone = knowledge.cloneCommand(result.repository); assert.match(clone, /^git clone https:\/\/github\.com\/acme\/shop\.git\ncd shop\ngit checkout [0-9a-f]{40}$/); assert.doesNotMatch(clone, /token|@github/);
  const badge = knowledge.readmeBadge(result.repository, 'https://example.test', '/acme/shop/tree/abc'); assert.match(badge.markdown, /^\[!\[Architecture diagram\]\(https:\/\/img\.shields\.io\/badge\/Architecture-Open%20diagram-6f8dff\)\]\(https:\/\/example\.test\/acme\/shop\/tree\/abc\)$/);
  assert.match(knowledge.readmePicture(result.repository, 'https://example.test', '/x', { file: 'docs/system-map.png', view: 'System map' }), /^!\[System map of acme\/shop\]\(\.\/docs\/system-map\.png\)/);
  const extract = knowledge.projectExtract(result, { maxCharacters: 300 }); assert.match(extract.summary, /Estimated tokens/); assert.match(extract.content, /omitted/);
  assert.deepEqual(Object.keys(knowledge.reconstructionPack(result)).sort(), ['README.md', 'app-blueprint.md', 'architecture.md', 'development-skills.md', 'evidence.json', 'genius-prompt.md', 'implementation-roadmap.md', 'mind-map.mmd', 'repository-tree.txt', 'software-hierarchy.md']);
});
