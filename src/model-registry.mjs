// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVIDER-LAYER-001
// Project: Git Architecture Diagram | Component: Provider model registry and connection test | Author: Amine Saoud ibn al-Bashir.
// The registry keeps model choices current without inventing IDs: it reads the provider's official model list for a
// key, then reduces it to exactly two roles (fast, advanced) by picking the first verified candidate that the key can
// use. Discovery results are cached for 12 hours per provider and key fingerprint; if discovery fails, the last known
// verified pair (or the bundled pair) stays in use. Unknown models are never promoted into the normal interface.
import { PROVIDERS, MODEL_ROLES, ROLE_LABELS, CATALOG_CHECKED, checkKeyFormat, structuredMode } from '../public/providers.js';
import { AppError } from './github.mjs';
import { modelListRequest, parseModelList, endpointHosts } from './providers.mjs';
import { sendProviderRequest, callProviderJSON, ProviderError, errorInfo } from './provider-errors.mjs';

export const DISCOVERY_TTL_MS = 12 * 60 * 60 * 1000;
export const DISCOVERY_UNAVAILABLE = 'Connected, but live model discovery is unavailable. Using bundled verified recommendations.';
export const CONNECTED_WITHOUT_DISCOVERY = 'Connected. Model discovery was unavailable, so the verified bundled model pair is being used.';
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
    const info = errorInfo(error); const warning = info.kind === 'auth' ? `Model discovery: ${info.message}` : `Live model discovery is unavailable. Using the ${hit ? 'last verified' : 'bundled verified'} recommendations.`; // Only a real 401 is called a key problem.
    return { provider, pair: fallback, source: hit ? 'cached' : 'bundled', checkedAt: hit?.checkedAt || CATALOG_CHECKED, warning, kind: info.kind };
  }
}

const STATUS = { auth: 'Authentication failed', permission: 'Access denied', workspace_required: 'Workspace API key required', model_unavailable: 'Model unavailable', rate_limited: 'Rate limited', quota_exhausted: 'Quota exhausted', provider_unavailable: 'Provider temporarily unavailable', network: 'Provider unreachable', timeout: 'Provider did not respond in time', invalid_request: 'Request rejected', malformed: 'Unexpected provider response', truncated: 'Unexpected provider response', refused: 'Unexpected provider response', redirect: 'Unexpected provider response', cancelled: 'Cancelled' };
const PROBE_SCHEMA = { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] };
const MESSAGES_TIMEOUT = 'Provider did not respond in time.';
const PROBE_TOKENS = 1024; // Room for a few tokens of JSON plus brief reasoning on models that always reason; only used tokens are billed.
const ACCEPTED_KEY = new Set(['model_unavailable', 'rate_limited', 'quota_exhausted', 'invalid_request', 'malformed', 'truncated', 'refused', 'workspace_required']); // The provider processed the key, then refused for another reason.

/** Safe description of one provider check: HTTP status and classification only. */
function outcome(error) { const info = errorInfo(error); return { ok: false, kind: info.kind, httpStatus: error instanceof ProviderError ? error.providerStatus : null, message: info.message, suggestion: info.suggestion || '' }; }

/**
 * Test a key and model with two independent checks, and report four rows: Authentication, Provider reachable,
 * Model available, and Tiny inference.
 *   A. The official model list (authentication and discovery). It is optional: many keys cannot list models.
 *   B. One tiny structured request that must return {"ok": true}. This decides the result.
 * A failed model list with a working inference is a success. Authentication is reported as failed only when the
 * provider actually answered 401 (403 means the key is valid but lacks access). The response carries safe
 * diagnostics — provider, model, whether a key arrived and its length, endpoint hosts, HTTP statuses, and the
 * classification — and never the key or an authorization header.
 */
