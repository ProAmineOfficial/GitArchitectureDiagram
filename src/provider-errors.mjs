// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVIDER-LAYER-001
// Project: Git Architecture Diagram | Component: Provider calls, error classification, and retries | Author: Amine Saoud ibn al-Bashir.
// One place decides what a provider failure means for the user. Transient 408, 429, and 5xx responses are retried at
// most three attempts in total, honoring Retry-After and otherwise backing off exponentially with jitter. Quota
// exhaustion, authentication, permission, and model errors are never retried. Raw provider payloads are never shown:
// only a few documented machine-readable fields (status, type, code, quota identifiers) are inspected.
import { AppError, boundedJson } from './github.mjs';
import { PROVIDERS, providerRequest, providerOutput } from './providers.mjs';

export const RETRY = { maxAttempts: 3, baseDelayMs: 1000, jitter: 0.25, maxRetryAfterMs: 30000 }; // Attempts in total, not retries.
const RETRYABLE = new Set(['rate_limited', 'provider_unavailable', 'timeout']);

/** A classified provider failure. `kind` is stable for the UI; `message` is safe to display. */
export class ProviderError extends AppError {
  constructor(status, message, { kind, provider = '', model = '', providerStatus = null, retryable = false, retryAfterMs = null, attempts = 1, suggestion = '' } = {}) {
    super(status, message);
    Object.assign(this, { kind, provider, model, providerStatus, retryable, retryAfterMs, attempts, suggestion });
  }
}

const nameOf = provider => PROVIDERS[provider]?.name || 'The AI provider';
const MESSAGES = { // The wording people see; it never includes a key, a raw provider payload, or an internal address.
  invalid_request: (p, s) => `${nameOf(p)} rejected the request (HTTP ${s}). The model may not support structured output for this request.`,
  workspace_required: p => `This ${nameOf(p)} API key is not scoped to a workspace. Create a workspace API key in the Claude Console and paste it here.`,
  auth: p => `API key rejected by ${nameOf(p)}. Check or create a new provider API key.`,
  permission: () => 'The API key is valid but does not have access to this resource/model.',
  model_unavailable: () => 'The selected model is not available for this account.',
  timeout: () => 'Provider did not respond in time.',
  rate_limited: () => 'Rate limit reached. Wait and retry.',
  quota_exhausted: () => 'Provider quota/credits are exhausted.',
  provider_unavailable: p => `${nameOf(p)} is temporarily unavailable.`,
  network: p => `The Git Architecture Diagram server could not reach ${nameOf(p)}.`,
  blocked: (p, s) => `The Git Architecture Diagram server could not reach ${nameOf(p)}: the connection was refused before the key was checked (HTTP ${s}, not a ${nameOf(p)} API response). A firewall or proxy may be blocking it.`,
  malformed: p => `${nameOf(p)} returned an unreadable response.`,
  redirect: (p, s) => `${nameOf(p)} answered with an unexpected redirect (HTTP ${s}); credentials are never forwarded to another address.`,
  cancelled: () => 'The request was cancelled.',
};
const SUGGESTIONS = { // What the person can do next. The application never switches provider or model on its own.
  auth: 'Paste the key again, or create a new key in the provider console.',
  permission: 'Choose the other recommended model, or enable this model for your key.',
  model_unavailable: 'Choose the other recommended model.',
  quota_exhausted: 'Add credit or raise the limit in the provider account, or use another provider.',
  rate_limited: 'Wait a minute and try again, or choose the Fast model.',
  provider_unavailable: 'Try again shortly.',
  invalid_request: 'Choose a recommended model; custom models may not support structured output.',
  workspace_required: 'Workspace keys are created under Settings → API keys in the Claude Console.',
  timeout: 'Try again, choose the Fast model, or narrow the folder scope.',
  network: 'Try again shortly. If it persists, the hosting server may be blocking outbound HTTPS to this provider.',
  blocked: 'Allow outbound HTTPS from the hosting server to the provider\'s API host. The key itself was not tested.',
};

