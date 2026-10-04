// Project: Git Architecture Diagram | Provider connection pipeline: browser key → server → provider → normalized result.
// Every provider is exercised end to end through the real HTTP server with mocked provider responses in each
// provider's documented shape. Keys are obvious placeholders; no paid request is made and nothing is logged.
import test from 'node:test'; import assert from 'node:assert/strict';
import './support/no-autostart.mjs';
import { createAppServer } from '../server.mjs';
import { resolveCredentials } from '../src/providers.mjs';
import { testConnection, CONNECTED_WITHOUT_DISCOVERY, DISCOVERY_UNAVAILABLE } from '../src/model-registry.mjs';

const PROVIDERS = { // Placeholder key, the recommended Fast model, the documented hosts and header, and the inference path.
  openai: { key: 'sk-proj-placeholder-connection-0000', model: 'gpt-6-luna', host: 'api.openai.com', header: 'authorization', value: key => `Bearer ${key}`, list: 'https://api.openai.com/v1/models', inference: 'https://api.openai.com/v1/responses' },
  anthropic: { key: 'sk-ant-api03-placeholder-connection', model: 'claude-haiku-4-5-20251001', host: 'api.anthropic.com', header: 'x-api-key', value: key => key, list: 'https://api.anthropic.com/v1/models?limit=1000', inference: 'https://api.anthropic.com/v1/messages' },
  gemini: { key: 'AQ.placeholder-connection-key-00000', model: 'gemini-3.5-flash-lite', host: 'generativelanguage.googleapis.com', header: 'x-goog-api-key', value: key => key, list: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', inference: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent' },
  kimi: { key: 'sk-kimi-placeholder-connection-000', model: 'kimi-k2.6', host: 'api.moonshot.ai', header: 'authorization', value: key => `Bearer ${key}`, list: 'https://api.moonshot.ai/v1/models', inference: 'https://api.moonshot.ai/v1/chat/completions' },
  deepseek: { key: 'sk-deepseek-placeholder-connection0', model: 'deepseek-flash', host: 'api.deepseek.com', header: 'authorization', value: key => `Bearer ${key}`, list: 'https://api.deepseek.com/models', inference: 'https://api.deepseek.com/chat/completions' },
};
const ok = '{"ok":true}';
const envelope = { openai: { status: 'completed', model: 'm', output: [{ content: [{ type: 'output_text', text: ok }] }] }, anthropic: { stop_reason: 'end_turn', content: [{ type: 'text', text: ok }] }, gemini: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: ok }] } }] }, kimi: { choices: [{ finish_reason: 'stop', message: { content: ok } }] }, deepseek: { choices: [{ finish_reason: 'stop', message: { content: ok } }] } };
const listing = provider => (provider === 'gemini' ? { models: [{ name: `models/${PROVIDERS.gemini.model}`, supportedGenerationMethods: ['generateContent'] }] } : { data: [{ id: PROVIDERS[provider].model }] });
const json = (status, body = {}) => Response.json(body, { status });
const hang = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));