export async function testConnection(provider, { apiKey = '', model = '', fetchImpl = fetch, signal, now = () => Date.now(), timeouts = { list: 15000, inference: 45000 } } = {}) {
  assertProvider(provider);
  const started = now(); const name = PROVIDERS[provider].name; const key = String(apiKey || ''); const hosts = endpointHosts(provider, model || 'model');
  const diagnostics = { provider, model, apiKeyPresent: Boolean(key), keyLength: key.length, keyPrefixMatches: PROVIDERS[provider].keyPrefix ? key.startsWith(PROVIDERS[provider].keyPrefix) : null, endpointHost: hosts.inference, modelListHost: hosts.modelList, modelList: null, inference: null, classification: null, durationMs: 0 };
  const row = (id, label) => ({ id, label, status: 'skip', detail: 'Not checked' });
  const checks = { auth: row('auth', 'Authentication'), reachable: row('reachable', 'Provider reachable'), model: row('model', 'Model available'), inference: row('inference', 'Tiny inference') };
  const set = (id, status, detail) => Object.assign(checks[id], { status, detail });
  const finish = (ok, status, extra = {}) => { diagnostics.durationMs = now() - started; diagnostics.classification = ok ? 'connected' : extra.kind || 'error'; return { provider, providerName: name, model, ok, status, checks: Object.values(checks), diagnostics, ...extra }; };
  const format = checkKeyFormat(provider, key);
  if (!format.ok) { set('auth', 'fail', format.message); return finish(false, key ? 'Authentication failed' : 'API key missing', { kind: key ? 'auth' : 'missing_key', message: format.message, suggestion: `Paste your ${name} API key.` }); }
  const keyNote = format.warning ? `${format.warning} The key received by the server is ${key.length} characters long. If your browser filled in a saved password, clear the field and paste the provider key.` : '';
  if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(model)) { set('model', 'fail', 'Choose a model'); return finish(false, 'Model unavailable', { kind: 'model_unavailable', message: 'Choose one of the two recommended models, or enter a custom model ID.', keyNote }); }

  // A. Model list: authentication and discovery. A failure here is recorded, never final.
  let listed = null; let list = null;
  try { const { data } = await sendProviderRequest(provider, modelListRequest(provider, key), { fetchImpl, signal, timeoutMs: timeouts.list, maxAttempts: 1 }); listed = parseModelList(provider, data); list = { ok: true, httpStatus: 200, kind: 'ok', listedModels: listed.length }; }
  catch (error) { if (error instanceof ProviderError && error.kind === 'cancelled') throw error; list = outcome(error); }
  diagnostics.modelList = { httpStatus: list.httpStatus, classification: list.kind, ...(list.listedModels !== undefined ? { listedModels: list.listedModels } : {}) };

  // B. Tiny inference: the check that decides.
  let probe;
  try {
    const { parsed } = await callProviderJSON(provider, { apiKey: key, model, instructions: 'Connection check. Return the JSON object {"ok": true}.', payload: { check: 'connection' }, schema: PROBE_SCHEMA, name: 'connection_check', maxTokens: PROBE_TOKENS }, { fetchImpl, signal, timeoutMs: timeouts.inference, maxAttempts: 1 });
    probe = parsed?.ok === true ? { ok: true, httpStatus: 200, kind: 'ok' } : { ok: false, httpStatus: 200, kind: 'invalid_request', message: `${name} answered, but not with the requested JSON. This model may not support the structured output Genius needs.`, suggestion: 'Choose one of the two recommended models.' };
  } catch (error) { if (error instanceof ProviderError && error.kind === 'cancelled') throw error; probe = outcome(error); }
  diagnostics.inference = { httpStatus: probe.httpStatus, classification: probe.kind };

  const answered = result => result.ok || Number.isInteger(result.httpStatus); // Any HTTP answer proves the server reached the provider.
  set('reachable', answered(list) || answered(probe) ? 'ok' : 'fail', answered(list) || answered(probe) ? `${hosts.inference} answered` : (probe.kind === 'timeout' ? MESSAGES_TIMEOUT : `The Git Architecture Diagram server could not reach ${name}.`));
  if (probe.ok) {
    set('auth', 'ok', 'Key accepted'); set('inference', 'ok', structuredMode(provider, model) === 'json_schema' ? 'Returned {"ok": true} with a strict JSON schema' : 'Returned {"ok": true} in JSON mode');
    set('model', 'ok', listed?.includes(model) ? 'Listed for this key and answering' : 'Answering');
    const discovery = list.ok ? '' : CONNECTED_WITHOUT_DISCOVERY;
    return finish(true, 'Connected', { message: discovery || `${name} accepted the key and ${model} answered.`, discovery: { available: list.ok, ...(list.ok ? { listedModels: listed.length } : { message: DISCOVERY_UNAVAILABLE }) }, keyNote });
  }
  const unauthorized = [list, probe].some(result => result.httpStatus === 401); const forbidden = probe.httpStatus === 403;
  if (probe.kind === 'auth' || (unauthorized && !list.ok && !ACCEPTED_KEY.has(probe.kind))) set('auth', 'fail', `${name} answered HTTP 401`);
  else if (forbidden) set('auth', 'warn', 'Key accepted, but it lacks access (HTTP 403)');
  else if (list.ok || ACCEPTED_KEY.has(probe.kind)) set('auth', 'ok', 'Key accepted');
  if (probe.kind === 'model_unavailable') set('model', 'fail', `${model} is not available for this account (HTTP ${probe.httpStatus})`);
  else if (listed?.includes(model)) set('model', 'ok', 'Listed for this key');
  else if (listed?.length) set('model', 'warn', `${model} is not listed for this key`);
  set('inference', 'fail', probe.message);
  const kind = checks.auth.status === 'fail' ? 'auth' : probe.kind;
  const info = kind === probe.kind ? probe : outcome(Object.assign(new ProviderError(502, `API key rejected by ${name}. Check or create a new provider API key.`, { kind: 'auth', provider, providerStatus: 401, suggestion: 'Paste the key again, or create a new key in the provider console.' })));
  return finish(false, STATUS[kind] || 'Provider temporarily unavailable', { kind, message: info.message, suggestion: info.suggestion, providerStatus: info.httpStatus, keyNote });
}