/** Retry delay requested by the provider, in milliseconds: Retry-After (seconds or HTTP date) or Gemini RetryInfo. */
export function retryAfterMs(headers, body, now = Date.now()) {
  const header = headers?.get?.('retry-after');
  if (header) {
    if (/^\d+(\.\d+)?$/.test(header.trim())) return Math.round(Number(header) * 1000);
    const date = Date.parse(header); if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  const ms = headers?.get?.('retry-after-ms'); if (ms && /^\d+$/.test(ms)) return Number(ms);
  const info = (Array.isArray(body?.error?.details) ? body.error.details : []).find(item => String(item?.['@type'] || '').endsWith('RetryInfo'));
  const delay = typeof info?.retryDelay === 'string' ? info.retryDelay.match(/^(\d+(?:\.\d+)?)s$/) : null;
  return delay ? Math.round(Number(delay[1]) * 1000) : null;
}

/** Decide whether a 429 (or 402) means an exhausted quota or a transient rate limit, from documented fields only. */
export function isQuotaExhausted(status, body) {
  if (status === 402) return true; // DeepSeek: insufficient balance.
  const error = body?.error && typeof body.error === 'object' ? body.error : {};
  const code = `${error.code || ''} ${error.type || ''} ${body?.type || ''}`.toLowerCase();
  if (/insufficient_quota|exceeded_current_quota|quota_exceeded|billing_hard_limit|insufficient_balance/.test(code)) return true; // OpenAI, Kimi, and similar error codes.
  const violations = (Array.isArray(error.details) ? error.details : []).filter(item => String(item?.['@type'] || '').endsWith('QuotaFailure')).flatMap(item => item.violations || []);
  if (violations.some(item => /perday|per_day|daily/i.test(`${item.quotaId || ''} ${item.quotaMetric || ''}`))) return true; // Gemini daily quotas do not recover within a retry window.
  if (status === 400 && /credit balance/i.test(String(error.message || ''))) return true; // Anthropic reports exhausted credit as a 400.
  return false;
}

/** Classify an unsuccessful HTTP response into a stable kind. */
export function classifyStatus(provider, status, body, headers, model = '') {
  let kind;
  if (status >= 300 && status < 400) kind = 'redirect';
  else if (status === 402 || (status === 429 && isQuotaExhausted(status, body)) || (status === 400 && isQuotaExhausted(status, body))) kind = 'quota_exhausted';
  else if (status === 400 && /anthropic-workspace-id/i.test(String(body?.error?.message || ''))) kind = 'workspace_required'; // Claude identity-linked keys need a workspace header; the message is inspected, never shown.
  else if (status === 400 || status === 413 || status === 422) kind = 'invalid_request';
  else if ((status === 401 || status === 403) && (body === null || typeof body !== 'object')) kind = 'blocked'; // Provider APIs answer 401/403 with a JSON error; a plain-text or HTML refusal comes from something in between.
  else if (status === 401) kind = 'auth';
  else if (status === 403) kind = 'permission';
  else if (status === 404) kind = 'model_unavailable';
  else if (status === 408) kind = 'timeout';
  else if (status === 429) kind = 'rate_limited';
  else if (status >= 500) kind = 'provider_unavailable'; // Includes Anthropic's 529 "overloaded".
  else kind = 'invalid_request';
  const after = RETRYABLE.has(kind) ? retryAfterMs(headers, body) : null;
  return new ProviderError(502, MESSAGES[kind](provider, status, model), { kind, provider, model, providerStatus: status, retryable: RETRYABLE.has(kind), retryAfterMs: after, suggestion: SUGGESTIONS[kind] || '' });
}

/** Wait for a delay unless the caller cancels. */
export function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason || new Error('aborted')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    const stop = () => { clearTimeout(timer); reject(signal.reason || new Error('aborted')); };
    signal?.addEventListener('abort', stop, { once: true });
  });
}

/** The delay before attempt `attempt + 1`: Retry-After when given, otherwise 1 s, 2 s, 4 s … with ±25% jitter. */
export function backoffDelay(attempt, retryAfter = null, random = Math.random) {
  if (Number.isFinite(retryAfter) && retryAfter !== null) return Math.round(retryAfter + random() * 250);
  const base = RETRY.baseDelayMs * 2 ** (attempt - 1);
  return Math.round(base * (1 - RETRY.jitter + random() * 2 * RETRY.jitter));
}

async function readErrorBody(response) { // Bounded, best-effort JSON of an error response; the text itself is never displayed.
  try { const text = (await response.text()).slice(0, 65536); return JSON.parse(text); } catch { return null; }
}

/**
 * Send one prepared provider request with bounded retries and return the parsed JSON response body.
 * @param {string} provider
 * @param {{url: string, headers: object, body?: object, method?: string}} request
 */
