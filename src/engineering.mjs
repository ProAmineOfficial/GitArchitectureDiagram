// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI: the public interface to the private
// Genius Engineering Engine.
//
// The engine is a separate, private service configured by the operator (GENIUS_ENGINE_URL, GENIUS_ENGINE_TOKEN).
// It never receives the visitor's provider key: it returns generation requests, this server runs each one with the
// visitor's key through the existing provider layer (fixed provider endpoints only), and sends the model output back.
// Without a configured, authorized engine, every engineering run answers 503 before anything is sent, and the
// workspace offers the labeled example. Status distinguishes configured from operational (authenticated readiness).
import { createHmac } from 'node:crypto';
import { AppError } from './github.mjs';
import { PROVIDERS } from './providers.mjs';
import { callProviderJSON } from './provider-errors.mjs';
import { PROJECT_SCHEMA } from '../public/engineering.js';

export const ENGINEERING_STAGES = ['clarify', 'design', 'regenerate'];
const MAX_STEPS = 6; // clarify: 1–2 calls; design: 2–4; regenerate: 1–2. Anything longer is refused.
const ENGINE_TIMEOUT_MS = 30000; // The engine does no model work, so its answers are quick.
const PROVIDER_TIMEOUT_MS = 180000; // File generation can take minutes on slower models.
const MAX_ENGINE_BYTES = 3_500_000;
const MIN_TOKEN_LENGTH = 32;
const READY_TIMEOUT_MS = 5000; // Readiness is a tiny authenticated request.
const READY_TTL_MS = { operational: 60000, other: 15000 }; // Public status requests never cause more than one engine call per window.
const COLD_START_RETRY_MS = 1500; // A sleeping host (Railway serverless) can refuse the first request while it boots.

// ——— The service token ———
// The same rules run in the private engine (engine/auth.mjs); both test suites use tests/fixtures/token-cases.json.
// Nothing here returns, logs, or throws the token itself.

