// Project: Git Architecture Diagram | Provider layer: five adapters, two recommended models, errors, retries, registry.
// Every provider is exercised with deterministic responses in its documented shape; no paid request is made.
import test from 'node:test'; import assert from 'node:assert/strict';
import { PROVIDERS, MODEL_ROLES, structuredMode, roleOf, checkKeyFormat } from '../public/providers.js';
import { providerRequest, providerOutput, parseModelList, modelListRequest } from '../src/providers.mjs';
import { sendProviderRequest, callProviderJSON, classifyStatus, retryAfterMs, backoffDelay, isQuotaExhausted, RETRY } from '../src/provider-errors.mjs';
import { reducePair, discoverModels, testConnection, bundledPair } from '../src/model-registry.mjs';
import { runAnalysis } from '../src/service.mjs'; import { githubFixture, isGitHubHost } from './fixtures.mjs';

const SCHEMA = { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] };
const KEY = 'sk-test-placeholder-0000000000';
const envelope = (provider, text) => ({ openai: { status: 'completed', model: 'm', output: [{ content: [{ type: 'output_text', text }] }] }, anthropic: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text }] }, gemini: { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text }] } }] }, kimi: { choices: [{ finish_reason: 'stop', message: { content: text, reasoning_content: 'hidden' } }] }, deepseek: { model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { content: text, reasoning_content: 'hidden' } }] } }[provider]);
const HOSTS = { openai: ['api.openai.com', 'authorization'], anthropic: ['api.anthropic.com', 'x-api-key'], gemini: ['generativelanguage.googleapis.com', 'x-goog-api-key'], kimi: ['api.moonshot.ai', 'authorization'], deepseek: ['api.deepseek.com', 'authorization'] };
const noSleep = async () => {};

test('every provider has exactly two verified recommended models: Fast and Advanced', () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['openai', 'anthropic', 'gemini', 'kimi', 'deepseek']);
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    assert.deepEqual(Object.keys(provider.recommended), MODEL_ROLES, id);
    assert.equal(provider.models.length, 2); assert.notEqual(provider.models[0], provider.models[1]);
    for (const role of MODEL_ROLES) { assert.equal(provider.candidates[role][0], provider.recommended[role].id); assert.equal(roleOf(id, provider.recommended[role].id), role); }
    assert.ok(!JSON.stringify(provider).toLowerCase().includes('free'), `${id} must not label a model free`);
  }
  assert.deepEqual(PROVIDERS.deepseek.models, ['deepseek-flash', 'deepseek-v4-pro']);
  assert.equal(roleOf('openai', 'my-custom-model'), 'custom');
});

