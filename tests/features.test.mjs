// Project: Git Architecture Diagram | Tests: routes, grounded questions, AI graphs, and hosted endpoints | Author: Amine Saoud ibn al-Bashir.
// Provider calls are mocked with each provider's documented response shape; no credentials or network are used.
import test from 'node:test'; import assert from 'node:assert/strict';
import { parseRoute, parseLines, workspacePath, inputToPath, lineAnchor } from '../public/route.js';
import { queryTerms, selectExcerpts } from '../public/ask.js';
import { askGenius, validateAskInput, validateAnswer, ASK_LIMITS } from '../src/ask.mjs';
import { explainWithAI } from '../src/ai.mjs';
import { analyzeSnapshot } from '../src/genius.mjs';
import { runAnalysis } from '../src/service.mjs';
import { createWorker } from '../worker.mjs';
import { files, entries, commitSHA, githubFixture, isGitHubHost } from './fixtures.mjs';

const repo = { fullName: 'ProAmineOfficial/NanoKit-ESP32', sha: '17834db850daec9b450239069c4aa2e758bf0644', branch: 'main', defaultBranch: 'main', refKind: 'branch', scope: 'examples_on_platformio/ultrasonic_distance', htmlUrl: 'https://github.com/ProAmineOfficial/NanoKit-ESP32' };

test('routes mirror GitHub paths, including line anchors and legacy query links', () => {
  const route = parseRoute('/ProAmineOfficial/NanoKit-ESP32/blob/feature/x/src/main.cpp', '?files=12', '#L20-L24');
  assert.equal(route.page, 'repo'); assert.equal(route.kind, 'blob'); assert.equal(route.rest, 'feature/x/src/main.cpp'); assert.equal(route.files, 12);
  assert.deepEqual(route.lines, { start: 20, end: 24 }); assert.equal(route.repository, 'https://github.com/ProAmineOfficial/NanoKit-ESP32/blob/feature/x/src/main.cpp');
  assert.equal(parseRoute('/acme/demo', '?ref=abc&scope=docs').scope, 'docs');
  assert.equal(parseRoute('/browse').page, 'browse'); assert.equal(parseRoute('/examples/').page, 'browse'); assert.equal(parseRoute('/').page, 'home');
  assert.match(parseRoute('/acme/demo/pulls/3').reason, /not repositories/);
  assert.equal(parseRoute('/acme/demo.git').repo, 'demo'); assert.equal(parseRoute('/acme/%E0%A4%A').page, 'invalid');
  assert.deepEqual(parseLines('#L7'), { start: 7, end: 7 }); assert.deepEqual(parseLines('#L9-L3'), { start: 9, end: 9 }); assert.equal(parseLines('#readme'), null);
  assert.equal(lineAnchor({ start: 4, end: 4 }), '#L4');
});

test('workspace paths keep the visitor\'s ref, pin commits on request, and encode segments', () => {
  assert.equal(workspacePath(repo), '/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance');
  assert.equal(workspacePath({ ...repo, scope: '', refKind: 'default' }), '/ProAmineOfficial/NanoKit-ESP32');
  assert.equal(workspacePath(repo, { pinned: true, focus: 'examples_on_platformio/ultrasonic_distance/src/main.cpp', lines: { start: 31, end: 31 }, files: 24 }), `/ProAmineOfficial/NanoKit-ESP32/blob/${repo.sha}/examples_on_platformio/ultrasonic_distance/src/main.cpp?files=24#L31`);
  assert.equal(workspacePath({ ...repo, branch: 'feature/deep ui', scope: 'docs #1' }), '/ProAmineOfficial/NanoKit-ESP32/tree/feature/deep%20ui/docs%20%231');
  assert.equal(inputToPath('https://github.com/acme/demo/tree/main/src#L3'), '/acme/demo/tree/main/src#L3');
  assert.equal(inputToPath('github.com/acme/demo'), '/acme/demo'); assert.equal(inputToPath('acme/demo'), '/acme/demo');
  assert.equal(inputToPath('https://diagram.example/acme/demo', 'diagram.example'), '/acme/demo');
  assert.equal(inputToPath('https://evil.example/acme/demo', 'diagram.example'), null);
});