export async function sendProviderRequest(provider, request, { fetchImpl = fetch, signal, timeoutMs = 90000, model = '', sleep = abortableSleep, random = Math.random, onRetry = () => {}, maxAttempts = RETRY.maxAttempts } = {}) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new ProviderError(499, MESSAGES.cancelled(), { kind: 'cancelled', provider, model, attempts: attempt - 1 });
    const timeout = AbortSignal.timeout(timeoutMs); const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await fetchImpl(request.url, { method: request.method || (request.body ? 'POST' : 'GET'), redirect: 'manual', signal: combined, headers: request.headers, ...(request.body ? { body: JSON.stringify(request.body) } : {}) });
    } catch {
      if (signal?.aborted) throw new ProviderError(499, MESSAGES.cancelled(), { kind: 'cancelled', provider, model, attempts: attempt });
      last = timeout.aborted ? new ProviderError(504, MESSAGES.timeout(provider), { kind: 'timeout', provider, model, retryable: true, suggestion: SUGGESTIONS.timeout }) : new ProviderError(502, MESSAGES.network(provider), { kind: 'network', provider, model, suggestion: SUGGESTIONS.network });
      if (!last.retryable || attempt === maxAttempts) { last.attempts = attempt; throw last; }
      const wait = backoffDelay(attempt, null, random); onRetry({ attempt, waitMs: wait, kind: last.kind, message: last.message });
      try { await sleep(wait, signal); } catch { throw new ProviderError(499, MESSAGES.cancelled(), { kind: 'cancelled', provider, model, attempts: attempt }); }
      continue;
    }
    if (response.ok) {
      try { return { data: await boundedJson(response, 4000000), attempts: attempt }; } catch (error) { throw new ProviderError(502, `${MESSAGES.malformed(provider)}${error instanceof AppError ? ` ${error.message}` : ''}`, { kind: 'malformed', provider, model, attempts: attempt }); } // Keep the specific diagnosis, such as an HTML gateway page.
    }
    const body = response.status >= 300 && response.status < 400 ? (await response.body?.cancel().catch(() => {}), null) : await readErrorBody(response);
    last = classifyStatus(provider, response.status, body, response.headers, model); last.attempts = attempt;
    if (!last.retryable || attempt === maxAttempts) {
      throw last;
    }
    if (last.retryAfterMs !== null && last.retryAfterMs > RETRY.maxRetryAfterMs) { last.message = `${last.message} The provider asked to wait ${Math.ceil(last.retryAfterMs / 1000)} seconds; try again later.`; throw last; }
    const wait = backoffDelay(attempt, last.retryAfterMs, random);
    onRetry({ attempt, waitMs: wait, kind: last.kind, status: response.status, message: last.kind === 'rate_limited' ? `${nameOf(provider)} is busy. Retrying in ${Math.max(1, Math.round(wait / 1000))} s.` : `${last.message} Retrying in ${Math.max(1, Math.round(wait / 1000))} s.` });
    try { await sleep(wait, signal); } catch { throw new ProviderError(499, MESSAGES.cancelled(), { kind: 'cancelled', provider, model, attempts: attempt }); }
  }
  throw last;
}

/**
 * Build, send, normalize, and parse one structured provider call.
 * @returns {Promise<{parsed: object, model: string, usage: object|null, attempts: number}>}
 */
export async function callProviderJSON(provider, { apiKey, model, instructions, payload, schema, name, maxTokens }, options = {}) {
  const request = providerRequest(provider, { apiKey, model, instructions, payload, schema, name, maxTokens });
  const { data, attempts } = await sendProviderRequest(provider, request, { ...options, model });
  let output;
  try { output = providerOutput(provider, data); } catch (error) { throw new ProviderError(502, error.message, { kind: error.kind || 'truncated', provider, model, attempts }); }
  const text = String(output.text || '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1'); // JSON mode occasionally wraps output in a fence.
  if (!text) throw new ProviderError(502, `${nameOf(provider)} returned an empty answer. Try again.`, { kind: 'malformed', provider, model, attempts });
  let parsed; try { parsed = JSON.parse(text); } catch { throw new ProviderError(502, 'The AI response could not be parsed. The structural report remains available.', { kind: 'malformed', provider, model, attempts }); }
  return { parsed, model: output.model || model, usage: output.usage || null, attempts };
}

/** A compact, display-safe description of an error for API responses and NDJSON events. */
export function errorInfo(error) {
  if (error instanceof ProviderError) return { message: error.message, kind: error.kind, retryable: error.retryable, providerStatus: error.providerStatus, suggestion: error.suggestion, attempts: error.attempts };
  return { message: error instanceof AppError ? error.message : 'The AI request failed unexpectedly.', kind: 'error' };
}