/** Normalize a service token: trims, ignores one pair of surrounding quotes and a "Bearer " prefix, refuses inner whitespace or quotes. */
export function normalizeServiceToken(value, name = 'GENIUS_ENGINE_TOKEN') {
  let token = String(value ?? '').trim(); const notes = [];
  if (!token) return { ok: false, problem: `${name} is not set.` };
  const quoted = token.match(/^(["'`])([\s\S]*)\1$/); if (quoted) { token = quoted[2].trim(); notes.push('surrounding quotes'); }
  if (/^bearer\s+/i.test(token)) { token = token.replace(/^bearer\s+/i, ''); notes.push('a "Bearer " prefix'); }
  if (/\s/.test(token)) return { ok: false, problem: `${name} contains spaces or line breaks inside the value. Paste the token as a single line.` };
  if (/["'`]/.test(token)) return { ok: false, problem: `${name} contains quote characters inside the value.` };
  if (token.length < MIN_TOKEN_LENGTH) return { ok: false, problem: `${name} must be at least ${MIN_TOKEN_LENGTH} characters.` };
  return { ok: true, token, notes };
}

/** A one-way, 8-hex fingerprint of the token. The engine prints the same value at start-up when the tokens match. */
export function engineKeyId(token) { return createHmac('sha256', String(token)).update('gad-engine-key-id').digest('hex').slice(0, 8); }

/** Check the operator's settings. Returns { ok: true, config } or { ok: false, problem } (the problem names variables, never values). */
export function inspectEngineConfig(env = process.env) {
  const url = String(env.GENIUS_ENGINE_URL || '').trim().replace(/\/+$/, '');
  if (!url && !String(env.GENIUS_ENGINE_TOKEN || '').trim()) return { ok: false, problem: 'GENIUS_ENGINE_URL and GENIUS_ENGINE_TOKEN are not set.' };
  if (!url) return { ok: false, problem: 'GENIUS_ENGINE_URL is not set.' };
  let parsed; try { parsed = new URL(url); } catch { return { ok: false, problem: 'GENIUS_ENGINE_URL is not a valid URL.' }; }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))) return { ok: false, problem: 'GENIUS_ENGINE_URL must use HTTPS (HTTP only for localhost) and contain no credentials.' };
  const token = normalizeServiceToken(env.GENIUS_ENGINE_TOKEN);
  if (!token.ok) return { ok: false, problem: token.problem };
  return { ok: true, config: { url, token: token.token, keyId: engineKeyId(token.token), notes: token.notes } };
}

/** The operator's engine settings, or null when the engine is not configured. Only HTTPS (or localhost for development). */
export function engineConfig(env = process.env) { const inspected = inspectEngineConfig(env); return inspected.ok ? inspected.config : null; }

/** One start-up line for the server log: the key id when configured, the problem otherwise. Never a value. */
export function describeEngineConfig(env = process.env) {
  const inspected = inspectEngineConfig(env);
  if (!inspected.ok) return `[engine] not configured: ${inspected.problem}`;
  const { config } = inspected; return `[engine] configured · key id ${config.keyId}${config.notes.length ? ` · ignored ${config.notes.join(' and ')} around GENIUS_ENGINE_TOKEN` : ''} · compare the key id with the engine's start-up line`;
}

// ——— Authenticated readiness ———
// "Configured" is not "working": readiness makes one authenticated POST /v1/ready and reports one of
// not_configured · unreachable · unauthorized · unavailable · unverified (engine older than 0.1.1) · operational.

/** A readiness cache. Each server keeps its own, so tests and runtimes never share results. */
export function createReadinessCache(ttl = READY_TTL_MS) { return { key: '', at: 0, result: null, pending: null, logged: '', ttl }; }
const defaultReadiness = createReadinessCache();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probeReadiness(config, { fetchImpl, retryDelayMs }) {
  const attempt = async () => {
    let response;
    try { response = await fetchImpl(`${config.url}/v1/ready`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, body: '{}', signal: AbortSignal.timeout(READY_TIMEOUT_MS), redirect: 'manual' }); }
    catch { return { state: 'unreachable', detail: 'no response' }; }
    let body = null; try { body = await response.json(); } catch { /* A host error page is not JSON. */ }
    if (response.ok && body?.ok === true) return { state: 'operational', version: typeof body.version === 'string' ? body.version.slice(0, 20) : '' };
    if (response.status === 401 || response.status === 403) return { state: 'unauthorized', detail: `reason=${String(body?.error?.reason || 'unknown').slice(0, 20)}` };
    if (response.status === 404 && body?.error?.kind === 'not_found') return { state: 'unverified', detail: 'the engine has no /v1/ready; it is older than 0.1.1' };
    if ([502, 503, 504].includes(response.status) && !body?.error) return { state: 'unreachable', detail: `HTTP ${response.status} from the host` };
    return { state: 'unavailable', detail: `HTTP ${response.status}` };
  };
  let result = await attempt();
  if (result.state === 'unreachable') { await wait(retryDelayMs); result = await attempt(); }
  return result;
}

/** The engine's state, cached (60 s when operational, 15 s otherwise). Logs state changes with the key id, never the token. */
export async function engineReadiness({ env = process.env, fetchImpl = fetch, cache = defaultReadiness, now = Date.now, log = line => console.info(line), force = false, retryDelayMs = COLD_START_RETRY_MS } = {}) {
  const inspected = inspectEngineConfig(env);
  if (!inspected.ok) return { state: 'not_configured', checkedAt: new Date(now()).toISOString() };
  const { config } = inspected; const key = `${config.url}|${config.keyId}`;
  if (cache.key !== key) Object.assign(cache, createReadinessCache(cache.ttl), { key });
  const ttl = cache.result?.state === 'operational' ? cache.ttl.operational : cache.ttl.other;
  if (!force && cache.result && now() - cache.at < ttl) return cache.result;
  if (cache.pending) return cache.pending;
  cache.pending = probeReadiness(config, { fetchImpl, retryDelayMs }).then(found => {
    const result = { state: found.state, checkedAt: new Date(now()).toISOString(), ...(found.version ? { version: found.version } : {}) };
    const line = `[engine] ${found.state} · key id ${config.keyId}${found.version ? ` · engine ${found.version}` : ''}${found.detail ? ` · ${found.detail}` : ''}`;
    if (line !== cache.logged && !process.env.NODE_TEST_CONTEXT) log(line); cache.logged = line; // Operator detail stays in the server log.
    cache.result = result; cache.at = now(); cache.pending = null; return result;
  }, () => { cache.pending = null; return { state: 'unavailable', checkedAt: new Date(now()).toISOString() }; });
  return cache.pending;
}

/** Forget the cached state, for example after the engine refused a run. */
export function resetEngineReadiness(cache = defaultReadiness) { Object.assign(cache, createReadinessCache(cache.ttl)); }

/** Public status. The URL, token, key id, and refusal reasons are never revealed. `connected` is kept for older pages. */
export async function engineeringStatus(env = process.env, options = {}) {
  const { state, checkedAt } = await engineReadiness({ env, ...options });
  return { state, configured: state !== 'not_configured', operational: state === 'operational', connected: state === 'operational' || state === 'unverified', checkedAt };
}

/** What a visitor is told for each state that blocks a run. The operator's detail is in the server log. */
export const STATE_MESSAGES = {
  not_configured: 'Genius AI generation is not set up on this site yet. You can open the example project.',
  unreachable: 'The Genius Engineering Engine is not reachable right now. Try again in a minute.',
  unauthorized: 'Genius AI generation is unavailable: this site\'s server is not authorized by its Genius Engineering Engine. This is a site configuration problem, not your AI key.',
  unavailable: 'The Genius Engineering Engine is temporarily unavailable. Try again shortly.',
};
const notConnected = () => new AppError(503, STATE_MESSAGES.not_configured);

/** One request to the engine. Engine messages for 4xx answers are shown; 5xx and network failures are not detailed. */
async function engineRequest(config, path, body, { fetchImpl, signal }) {
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(ENGINE_TIMEOUT_MS)]) : AbortSignal.timeout(ENGINE_TIMEOUT_MS);
  let response;
  try { response = await fetchImpl(`${config.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, body: JSON.stringify(body), signal: deadline, redirect: 'manual' }); }
  catch { if (signal?.aborted) throw new AppError(408, 'The engineering request was cancelled.'); throw new AppError(503, 'The Genius Engineering Engine could not be reached. Try again shortly.'); }
  const text = await response.text();
  if (text.length > MAX_ENGINE_BYTES) throw new AppError(502, 'The Genius Engineering Engine returned too much data.');
  let data = null; try { data = JSON.parse(text); } catch { /* Handled below. */ }
  if (response.status === 401) throw Object.assign(new AppError(503, STATE_MESSAGES.unauthorized), { engineState: 'unauthorized' }); // Never the visitor's key: the server-to-engine token was refused.
  if (response.status >= 400 && response.status < 500) throw new AppError(response.status === 429 ? 429 : 400, String(data?.error?.message || 'The engineering request was refused.').slice(0, 300));
  if (!response.ok || !data) throw new AppError(502, 'The Genius Engineering Engine failed on this request. Try again.');
  return data;
}

/** A generation request from the engine, accepted only in the expected shape. */
function checkedGeneration(value) {
  const ok = value && typeof value === 'object' && typeof value.name === 'string' && /^[a-z0-9_]{1,64}$/.test(value.name) && typeof value.instructions === 'string' && value.instructions.length <= 60000 && value.schema && typeof value.schema === 'object' && value.payload && typeof value.payload === 'object' && Number.isInteger(value.maxTokens) && value.maxTokens > 0 && value.maxTokens <= 20000;
  if (!ok) throw new AppError(502, 'The Genius Engineering Engine returned an unusable step.');
  return value;
}

/** Validate the visitor's request before anything is sent anywhere. */
export function validateEngineeringInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'An engineering request is required.');
  if (!ENGINEERING_STAGES.includes(input.stage)) throw new AppError(400, 'Choose clarify, design, or regenerate.');
  if (!Object.hasOwn(PROVIDERS, input.provider)) throw new AppError(400, 'Choose OpenAI, Claude, Gemini, Kimi, or DeepSeek in API settings.');
  if (typeof input.model !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(input.model)) throw new AppError(400, 'Choose a model in API settings.');
  if (typeof input.apiKey !== 'string' || !input.apiKey.trim() || input.apiKey.length > 1024) throw new AppError(400, 'Making a product with Genius AI needs your provider API key in API settings.');
  if (input.stage === 'clarify' && (typeof input.idea !== 'string' || input.idea.trim().length < 12 || input.idea.length > 4000)) throw new AppError(400, 'Describe the idea in 12 to 4,000 characters.');
  if (input.stage !== 'clarify' && (!input.project || input.project.schema !== PROJECT_SCHEMA)) throw new AppError(400, 'Send the current project.');
  if (input.answers !== undefined && (typeof input.answers !== 'object' || Array.isArray(input.answers) || Object.values(input.answers).some(value => typeof value !== 'string' || value.length > 600))) throw new AppError(400, 'Answers must be short texts.');
  if (input.stage === 'regenerate' && (typeof input.artifactId !== 'string' || input.artifactId.length > 40 || (input.instruction !== undefined && (typeof input.instruction !== 'string' || input.instruction.length > 1000)))) throw new AppError(400, 'Choose a file and a short instruction.');
  return { stage: input.stage, provider: input.provider, model: input.model, apiKey: input.apiKey.trim(), idea: input.idea, project: input.project, answers: input.answers, artifactId: input.artifactId, instruction: input.instruction };
}

/** Refuse early, before a stream starts: 503 without a configured engine, 400 for an unusable request. */
export function prepareEngineering(rawInput, env = process.env) {
  const config = engineConfig(env); if (!config) throw notConnected();
  return { config, input: validateEngineeringInput(rawInput) };
}

/**
 * Admit a run before streaming: the request must be valid and the engine must be operational (or unverified, when it is
 * older than the readiness route). A blocked run never sends the visitor's key anywhere.
 */
export async function admitEngineering(rawInput, { env = process.env, fetchImpl = fetch, cache } = {}) {
  const prepared = prepareEngineering(rawInput, env);
  const { state } = await engineReadiness({ env, fetchImpl, cache });
  if (state !== 'operational' && state !== 'unverified') throw Object.assign(new AppError(503, STATE_MESSAGES[state] || STATE_MESSAGES.unavailable), { engineState: state });
  return prepared;
}

/**
 * Run one engineering stage to completion: engine step, provider call with the visitor's key, engine step, …
 * `progress` receives { stage, detail } events. Returns { project, validation, usage }.
 */
export async function runEngineering(rawInput, { env = process.env, fetchImpl = fetch, signal, progress = () => {}, cache } = {}) {
  const { config, input } = prepareEngineering(rawInput, env);
  try { return await runStages(config, input, { fetchImpl, signal, progress }); }
  catch (error) { if (error.engineState === 'unauthorized') resetEngineReadiness(cache); throw error; } // The next status check asks the engine again.
}

async function runStages(config, input, { fetchImpl, signal, progress }) {
  const { apiKey, ...forEngine } = input; // The key stays on this server.
  const labels = { genius_engineering_clarify: 'Interpreting the idea', genius_engineering_architecture: 'Designing the architecture', genius_engineering_artifacts: 'Writing the engineering files', genius_engineering_regenerate: 'Rewriting the file' };
  const usage = [];
  progress({ stage: 'Starting the Genius Engineering Engine', detail: input.stage });
  let step = await engineRequest(config, '/v1/start', forEngine, { fetchImpl, signal });
  for (let count = 0; !step.done; count++) {
    if (count >= MAX_STEPS) throw new AppError(502, 'The engineering run took too many steps and was stopped.');
    const generation = checkedGeneration(step.generation);
    progress({ stage: labels[generation.name] || 'Working', detail: `${PROVIDERS[input.provider].name} · ${input.model}` });
    const answer = await callProviderJSON(input.provider, { apiKey, model: input.model, instructions: generation.instructions, payload: generation.payload, schema: generation.schema, name: generation.name, maxTokens: generation.maxTokens }, { fetchImpl, signal, timeoutMs: PROVIDER_TIMEOUT_MS, onRetry: event => progress({ stage: 'Provider is busy', detail: event.message }) });
    usage.push({ step: generation.name, usage: answer.usage || null, model: answer.model || input.model });
    progress({ stage: 'Checking the result', detail: 'Genius Engineering Engine' });
    step = await engineRequest(config, '/v1/resume', { state: step.state, output: answer.parsed }, { fetchImpl, signal });
  }
  if (!step.project || step.project.schema !== PROJECT_SCHEMA) throw new AppError(502, 'The Genius Engineering Engine returned an unusable project.');
  return { project: step.project, validation: step.validation || null, usage };
}

/** Validate a project with the engine (no model call, no key). */
export async function validateEngineering(input, { env = process.env, fetchImpl = fetch, signal, cache } = {}) {
  const config = engineConfig(env); if (!config) throw notConnected();
  if (!input?.project || input.project.schema !== PROJECT_SCHEMA) throw new AppError(400, 'Send the current project.');
  let result; try { result = await engineRequest(config, '/v1/validate', { project: input.project }, { fetchImpl, signal }); }
  catch (error) { if (error.engineState === 'unauthorized') resetEngineReadiness(cache); throw error; }
  if (!result.project || result.project.schema !== PROJECT_SCHEMA) throw new AppError(502, 'The Genius Engineering Engine returned an unusable project.');
  return { project: result.project, validation: result.validation || null };
}