/** A provider double: `list` and `infer` say how each request answers; every request is recorded with lower-cased headers. */
function double(provider, { list = 'ok', infer = 'ok' } = {}) {
  const calls = [];
  const answer = (mode, kind, signal) => {
    if (mode === 'ok') return Response.json(kind === 'list' ? listing(provider) : envelope[provider]);
    if (mode === 'network') throw new TypeError('fetch failed');
    if (mode === 'timeout') return hang(signal);
    if (mode === 'quota') return json(provider === 'deepseek' ? 402 : 429, { error: { code: 'insufficient_quota', type: 'insufficient_quota', message: 'billing sk-should-never-be-shown' } });
    if (mode === 'rate') return json(429, { error: { type: 'rate_limit_error' } });
    return json(mode, { error: { message: 'PROVIDER-PAYLOAD-NEVER-SHOWN' } });
  };
  const fetchImpl = async (url, options) => {
    const kind = options.body ? 'infer' : 'list'; const headers = Object.fromEntries(Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
    calls.push({ url, kind, headers, body: options.body ? JSON.parse(options.body) : null });
    return answer(kind === 'list' ? list : infer, kind, options.signal);
  };
  return { calls, fetchImpl };
}
const quick = { list: 40, inference: 40 }; // Short timeouts for the timeout cases only.
async function withServer(fetchImpl, run) {
  const server = createAppServer({ fetchImpl }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (base, body) => fetch(`${base}/api/provider/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const statuses = result => Object.fromEntries(result.checks.map(check => [check.id, check.status]));

for (const [provider, spec] of Object.entries(PROVIDERS)) {
  test(`${provider}: the browser key reaches the server and the provider with the documented endpoint and header`, async () => {
    const mock = double(provider);
    const result = await withServer(mock.fetchImpl, async base => (await post(base, { provider, apiKey: `  ${spec.key}  `, model: spec.model })).json());
    assert.equal(result.status, 'Connected'); assert.equal(result.ok, true); assert.deepEqual(result.checks.map(check => check.label), ['Authentication', 'Provider reachable', 'Model available', 'Tiny inference']);
    assert.deepEqual(statuses(result), { auth: 'ok', reachable: 'ok', model: 'ok', inference: 'ok' });
    assert.deepEqual(mock.calls.map(call => [call.kind, call.url]), [['list', spec.list], ['infer', spec.inference]]);
    for (const call of mock.calls) { assert.equal(call.headers[spec.header], spec.value(spec.key)); assert.ok(!call.url.includes(spec.key)); }
    assert.equal(result.diagnostics.apiKeyPresent, true); assert.equal(result.diagnostics.keyLength, spec.key.length); assert.equal(result.diagnostics.endpointHost, spec.host);
    assert.deepEqual(result.diagnostics.modelList, { httpStatus: 200, classification: 'ok', listedModels: 1 }); assert.deepEqual(result.diagnostics.inference, { httpStatus: 200, classification: 'ok' });
    assert.ok(!JSON.stringify(result).includes(spec.key), 'the key never comes back');
    assert.deepEqual(resolveCredentials({ provider, apiKey: spec.key, model: spec.model }), { provider, apiKey: spec.key, model: spec.model });
  });

  test(`${provider}: a failed model list with a working tiny inference is a success`, async () => {
    for (const list of [401, 403, 404, 500, 'network']) {
      const mock = double(provider, { list });
      const result = await testConnection(provider, { apiKey: spec.key, model: spec.model, fetchImpl: mock.fetchImpl });
      assert.equal(result.status, 'Connected', `list ${list}`); assert.equal(result.ok, true); assert.equal(result.message, CONNECTED_WITHOUT_DISCOVERY); assert.deepEqual(result.discovery, { available: false, message: DISCOVERY_UNAVAILABLE });
      assert.equal(statuses(result).auth, 'ok', 'only a failed inference can fail authentication');
    }
  });

  test(`${provider}: 401, 403, 404, 429, quota, 5xx, timeout, and network failures are classified with the documented wording`, async () => {
    const name = { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini', kimi: 'Kimi', deepseek: 'DeepSeek' }[provider];
    const cases = [
      [{ list: 401, infer: 401 }, 'Authentication failed', `API key rejected by ${name}. Check or create a new provider API key.`, { auth: 'fail' }],
      [{ list: 403, infer: 403 }, 'Access denied', 'The API key is valid but does not have access to this resource/model.', { auth: 'warn', reachable: 'ok' }],
      [{ list: 'ok', infer: 404 }, 'Model unavailable', 'The selected model is not available for this account.', { auth: 'ok', model: 'fail' }],
      [{ list: 'ok', infer: 'rate' }, 'Rate limited', 'Rate limit reached. Wait and retry.', { auth: 'ok' }],
      [{ list: 'ok', infer: 'quota' }, 'Quota exhausted', 'Provider quota/credits are exhausted.', { auth: 'ok' }],
      [{ list: 503, infer: 503 }, 'Provider temporarily unavailable', `${name} is temporarily unavailable.`, { reachable: 'ok', inference: 'fail' }],
      [{ list: 'timeout', infer: 'timeout' }, 'Provider did not respond in time', 'Provider did not respond in time.', { reachable: 'fail' }],
      [{ list: 'network', infer: 'network' }, 'Provider unreachable', `The Git Architecture Diagram server could not reach ${name}.`, { reachable: 'fail' }],
    ];
    const keepAlive = setInterval(() => {}, 10); // AbortSignal.timeout timers do not keep the test process alive on their own.
    try {
      for (const [modes, status, message, rows] of cases) {
        const mock = double(provider, modes);
        const result = await testConnection(provider, { apiKey: spec.key, model: spec.model, fetchImpl: mock.fetchImpl, timeouts: quick });
        assert.equal(result.status, status, JSON.stringify(modes)); assert.equal(result.ok, false); assert.equal(result.message, message);
        for (const [id, state] of Object.entries(rows)) assert.equal(statuses(result)[id], state, `${status}: ${id}`);
        const text = JSON.stringify(result); assert.ok(!text.includes('PROVIDER-PAYLOAD') && !text.includes('sk-should-never') && !text.includes(spec.key));
        assert.equal(mock.calls.filter(call => call.kind === 'infer').length, 1, 'connection checks are never retried');
      }
    } finally { clearInterval(keepAlive); }
  });
}

test('authentication fails only on an actual 401: a 403 model list or a network error never says "Authentication failed"', async () => {
  const forbiddenList = await testConnection('openai', { apiKey: PROVIDERS.openai.key, model: 'gpt-6-luna', fetchImpl: double('openai', { list: 403, infer: 'ok' }).fetchImpl });
  assert.equal(forbiddenList.status, 'Connected', 'a restricted OpenAI key without Models permission still works');
  const network = await testConnection('deepseek', { apiKey: PROVIDERS.deepseek.key, model: 'deepseek-flash', fetchImpl: double('deepseek', { list: 'network', infer: 'network' }).fetchImpl });
  assert.notEqual(network.status, 'Authentication failed'); assert.equal(network.kind, 'network');
});

test('a key that does not look like the provider\'s is diagnosed without revealing it, and a missing key never calls the provider', async () => {
  const autofilled = 'saved-site-password-22'; const mock = double('deepseek', { list: 401, infer: 401 });
  const result = await testConnection('deepseek', { apiKey: autofilled, model: 'deepseek-flash', fetchImpl: mock.fetchImpl });
  assert.equal(result.status, 'Authentication failed'); assert.match(result.keyNote, /DeepSeek keys usually start with sk-/); assert.match(result.keyNote, /22 characters/); assert.match(result.keyNote, /saved password/);
  assert.equal(result.diagnostics.keyPrefixMatches, false); assert.ok(!JSON.stringify(result).includes(autofilled));
  const none = double('openai'); const missing = await testConnection('openai', { apiKey: '', model: 'gpt-6-luna', fetchImpl: none.fetchImpl });
  assert.equal(missing.status, 'API key missing'); assert.equal(missing.diagnostics.apiKeyPresent, false); assert.equal(none.calls.length, 0);
});

test('a Claude key that is not scoped to a workspace is explained, not reported as a structured-output problem', async () => {
  const fetchImpl = async (url, options) => (options.body ? json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'anthropic-workspace-id is required when authenticating with an identity-linked API key; send the id of the workspace this request acts in.' } }) : Response.json(listing('anthropic')));
  const result = await testConnection('anthropic', { apiKey: PROVIDERS.anthropic.key, model: 'claude-haiku-4-5-20251001', fetchImpl });
  assert.equal(result.status, 'Workspace API key required'); assert.match(result.message, /not scoped to a workspace/);
});

test('a model that answers without the requested JSON is reported as a structured-output problem', async () => {
  const fetchImpl = async (url, options) => (options.body ? Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"ready":"yes"}' } }] }) : Response.json(listing('deepseek')));
  const result = await testConnection('deepseek', { apiKey: PROVIDERS.deepseek.key, model: 'deepseek-flash', fetchImpl });
  assert.equal(result.status, 'Request rejected'); assert.equal(result.ok, false); assert.match(result.message, /structured output/);
});

test('switching providers never reuses a key: the server takes only the key sent with this request', () => {
  assert.deepEqual(resolveCredentials({ provider: 'gemini' }), { provider: 'gemini', apiKey: '', model: '' });
  assert.throws(() => resolveCredentials({ provider: '__proto__', apiKey: 'x' }), /Choose OpenAI/);
  assert.throws(() => resolveCredentials({ provider: 'openai', apiKey: 'x'.repeat(1100) }), /too long/);
});