test('each adapter uses its official endpoint, its own auth header, and keeps the key out of the URL', () => {
  for (const [provider, [host, header]] of Object.entries(HOSTS)) {
    for (const model of PROVIDERS[provider].models) {
      const request = providerRequest(provider, { apiKey: KEY, model, instructions: 'Check.', payload: { a: 1 }, schema: SCHEMA, maxTokens: 500 });
      const url = new URL(request.url); assert.equal(url.hostname, host); assert.equal(url.protocol, 'https:'); assert.ok(!request.url.includes(KEY));
      const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value])); assert.ok(headers[header].includes(KEY), `${provider} ${header}`);
      for (const [name, value] of Object.entries(headers)) if (name !== header) assert.ok(!String(value).includes(KEY), `${provider} leaks the key in ${name}`);
      const mode = structuredMode(provider, model);
      if (mode === 'json_object') { assert.equal(request.body.response_format.type, 'json_object'); assert.match(request.body.messages[0].content, /json/); assert.match(request.body.messages[0].content, /"additionalProperties":false/); }
    }
    const listing = modelListRequest(provider, KEY); assert.equal(new URL(listing.url).hostname, host); assert.ok(!listing.url.includes(KEY));
  }
  assert.equal(structuredMode('kimi', 'kimi-k3'), 'json_schema'); assert.equal(structuredMode('kimi', 'kimi-k2.6'), 'json_object'); assert.equal(structuredMode('deepseek', 'deepseek-v4-pro'), 'json_object');
  const flash = providerRequest('deepseek', { apiKey: KEY, model: 'deepseek-flash', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.deepEqual(flash.body.thinking, { type: 'disabled' }); assert.equal(flash.body.max_tokens, 500);
  const pro = providerRequest('deepseek', { apiKey: KEY, model: 'deepseek-v4-pro', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.deepEqual(pro.body.thinking, { type: 'enabled' }); assert.ok(pro.body.max_tokens > 500);
  const k26 = providerRequest('kimi', { apiKey: KEY, model: 'kimi-k2.6', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.deepEqual(k26.body.thinking, { type: 'disabled' }); assert.equal(k26.body.max_completion_tokens, 500); assert.equal(k26.body.max_tokens, undefined);
  const k3 = providerRequest('kimi', { apiKey: KEY, model: 'kimi-k3', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.equal(k3.body.reasoning_effort, 'low'); assert.equal(k3.body.thinking, undefined); assert.ok(k3.body.max_completion_tokens > 500); assert.equal(k3.body.response_format.json_schema.strict, true); assert.equal(k3.body.temperature, undefined);
  const gem = providerRequest('gemini', { apiKey: KEY, model: 'gemini-3.8-flash', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.equal(gem.body.generationConfig.responseFormat.text.mimeType, 'application/json');
  const claude = providerRequest('anthropic', { apiKey: KEY, model: 'claude-opus-5-5', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.equal(claude.headers['anthropic-version'], '2023-06-01'); assert.deepEqual(claude.body.output_config.format, { type: 'json_schema', schema: SCHEMA });
  const gpt = providerRequest('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA, maxTokens: 500 }); assert.equal(gpt.body.store, false); assert.deepEqual(gpt.body.reasoning, { effort: 'low' }); assert.equal(gpt.body.text.format.strict, true);
  assert.throws(() => providerRequest('constructor', { apiKey: KEY, model: 'm', instructions: '', payload: {}, schema: SCHEMA }), /Choose OpenAI/);
});

test('structured responses normalize to the same JSON for all five providers, without reasoning content', async () => {
  for (const provider of Object.keys(HOSTS)) {
    const result = await callProviderJSON(provider, { apiKey: KEY, model: PROVIDERS[provider].models[0], instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => Response.json(envelope(provider, '{"ok":true}')), sleep: noSleep });
    assert.deepEqual(result.parsed, { ok: true }, provider); assert.equal(result.attempts, 1);
    assert.ok(!providerOutput(provider, envelope(provider, '{"ok":true}')).text.includes('hidden'));
  }
  const fenced = await callProviderJSON('deepseek', { apiKey: KEY, model: 'deepseek-flash', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => Response.json(envelope('deepseek', '```json\n{"ok":true}\n```')) });
  assert.deepEqual(fenced.parsed, { ok: true });
});

test('HTTP failures are classified by status without echoing provider payloads', () => {
  const cases = [[400, 'invalid_request'], [401, 'auth'], [403, 'permission'], [404, 'model_unavailable'], [408, 'timeout'], [429, 'rate_limited'], [500, 'provider_unavailable'], [502, 'provider_unavailable'], [503, 'provider_unavailable'], [504, 'provider_unavailable'], [529, 'provider_unavailable'], [402, 'quota_exhausted']];
  for (const [status, kind] of cases) {
    const error = classifyStatus('gemini', status, { error: { message: 'SECRET-PAYLOAD sk-live-123' } }, new Headers(), 'gemini-3.8-flash');
    assert.equal(error.kind, kind, String(status)); assert.ok(!error.message.includes('SECRET-PAYLOAD')); assert.equal(error.retryable, ['timeout', 'rate_limited', 'provider_unavailable'].includes(kind));
  }
  assert.ok(isQuotaExhausted(429, { error: { code: 'insufficient_quota' } })); // OpenAI
  assert.ok(isQuotaExhausted(429, { error: { type: 'exceeded_current_quota_error' } })); // Kimi
  assert.ok(isQuotaExhausted(429, { error: { status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel' }] }] } })); // Gemini daily quota
  assert.ok(isQuotaExhausted(400, { error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } })); // Anthropic
  assert.ok(!isQuotaExhausted(429, { error: { type: 'rate_limit_error' } }));
  assert.equal(retryAfterMs(new Headers({ 'retry-after': '7' })), 7000);
  assert.equal(retryAfterMs(new Headers(), { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' }] } }), 12000);
  const delays = [1, 2, 3].map(attempt => backoffDelay(attempt, null, () => 0.5)); assert.deepEqual(delays, [1000, 2000, 4000]); // ~1 s, 2 s, 4 s with centered jitter
  assert.ok(backoffDelay(1, null, () => 0) >= 750 && backoffDelay(1, null, () => 1) <= 1250);
});

function scripted(responses) { const calls = []; return { calls, fetchImpl: async (url, options) => { calls.push({ url, options }); const next = responses[Math.min(calls.length - 1, responses.length - 1)]; return typeof next === 'function' ? next() : next; } }; }
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

test('transient 429 honors Retry-After and succeeds on a later attempt', async () => {
  const waits = []; const events = []; const { calls, fetchImpl } = scripted([json(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '2' }), json(200, envelope('anthropic', '{"ok":true}'))]);
  const result = await callProviderJSON('anthropic', { apiKey: KEY, model: 'claude-haiku-4-5-20251001', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl, sleep: async ms => { waits.push(ms); }, random: () => 0, onRetry: event => events.push(event) });
  assert.equal(calls.length, 2); assert.equal(result.attempts, 2); assert.equal(waits[0], 2000); assert.match(events[0].message, /busy\. Retrying in 2 s/);
});

test('retries stop after three attempts in total and say so', async () => {
  const waits = []; const { calls, fetchImpl } = scripted([json(429, {})]);
  await assert.rejects(callProviderJSON('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl, sleep: async ms => { waits.push(ms); }, random: () => 0.5 }), error => { assert.equal(error.kind, 'rate_limited'); assert.equal(error.attempts, RETRY.maxAttempts); assert.equal(error.message, 'Rate limit reached. Wait and retry.'); return true; });
  assert.equal(calls.length, 3); assert.deepEqual(waits, [1000, 2000]);
  const server = scripted([json(503, {}), json(502, {}), json(200, envelope('kimi', '{"ok":true}'))]);
  assert.deepEqual((await callProviderJSON('kimi', { apiKey: KEY, model: 'kimi-k3', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: server.fetchImpl, sleep: noSleep })).parsed, { ok: true }); assert.equal(server.calls.length, 3);
});

test('quota-style 429, authentication, permission, and model errors are never retried', async () => {
  for (const [response, kind] of [[json(429, { error: { code: 'insufficient_quota' } }), 'quota_exhausted'], [json(402, { error: { message: 'Insufficient Balance' } }), 'quota_exhausted'], [json(401, {}), 'auth'], [json(403, {}), 'permission'], [json(404, {}), 'model_unavailable'], [json(400, {}), 'invalid_request']]) {
    const { calls, fetchImpl } = scripted([response]);
    await assert.rejects(callProviderJSON('deepseek', { apiKey: KEY, model: 'deepseek-flash', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl, sleep: noSleep }), error => error.kind === kind);
    assert.equal(calls.length, 1, kind);
  }
  const quota = scripted([json(429, { error: { code: 'insufficient_quota' } })]);
  await assert.rejects(callProviderJSON('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: quota.fetchImpl }), /Provider quota\/credits are exhausted\./);
});

test('a Retry-After longer than 30 seconds is reported instead of waited for', async () => {
  const { calls, fetchImpl } = scripted([json(429, {}, { 'retry-after': '120' })]);
  await assert.rejects(callProviderJSON('gemini', { apiKey: KEY, model: 'gemini-3.8-flash', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl, sleep: noSleep }), /asked to wait 120 seconds/); assert.equal(calls.length, 1);
});

test('timeouts, malformed JSON, truncated output, refusals, and cancellation have clear outcomes', async () => {
  const hang = (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)));
  const keepAlive = setInterval(() => {}, 1000); // AbortSignal.timeout timers do not keep the test process alive by themselves.
  try { await assert.rejects(sendProviderRequest('openai', { url: 'https://api.openai.com/v1/responses', headers: {}, body: {} }, { fetchImpl: hang, timeoutMs: 20, sleep: noSleep }), error => error.kind === 'timeout' && error.attempts === 3); } finally { clearInterval(keepAlive); }
  await assert.rejects(callProviderJSON('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => Response.json(envelope('openai', '{"ok": tru')) }), error => error.kind === 'malformed');
  await assert.rejects(callProviderJSON('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => new Response('not json at all', { status: 200 }) }), error => error.kind === 'malformed');
  for (const [provider, body] of [['openai', { status: 'incomplete' }], ['anthropic', { stop_reason: 'max_tokens' }], ['gemini', { candidates: [{ finishReason: 'MAX_TOKENS' }] }], ['kimi', { choices: [{ finish_reason: 'length' }] }], ['deepseek', { choices: [{ finish_reason: 'length', message: { content: '{"ok":' } }] }]]) await assert.rejects(callProviderJSON(provider, { apiKey: KEY, model: PROVIDERS[provider].models[0], instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => Response.json(body) }), error => error.kind === 'truncated', provider);
  await assert.rejects(callProviderJSON('anthropic', { apiKey: KEY, model: 'claude-opus-5-5', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl: async () => Response.json({ stop_reason: 'refusal', content: [] }) }), error => error.kind === 'refused');
  const controller = new AbortController(); const { calls, fetchImpl } = scripted([json(503, {})]);
  const pending = callProviderJSON('openai', { apiKey: KEY, model: 'gpt-6-luna', instructions: 'x', payload: {}, schema: SCHEMA }, { fetchImpl, signal: controller.signal, sleep: (ms, signal) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted'))); controller.abort(); }) });
  await assert.rejects(pending, error => error.kind === 'cancelled'); assert.equal(calls.length, 1);
});

test('the registry reduces a model list to two verified roles and never adopts unknown models', async () => {
  const pair = reducePair('openai', ['gpt-6.1-sol', 'gpt-6-luna', 'gpt-7-preview-unknown']);
  assert.equal(pair.fast.id, 'gpt-6-luna'); assert.equal(pair.fast.available, true); assert.equal(pair.advanced.id, 'gpt-6.1-sol'); assert.match(pair.advanced.note, /verified alternative/);
  assert.ok(!JSON.stringify(pair).includes('gpt-7-preview-unknown'));
  const missing = reducePair('kimi', ['kimi-k3']); assert.equal(missing.fast.id, 'kimi-k2.6'); assert.equal(missing.fast.available, false);
  assert.deepEqual(parseModelList('gemini', { models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] }] }), ['gemini-3.8-flash']);
  let listings = 0; const fetchImpl = async url => { listings++; assert.equal(new URL(url).hostname, 'api.deepseek.com'); return Response.json({ object: 'list', data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] }); };
  const first = await discoverModels('deepseek', 'sk-discovery-key-1234567890', { fetchImpl }); const second = await discoverModels('deepseek', 'sk-discovery-key-1234567890', { fetchImpl });
  assert.equal(first.source, 'discovered'); assert.equal(second.source, 'cached'); assert.equal(listings, 1); assert.equal(first.pair.advanced.id, 'deepseek-v4-pro');
  const expired = await discoverModels('deepseek', 'sk-discovery-key-1234567890', { fetchImpl: async () => json(503, {}), now: Date.now() + 13 * 3600 * 1000 });
  assert.equal(expired.source, 'cached'); assert.match(expired.warning, /discovery is unavailable\. Using the last verified recommendations/); assert.equal(expired.pair.fast.id, 'deepseek-flash');
  const bundled = await discoverModels('gemini', 'AIza-new-key-without-cache-000', { fetchImpl: async () => json(401, {}) }); assert.equal(bundled.source, 'bundled'); assert.deepEqual(bundled.pair, bundledPair('gemini')); assert.match(bundled.warning, /^Model discovery: API key rejected by Gemini\./);
});

test('the key-format check only warns on documented prefixes and never blocks a pasted key', () => {
  assert.ok(checkKeyFormat('anthropic', 'sk-proj-looks-like-openai-0000').warning); assert.equal(checkKeyFormat('anthropic', 'has spaces').ok, false);
  assert.deepEqual(checkKeyFormat('gemini', 'AQ.new-style-auth-key-000000000'), { ok: true }, 'Gemini auth keys created since 2026-05-28 no longer start with AIza');
  assert.deepEqual(checkKeyFormat('kimi', 'kimi-key-without-documented-prefix'), { ok: true });
  assert.match(checkKeyFormat('deepseek', 'twenty-two-characters!').warning, /DeepSeek keys usually start with sk-/);
});

test('choosing DeepSeek never borrows another provider\'s server key', async () => {
  const fixture = githubFixture({ name: 'deepseek-isolation' });
  const result = await runAnalysis({ repository: 'acme/deepseek-isolation', maxFiles: 1, ai: true, provider: 'deepseek', model: 'deepseek-flash' }, { env: { OPENAI_API_KEY: 'openai-server-placeholder', ANTHROPIC_API_KEY: 'anthropic-placeholder', GENIUS_PROVIDER: 'openai', GENIUS_MODEL: 'gpt-6-luna' }, allowEnvAI: true, fetchImpl: fixture.fetchImpl });
  assert.equal(result.ai, null); assert.ok(result.warnings.some(item => item.includes('no authorized key'))); assert.ok(fixture.requests.every(item => isGitHubHost(item.url)));
});

test('a provider failure leaves the structural report intact and explains the 429', async () => {
  const fixture = githubFixture({ name: 'rate-limited' }); const fetchImpl = async (url, options) => (isGitHubHost(url) ? fixture.fetchImpl(url, options) : json(429, { error: { code: 'insufficient_quota' } }));
  const result = await runAnalysis({ repository: 'acme/rate-limited', maxFiles: 2, ai: true, provider: 'openai', apiKey: KEY, model: 'gpt-6-luna' }, { fetchImpl, cachePublic: false });
  assert.equal(result.ai, null); assert.ok(result.diagrams.architecture); assert.equal(result.aiError.kind, 'quota_exhausted'); assert.equal(result.aiError.providerName, 'OpenAI'); assert.match(result.warnings.join(' '), /quota\/credits are exhausted/);
});
