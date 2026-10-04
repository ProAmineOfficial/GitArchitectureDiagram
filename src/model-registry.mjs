// Project: Git Architecture Diagram | Component: Provider model registry and connection test | Author: Amine Saoud ibn al-Bashir.
// The registry keeps model choices current without inventing IDs: it reads the provider's official model list for a
// key, then reduces it to exactly two roles (fast, advanced) by picking the first verified candidate that the key can
// use. Discovery results are cached for 12 hours per provider and key fingerprint; if discovery fails, the last known
// verified pair (or the bundled pair) stays in use. Unknown models are never promoted into the normal interface.
import { PROVIDERS, MODEL_ROLES, ROLE_LABELS, CATALOG_CHECKED, checkKeyFormat, structuredMode } from '../public/providers.js';
import { AppError } from './github.mjs';
import { modelListRequest, parseModelList } from './providers.mjs';
import { sendProviderRequest, callProviderJSON, ProviderError, errorInfo } from './provider-errors.mjs';

export const DISCOVERY_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map(); // provider|fingerprint → { pair, listed, checkedAt, expires }

/** A short, irreversible fingerprint so cache keys never contain a key. */
export async function keyFingerprint(apiKey) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(apiKey)));
  return [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function assertProvider(provider) { if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Choose OpenAI, Claude, Gemini, Kimi, or DeepSeek.'); }

/** The bundled, documentation-verified pair. */
export function bundledPair(provider) {
  assertProvider(provider);
  return Object.fromEntries(MODEL_ROLES.map(role => [role, { role, label: ROLE_LABELS[role], id: PROVIDERS[provider].recommended[role].id, note: PROVIDERS[provider].recommended[role].note, structured: structuredMode(provider, PROVIDERS[provider].recommended[role].id), available: null }]));
}

/** Reduce a provider's model list to exactly two recommended models, choosing only verified candidates. */
export function reducePair(provider, ids) {
  const listed = new Set(ids); const pair = bundledPair(provider);
  for (const role of MODEL_ROLES) {
    const pick = PROVIDERS[provider].candidates[role].find(id => listed.has(id));
    if (pick) Object.assign(pair[role], { id: pick, available: true, note: pick === PROVIDERS[provider].recommended[role].id ? pair[role].note : `${pair[role].note} Your key lists ${pick} instead, a verified alternative.`, structured: structuredMode(provider, pick) });
    else pair[role].available = false; // Keep the verified ID, but say the key does not list it.
  }
  return pair;
}

/**
 * Recommended models for a provider, refreshed from the official list when a key is supplied.
 * @returns {Promise<{provider: string, pair: object, source: 'bundled'|'discovered'|'cached', checkedAt: string, listedModels?: number, warning?: string}>}
 */
export async function discoverModels(provider, apiKey, { fetchImpl = fetch, signal, now = Date.now() } = {}) {
  assertProvider(provider);
  if (!apiKey) return { provider, pair: bundledPair(provider), source: 'bundled', checkedAt: CATALOG_CHECKED };
  const key = `${provider}|${await keyFingerprint(apiKey)}`; const hit = cache.get(key);
  if (hit && hit.expires > now) return { provider, pair: structuredClone(hit.pair), source: 'cached', checkedAt: hit.checkedAt, listedModels: hit.listed };
  try {
    const { data } = await sendProviderRequest(provider, modelListRequest(provider, apiKey), { fetchImpl, signal, timeoutMs: 15000, maxAttempts: 2 });
    const ids = parseModelList(provider, data); const pair = reducePair(provider, ids); const checkedAt = new Date(now).toISOString();
    cache.set(key, { pair: structuredClone(pair), listed: ids.length, checkedAt, expires: now + DISCOVERY_TTL_MS });
    while (cache.size > 500) cache.delete(cache.keys().next().value);
    return { provider, pair, source: 'discovered', checkedAt, listedModels: ids.length };
  } catch (error) {
    const fallback = hit ? structuredClone(hit.pair) : bundledPair(provider); // Last known verified pair, or the bundled pair.
    return { provider, pair: fallback, source: hit ? 'cached' : 'bundled', checkedAt: hit?.checkedAt || CATALOG_CHECKED, warning: `Model discovery failed: ${errorInfo(error).message} Using the ${hit ? 'last verified' : 'bundled'} recommendations.` };
  }
}

const STATUS = { auth: 'Authentication failed', permission: 'Access denied', model_unavailable: 'Model unavailable', rate_limited: 'Rate limited', quota_exhausted: 'Quota exhausted', provider_unavailable: 'Provider temporarily unavailable', network: 'Provider temporarily unavailable', timeout: 'Provider temporarily unavailable', invalid_request: 'Structured output not supported', malformed: 'Unexpected provider response', truncated: 'Unexpected provider response', refused: 'Unexpected provider response', redirect: 'Unexpected provider response', cancelled: 'Cancelled' };
const PROBE_SCHEMA = { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] };

/**
 * Test a key and model: key format, endpoint and authentication, model availability, and the structured-output
 * capability Genius needs. Sends one model-list request and one tiny structured request (a few tokens).
 */
export async function testConnection(provider, { apiKey, model, fetchImpl = fetch, signal } = {}) {
  assertProvider(provider);
  const checks = []; const add = (id, status, label) => checks.push({ id, status, label });
  const done = (ok, statusText, extra = {}) => ({ provider, providerName: PROVIDERS[provider].name, model, ok, status: statusText, checks, ...extra });
  const format = checkKeyFormat(provider, apiKey);
  if (!format.ok) { add('key', 'fail', format.message); return done(false, 'Authentication failed', { kind: 'auth' }); }
  add('key', format.warning ? 'warn' : 'ok', format.warning || 'Key format looks valid');
  if (typeof model !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(model)) { add('model', 'fail', 'Choose a model'); return done(false, 'Model unavailable', { kind: 'model_unavailable' }); }
  try {
    const { data } = await sendProviderRequest(provider, modelListRequest(provider, apiKey), { fetchImpl, signal, timeoutMs: 15000, maxAttempts: 1 });
    add('endpoint', 'ok', `${PROVIDERS[provider].name} endpoint responded and accepted the key`);
    const ids = parseModelList(provider, data);
    if (ids.includes(model)) add('model', 'ok', 'Model available');
    else if (ids.length) { add('model', 'fail', `${model} is not listed for this key`); return done(false, 'Model unavailable', { kind: 'model_unavailable', suggestion: 'Choose the other recommended model.' }); }
    else add('model', 'warn', 'The provider did not list models; checking with a request');
  } catch (error) {
    const info = errorInfo(error);
    if (!(error instanceof ProviderError) || !['model_unavailable', 'invalid_request'].includes(error.kind)) { add('endpoint', 'fail', info.message); return done(false, STATUS[info.kind] || 'Provider temporarily unavailable', info); }
    add('endpoint', 'warn', 'The model list is not available; checking with a request'); // Some accounts cannot list models; the probe decides.
  }
  try {
    const { parsed } = await callProviderJSON(provider, { apiKey, model, instructions: 'Connection check. Return the JSON object {"ok": true}.', payload: { check: 'connection' }, schema: PROBE_SCHEMA, name: 'connection_check', maxTokens: 400 }, { fetchImpl, signal, timeoutMs: 45000, maxAttempts: 1 });
    if (parsed?.ok !== true) { add('structured', 'fail', 'The model did not return the requested JSON'); return done(false, 'Structured output not supported', { kind: 'invalid_request' }); }
    add('structured', 'ok', structuredMode(provider, model) === 'json_schema' ? 'Strict JSON schema output works' : 'JSON mode output works');
    if (!checks.some(check => check.id === 'model' && check.status === 'ok')) add('model', 'ok', 'Model available');
    return done(true, 'Connected');
  } catch (error) {
    const info = errorInfo(error); add('structured', 'fail', info.message);
    return done(false, STATUS[info.kind] || 'Provider temporarily unavailable', info);
  }
}
