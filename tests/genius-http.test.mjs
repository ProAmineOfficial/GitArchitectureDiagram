// Project: Git Architecture Diagram | HTTP contracts for model discovery, Test connection, and Deep Genius agent calls.
import test from 'node:test'; import assert from 'node:assert/strict';
import './support/no-autostart.mjs';
import { createAppServer } from '../server.mjs'; import { createWorker } from '../worker.mjs';
import { commitSHA } from './fixtures.mjs';

const providerFetch = async (url, options) => {
  const host = new URL(url).hostname;
  if (url.endsWith('/models')) return Response.json({ data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] });
  if (host === 'api.deepseek.com') { const body = JSON.parse(options.body); const system = body.messages[0].content; const output = /connection_check|Connection check/.test(system) ? { ok: true } : { summary: 'Reviewed.', findings: [], evidenceRequests: [], limitations: [] }; return Response.json({ model: body.model, usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }); }
  if (host === 'api.openai.com') return Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 });
  return new Response('not found', { status: 404 });
};

test('the Node server serves model discovery, Test connection, and agent calls with classified errors', async t => {
  const server = createAppServer({ fetchImpl: providerFetch }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const health = await (await fetch(base + '/api/health')).json(); assert.deepEqual(health.providers, ['openai', 'anthropic', 'gemini', 'kimi', 'deepseek']); assert.equal(health.version, '1.1.0'); assert.equal(health.accessRequired, undefined); assert.equal(health.aiAvailable, undefined);
  const bundled = await (await post('/api/models', { provider: 'gemini' })).json(); assert.equal(bundled.source, 'bundled'); assert.deepEqual(Object.keys(bundled.pair), ['fast', 'advanced']); assert.equal(bundled.pair.advanced.id, 'gemini-3.8-flash');
  const discovered = await (await post('/api/models', { provider: 'deepseek', apiKey: 'sk-http-test-key-0000000' })).json(); assert.equal(discovered.source, 'discovered'); assert.equal(discovered.pair.fast.available, true);
  const connection = await (await post('/api/provider/test', { provider: 'deepseek', apiKey: 'sk-http-test-key-0000000', model: 'deepseek-flash' })).json(); assert.equal(connection.status, 'Connected');
  const missing = await (await post('/api/provider/test', { provider: 'openai', model: 'gpt-6-luna' })).json(); assert.equal(missing.status, 'API key missing'); assert.equal(missing.diagnostics.apiKeyPresent, false);
  const agent = await post('/api/genius/agent', { agent: '1A', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: { excerpts: [] }, provider: 'deepseek', apiKey: 'sk-http-test-key-0000000', model: 'deepseek-flash' });
  assert.equal(agent.status, 200); const answer = await agent.json(); assert.equal(answer.agent, '1A'); assert.deepEqual(answer.output.findings, []); assert.ok(!JSON.stringify(answer).includes('sk-http-test-key'));
  const quota = await post('/api/genius/agent', { agent: '1B', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: {}, provider: 'openai', apiKey: 'sk-http-test-key-0000000', model: 'gpt-6-luna' });
  assert.equal(quota.status, 502); const failure = await quota.json(); assert.equal(failure.kind, 'quota_exhausted'); assert.equal(failure.error, 'Provider quota/credits are exhausted.'); assert.ok(failure.suggestion);
  assert.equal((await post('/api/genius/agent', { agent: '1A', stage: 'solve', repository: 'acme/demo', commit: commitSHA, payload: {} })).status, 400);
  assert.equal((await post('/api/genius/agent', { agent: '1A', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: {} }, { Origin: 'https://evil.test' })).status, 403);
  const noKey = await (await post('/api/genius/agent', { agent: '1A', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: {}, provider: 'deepseek' })).json(); assert.match(noKey.error, /needs a provider API key/);
});

test('a leftover GENIUS_ACCESS_TOKEN never blocks the public API, and the server never lends its own provider key', async t => {
  const saved = { ...process.env }; Object.assign(process.env, { GENIUS_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-server-key-000000000', GENIUS_MODEL: 'deepseek-flash', GENIUS_ACCESS_TOKEN: 'retired-instance-pass' });
  t.after(() => { for (const key of ['GENIUS_PROVIDER', 'DEEPSEEK_API_KEY', 'GENIUS_MODEL', 'GENIUS_ACCESS_TOKEN']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  const used = []; const server = createAppServer({ fetchImpl: async (url, options) => { used.push(options.headers?.Authorization || ''); return providerFetch(url, options); } }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; const post = (body, headers = {}) => fetch(base + '/api/genius/agent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ agent: '1C', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: {}, ...body }) });
  const withoutKey = await post({ provider: 'deepseek', model: 'deepseek-flash' }); assert.equal(withoutKey.status, 400); assert.match((await withoutKey.json()).error, /needs a provider API key/); assert.equal(used.length, 0, 'the server key is never used for a web request');
  const retired = await post({ provider: 'deepseek', model: 'deepseek-flash' }, { 'X-Instance-Token': 'retired-instance-pass' }); assert.equal(retired.status, 400); assert.equal(used.length, 0, 'the retired instance password unlocks nothing');
  const own = await post({ provider: 'deepseek', model: 'deepseek-flash', apiKey: 'sk-browser-key-00000000' }); assert.equal(own.status, 200); assert.deepEqual(used, ['Bearer sk-browser-key-00000000']);
  const test = await fetch(base + '/api/provider/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'deepseek', apiKey: 'sk-browser-key-00000000', model: 'deepseek-flash' }) }); assert.equal(test.status, 200); assert.equal((await test.json()).status, 'Connected');
});

test('the Worker exposes the same routes and error shape', async () => {
  const worker = createWorker({ agent: async () => { const error = new (await import('../src/provider-errors.mjs')).ProviderError(502, 'Kimi is busy and is rate limiting requests.', { kind: 'rate_limited', retryable: true }); throw error; }, models: async provider => ({ provider, pair: { fast: { id: 'f' }, advanced: { id: 'a' } }, source: 'bundled' }), test: async provider => ({ provider, status: 'Connected', ok: true }) });
  const call = (path, body) => worker.fetch(new Request(`https://example.test${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), {});
  assert.equal((await (await call('/api/models', { provider: 'kimi' })).json()).source, 'bundled');
  assert.equal((await (await call('/api/provider/test', { provider: 'kimi', apiKey: 'sk-x-000000000000000', model: 'kimi-k3' })).json()).status, 'Connected');
  const busy = await call('/api/genius/agent', { agent: '1A', stage: 'audit', repository: 'acme/demo', commit: commitSHA, payload: {} }); assert.equal(busy.status, 502); assert.equal((await busy.json()).kind, 'rate_limited');
  assert.equal((await call('/api/models', { provider: 'unknown' })).status, 400);
});
