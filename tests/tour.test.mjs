// Project: Git Architecture Diagram | System Map 2.0: validated tour steps and the deterministic structural tour.
import test from 'node:test'; import assert from 'node:assert/strict';
import { validateGraph, compileGraph, TOUR_LIMITS } from '../src/graph.mjs';
import { buildOverview } from '../src/overview.mjs';

const inventory = { paths: new Set(['server/index.js', 'server/db.js', 'README.md']), folders: new Set(['server']), lineLimits: new Map() };
const nodes = [{ id: 'user', label: 'Shopper', kind: 'actor', path: '' }, { id: 'api', label: 'API', kind: 'service', path: 'server/index.js' }, { id: 'db', label: 'Store', kind: 'data', path: 'server/db.js' }];

test('tour steps keep only real supporting files, a valid stage, and an honest basis; at most 12 steps', () => {
  const tour = [
    { node: 'user', stage: 'start', text: 'A shopper opens the site.', files: [], basis: 'inferred' },
    { node: 'api', stage: 'entry', text: 'The API receives the request.', files: ['server/index.js', 'server/ghost.js'], basis: 'observed' },
    { node: 'db', stage: 'teleport', text: 'Orders are stored.', files: ['server/missing.js'], basis: 'documented' },
  ];
  const { graph, discarded } = validateGraph({ nodes, edges: [{ from: 'api', to: 'db', label: 'order rows', basis: 'inferred' }], tour }, inventory);
  assert.deepEqual(graph.tour[1].files, ['server/index.js']); assert.equal(graph.tour[1].basis, 'observed');
  assert.equal(graph.tour[2].stage, 'other'); assert.deepEqual(graph.tour[2].files, []); assert.equal(graph.tour[2].basis, 'inferred', 'a sourced claim without a verified file becomes inference');
  assert.ok(discarded.some(note => /not in this commit/.test(note)));
  const compiled = compileGraph(graph); assert.equal(compiled.tour[1].stage, 'entry'); assert.deepEqual(compiled.tour[1].files, ['server/index.js']); assert.equal(compiled.tour[1].path, 'server/index.js');
  const long = Array.from({ length: 20 }, (_, index) => ({ node: index % 2 ? 'api' : 'db', stage: 'component', text: `Step ${index}`, files: [], basis: 'inferred' }));
  assert.equal(validateGraph({ nodes, edges: [], tour: long }, inventory).graph.tour.length, TOUR_LIMITS.max);
});

test('the component overview carries a structural tour built only from located evidence', () => {
  const entries = ['README.md', 'package.json', 'server/index.js', 'server/routes/api.js', 'web/App.jsx', 'db/store.js', 'test/api.test.js', '.github/workflows/ci.yml'].map(path => ({ path, type: 'blob' }));
  const files = [
    { path: 'README.md', content: '# Shop\n\nAn online shop with a web storefront and an API.\n', reason: 'Ranked by path' },
    { path: 'package.json', content: '{"main":"server/index.js"}', reason: 'Manifest' },
    { path: 'server/index.js', content: "import { db } from '../db/store.js';\nimport express from 'express';\n", reason: 'Declared as "main" in package.json' },
    { path: 'db/store.js', content: "import pg from 'pg';\n", reason: 'Ranked by path' },
    { path: 'web/App.jsx', content: "import { x } from '../server/routes/api.js';\n", reason: 'Ranked by path' },
  ];
  const edges = [{ from: 'server/index.js', to: 'db/store.js', line: 1, kind: 'import' }, { from: 'web/App.jsx', to: 'server/routes/api.js', line: 1, kind: 'import' }];
  const external = [{ from: 'server/index.js', specifier: 'express', line: 2, kind: 'import' }, { from: 'db/store.js', specifier: 'pg', line: 1, kind: 'import' }];
  const overview = buildOverview({ scope: '', entries }, files, edges, external);
  const tour = overview.tour; assert.ok(tour.length >= 3 && tour.length <= 12);
  assert.equal(tour[0].stage, 'start'); assert.equal(tour[0].basis, 'documented'); assert.match(tour[0].text, /An online shop/); assert.deepEqual(tour[0].files, ['README.md']);
  const entry = tour.find(step => step.stage === 'entry'); assert.equal(entry.basis, 'observed'); assert.ok(entry.files.includes('server/index.js')); assert.match(entry.text, /declared as "main" in package\.json/);
  const state = tour.find(step => step.stage === 'state'); assert.ok(state, 'the storage component is reached through a located import'); assert.deepEqual(state.files, ['server/index.js']); assert.match(state.text, /server\/index\.js:1/);
  assert.ok(tour.some(step => step.stage === 'external' && /express|pg/.test(step.text)));
  assert.ok(tour.every(step => step.id && step.files.every(path => entries.some(entry => entry.path === path))));
});