test('question excerpts are bounded, skip filler words, and fall back to the reading order', () => {
  assert.deepEqual(queryTerms('How does the router load the config?'), ['router', 'load', 'config']);
  const result = { files: [{ path: 'src/router.js', content: Array.from({ length: 400 }, (_, index) => (index === 200 ? 'export function router() {}' : `line ${index}`)).join('\n') }], readingOrder: [{ path: 'src/router.js' }] };
  const picked = selectExcerpts(result, 'Where is the router?');
  assert.equal(picked.excerpts.length, 1); assert.equal(picked.excerpts[0].startLine, 183); assert.ok(picked.characters <= ASK_LIMITS.totalCharacters);
  assert.equal(selectExcerpts(result, 'zzz qqq').excerpts[0].startLine, 1);
});

const excerpt = { path: 'src/main.cpp', startLine: 10, text: 'void loop() {\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n}' };
const openAI = body => async (url, options) => { assert.equal(url, 'https://api.openai.com/v1/responses'); const sent = JSON.parse(options.body); assert.equal(sent.store, false); assert.equal(sent.max_output_tokens, ASK_LIMITS.outputTokens); assert.equal(sent.text.format.name, 'genius_answer'); return Response.json({ status: 'completed', model: 'test-model', usage: { input_tokens: 90, output_tokens: 40 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(body) }] }] }); };

test('question requests are validated before any provider call', async () => {
  let calls = 0; const counting = async () => { calls++; return new Response('{}'); };
  await assert.rejects(askGenius({ question: '', excerpts: [excerpt] }, { apiKey: 'k', model: 'm', fetchImpl: counting }), /1 to 600/);
  await assert.rejects(askGenius({ question: 'q', excerpts: Array(13).fill(excerpt) }, { apiKey: 'k', model: 'm', fetchImpl: counting }), /1 to 12/);
  await assert.rejects(askGenius({ question: 'q', excerpts: [{ ...excerpt, text: 'x'.repeat(4001) }] }, { apiKey: 'k', model: 'm', fetchImpl: counting }), /malformed or too large/);
  await assert.rejects(askGenius({ question: 'q', excerpts: [excerpt] }, { apiKey: '', model: 'm', fetchImpl: counting }), /API key and model ID/);
  await assert.rejects(askGenius({ question: 'q', excerpts: [excerpt] }, { apiKey: 'k', model: 'm', provider: 'dalle', fetchImpl: counting }), /Choose OpenAI/);
  assert.equal(calls, 0);
  assert.equal(validateAskInput({ question: ' q ', excerpts: [excerpt] }).excerpts[0].endLine, 13);
});

test('provider failures and HTML pages become actionable errors', async () => {
  await assert.rejects(askGenius({ question: 'q', excerpts: [excerpt] }, { apiKey: 'k', model: 'm', provider: 'anthropic', fetchImpl: async () => new Response('{}', { status: 401 }) }), /API key rejected by Claude\. Check or create a new provider API key\./);
  await assert.rejects(askGenius({ question: 'q', excerpts: [excerpt] }, { apiKey: 'k', model: 'm', fetchImpl: async () => new Response('<!doctype html><p>Proxy</p>', { status: 200 }) }), /HTML page instead of JSON/);
});

test('Claude answers are read from text blocks and ignore thinking blocks', async () => {
  const fetchImpl = async (url, options) => { assert.equal(url, 'https://api.anthropic.com/v1/messages'); const sent = JSON.parse(options.body); assert.equal(sent.output_config.format.type, 'json_schema'); assert.ok(sent.max_tokens >= 8000); return Response.json({ model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: JSON.stringify({ answer: 'Yes.', findings: [], suggestions: [], answered: true }) }] }); };
  const answer = await askGenius({ question: 'q', excerpts: [excerpt] }, { apiKey: 'k', model: 'claude-sonnet-5-5', provider: 'anthropic', fetchImpl });
  assert.equal(answer.answer, 'Yes.'); assert.equal(answer.providerName, 'Claude');
});

