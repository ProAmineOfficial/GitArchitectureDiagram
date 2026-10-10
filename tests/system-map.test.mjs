// Project: Git Architecture Diagram | Tests: system map graph, guided tour, and the opt-in public AI budget | Author: Amine Saoud ibn al-Bashir.
import test from 'node:test'; import assert from 'node:assert/strict';
import { validateGraph, compileGraph } from '../src/graph.mjs';
import { runAnalysis, publicAIStatus } from '../src/service.mjs';
import { githubFixture, files, isGitHubHost } from './fixtures.mjs';

const inventory = { paths: new Set(['README.md', 'drivers/x.inf']), folders: new Set(['drivers']), lineLimits: new Map([['README.md', 40], ['drivers/x.inf', 30]]) };
const raw = { groups: [{ id: 'win', label: 'Windows driver' }], nodes: [
  { id: 'user', label: 'Board user', kind: 'actor', path: '' },
  { id: 'dm', label: 'Windows Device Manager', kind: 'external', path: '' },
  { id: 'inf', label: 'Driver INF', kind: 'hardware', group: 'win', path: 'drivers/x.inf' },
  { id: 'board', label: 'NanoKit ESP32', kind: 'external', path: '' },
  { id: 'idea', label: 'Invented layer', kind: 'service', path: '' },
], edges: [
  { from: 'user', to: 'dm', label: 'installs through', basis: 'documented', evidencePath: 'README.md', evidenceLine: 19 },
  { from: 'dm', to: 'inf', label: 'reads', basis: 'inferred', evidencePath: '', evidenceLine: 0 },
  { from: 'inf', to: 'board', label: 'enables USB-UART', basis: 'documented', evidencePath: 'drivers/x.inf', evidenceLine: 3 },
], tour: [{ node: 'user', text: 'A board owner installs the driver.' }, { node: 'dm', text: 'Windows reads the package.' }, { node: 'ghost', text: 'x' }, { node: 'inf', text: 'The INF matches the USB bridge.' }, { node: 'board', text: 'The ESP32 appears as a COM port.' }] };

test('actors and external systems keep their kind without paths; other pathless nodes become concepts', () => {
  const { graph } = validateGraph(raw, inventory);
  const kind = id => graph.nodes.find(node => node.id === id).kind;
  assert.equal(kind('user'), 'actor'); assert.equal(kind('dm'), 'external'); assert.equal(kind('inf'), 'hardware'); assert.equal(kind('idea'), 'concept');
  const compiled = compileGraph(graph);
  assert.match(compiled.mermaid, /n0\(\("Board user"\)\):::actor/); assert.deepEqual(compiled.nodePaths, { n2: { path: 'drivers/x.inf', type: 'blob' } });
});

test('the guided tour keeps valid steps in order and marks the edges along it as flow', () => {
  const { graph, discarded } = validateGraph(raw, inventory);
  assert.deepEqual(graph.tour.map(step => step.node), ['user', 'dm', 'inf', 'board']); assert.ok(discarded.some(item => item.includes('tour step')));
  const compiled = compileGraph(graph);
  assert.deepEqual(compiled.tour.map(step => step.id), ['n0', 'n1', 'n2', 'n3']); assert.equal(compiled.tour[0].label, 'Board user');
  assert.deepEqual(compiled.flowEdges, [['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
  assert.equal(graph.edges[1].basis, 'inferred'); assert.match(compiled.mermaid, /n1 -\.->\|reads\| n2/);
});

const report = graph => ({ overview: 'A fixture service.', components: [], relationships: [], recommendations: [], limitations: [], graph });
function provider(counter) { return async (url, options) => { if (isGitHubHost(url)) return counter.github(url, options); counter.ai++; const body = JSON.parse(options.body); assert.equal(body.text.format.schema.properties.graph.properties.tour.type, 'array'); return Response.json({ status: 'completed', model: 'site-model', output: [{ content: [{ type: 'output_text', text: JSON.stringify(report({ groups: [], nodes: [{ id: 'user', label: 'Visitor', detail: '', kind: 'actor', group: '', path: '' }, { id: 'main', label: 'Main module', detail: '', kind: 'entry', group: '', path: files[0].path }], edges: [{ from: 'user', to: 'main', label: 'runs', basis: 'inferred', evidencePath: '', evidenceLine: 0 }], tour: [{ node: 'user', text: 'Starts here.' }, { node: 'main', text: 'Then here.' }] })) }] }] }); }; }
const siteEnv = { GENIUS_PUBLIC_AI: '1', OPENAI_API_KEY: 'site-key', GENIUS_MODEL: 'site-model', GENIUS_PUBLIC_DAILY_LIMIT: '2' };

test('public system maps use the site key once per commit and then serve the saved map', async () => {
  const fixture = githubFixture({ name: 'public-map' }); const counter = { ai: 0, github: fixture.fetchImpl };
  const first = await runAnalysis({ repository: 'acme/public-map', maxFiles: 3, ai: true }, { env: siteEnv, cachePublic: false, fetchImpl: provider(counter) });
  assert.equal(counter.ai, 1); assert.equal(first.ai.public, true); assert.equal(first.ai.diagrams.architecture, first.ai.graph.mermaid); assert.equal(first.ai.graph.tour.length, 2);
  const second = await runAnalysis({ repository: 'acme/public-map', maxFiles: 3, ai: true }, { env: siteEnv, cachePublic: false, fetchImpl: provider(counter) });
  assert.equal(counter.ai, 1, 'the saved map costs nothing'); assert.equal(second.ai.saved, true);
  assert.equal(publicAIStatus(siteEnv).remainingToday, 1);
});

test('the daily limit, private repositories, and personal keys are respected', async () => {
  const counter = { ai: 0 };
  const other = githubFixture({ name: 'other-map' }); counter.github = other.fetchImpl;
  await runAnalysis({ repository: 'acme/other-map', maxFiles: 3, ai: true }, { env: siteEnv, cachePublic: false, fetchImpl: provider(counter) });
  const third = githubFixture({ name: 'third-map' }); counter.github = third.fetchImpl;
  const limited = await runAnalysis({ repository: 'acme/third-map', maxFiles: 3, ai: true }, { env: siteEnv, cachePublic: false, fetchImpl: provider(counter) });
  assert.equal(limited.ai, null); assert.ok(limited.warnings.some(item => item.includes('free system maps on this site are used up')));
  const secret = githubFixture({ privateRepo: true, name: 'secret-map' }); counter.github = secret.fetchImpl; const before = counter.ai;
  const hidden = await runAnalysis({ repository: 'acme/secret-map', maxFiles: 3, ai: true, githubToken: 'visitor-token' }, { env: { ...siteEnv, GENIUS_PUBLIC_DAILY_LIMIT: '99' }, cachePublic: false, fetchImpl: provider(counter) });
  assert.equal(counter.ai, before, 'a private repository never uses the site key'); assert.equal(hidden.ai, null);
  const own = githubFixture({ name: 'own-key' }); counter.github = own.fetchImpl;
  const personal = await runAnalysis({ repository: 'acme/own-key', maxFiles: 3, ai: true, apiKey: 'visitor-key', model: 'visitor-model' }, { env: siteEnv, cachePublic: false, fetchImpl: provider(counter) });
  assert.equal(personal.ai.public, undefined, 'a result paid by a visitor is not saved for others');
  assert.equal(publicAIStatus({}).enabled, false); assert.equal(publicAIStatus({ ...siteEnv, GENIUS_MODEL: '' }).enabled, false);
});