test('the AI architecture graph is validated against the commit before it becomes Mermaid', async () => {
  const snapshot = { owner: 'acme', repo: 'demo', fullName: 'acme/demo', htmlUrl: 'https://github.com/acme/demo', route: '/repos/acme/demo', sha: commitSHA, branch: 'main', scope: '', entries, description: '', private: false, treeTruncated: false };
  const result = analyzeSnapshot(snapshot, files, { readFiles: files.length, eligibleFiles: files.length, listedFiles: files.length, maxFiles: 32, bytes: 1, treeTruncated: false, skipped: [], unsampledFiles: 0 });
  const [first, second] = files;
  const report = { overview: 'Overview', components: [], relationships: [], recommendations: [], limitations: [], graph: { groups: [{ id: 'core', label: 'Core' }], nodes: [
    { id: 'entry', label: 'Entry', detail: '', kind: 'entry', group: 'core', path: first.path },
    { id: 'helper', label: 'Helper', detail: '', kind: 'source', group: 'core', path: second.path },
    { id: 'cloud', label: 'Cloud service', detail: 'from README', kind: 'service', group: '', path: '' },
    { id: 'ghost', label: 'Invented', detail: '', kind: 'source', group: '', path: 'src/does-not-exist.js' },
  ], edges: [
    { from: 'entry', to: 'helper', label: 'imports', basis: 'observed', evidencePath: first.path, evidenceLine: 1 },
    { from: 'helper', to: 'cloud', label: 'uploads', basis: 'documented', evidencePath: first.path, evidenceLine: 9999 },
  ] } };
  const fetchImpl = async () => Response.json({ status: 'completed', model: 'test-model', output: [{ content: [{ type: 'output_text', text: JSON.stringify(report) }] }] });
  const ai = await explainWithAI(result, { apiKey: 'k', model: 'test-model', fetchImpl });
  assert.equal(ai.graph.nodes.find(node => node.id === 'cloud').kind, 'concept'); assert.equal(ai.graph.nodes.find(node => node.id === 'ghost').kind, 'concept');
  assert.equal(ai.graph.edges[0].basis, 'observed'); assert.equal(ai.graph.edges[1].basis, 'inferred', 'a line outside the supplied excerpt cannot be "documented"');
  assert.match(ai.graph.mermaid, /subgraph g0\["Core"\]/); assert.ok(!ai.graph.mermaid.includes('does-not-exist'));
  assert.deepEqual(Object.values(ai.graph.nodePaths).map(item => item.path).sort(), [first.path, second.path].sort());
  assert.ok(ai.graphNotes.some(note => note.includes('does-not-exist')));
  const fixture = githubFixture({ name: 'ai-graph' });
  const full = await runAnalysis({ repository: 'acme/ai-graph', maxFiles: 4, ai: true, apiKey: 'k', model: 'test-model' }, { env: {}, cachePublic: false, fetchImpl: (url, options) => (isGitHubHost(url) ? fixture.fetchImpl(url, options) : fetchImpl(url, options)) });
  assert.equal(full.ai.diagrams.architecture, full.ai.graph.mermaid); assert.match(full.guide, /Interpreted component graph/);
});

test('hosted questions require an explicit AI request and repository paths always open the workspace', async () => {
  const assets = { fetch: async request => (new URL(request.url).pathname === '/index.html' ? new Response('<!doctype html><title>Git Architecture Diagram</title>', { headers: { 'Content-Type': 'text/html' } }) : new Response('Not found', { status: 404 })) };
  let received;
  const worker = createWorker({ ask: async (input, options) => { received = { input, options }; return { answer: 'ok', findings: [], suggestions: [], answered: true, sent: { excerpts: 1, characters: 10 } }; } });
  const post = body => new Request('https://diagram.example/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://diagram.example' }, body: JSON.stringify(body) });
  assert.equal((await worker.fetch(post({ question: 'q', excerpts: [excerpt] }), {})).status, 400);
  const response = await worker.fetch(post({ ai: true, question: 'q', excerpts: [excerpt], apiKey: 'visitor-key', model: 'm', provider: 'openai' }), { OPENAI_API_KEY: 'server-key', GENIUS_MODEL: 'server-model' });
  assert.equal(response.status, 200); assert.equal((await response.json()).answer, 'ok'); assert.equal(received.options.apiKey, 'visitor-key');
  await worker.fetch(post({ ai: true, question: 'q', excerpts: [excerpt], provider: 'openai' }), { OPENAI_API_KEY: 'server-key', GENIUS_MODEL: 'server-model' });
  assert.equal(received.options.apiKey, '', 'an anonymous visitor cannot spend the server key');
  for (const route of ['/browse', '/acme/demo/pulls/3', '/acme/demo/commit/abc']) { const page = await worker.fetch(new Request(`https://diagram.example${route}`), { ASSETS: assets }); assert.equal(page.status, 200, route); }
});
