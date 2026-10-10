// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI: the public interface to the private
// Genius Engineering Engine.
//
// The engine is a separate, private service configured by the operator (GENIUS_ENGINE_URL, GENIUS_ENGINE_TOKEN).
// It never receives the visitor's provider key: it returns generation requests, this server runs each one with the
// visitor's key through the existing provider layer (fixed provider endpoints only), and sends the model output back.
// Without a configured engine, every engineering route answers 503 and the workspace shows the labeled example.
import { AppError } from './github.mjs';
import { PROVIDERS } from './providers.mjs';
import { callProviderJSON } from './provider-errors.mjs';
import { PROJECT_SCHEMA } from '../public/engineering.js';

export const ENGINEERING_STAGES = ['clarify', 'design', 'regenerate'];
const MAX_STEPS = 6; // clarify: 1–2 calls; design: 2–4; regenerate: 1–2. Anything longer is refused.
const ENGINE_TIMEOUT_MS = 30000; // The engine does no model work, so its answers are quick.
const PROVIDER_TIMEOUT_MS = 180000; // File generation can take minutes on slower models.
const MAX_ENGINE_BYTES = 3_500_000;

/** The operator's engine settings, or null when the engine is not configured. Only HTTPS (or localhost for development). */
export function engineConfig(env = process.env) {
  const url = String(env.GENIUS_ENGINE_URL || '').trim().replace(/\/+$/, ''); const token = String(env.GENIUS_ENGINE_TOKEN || '').trim();
  if (!url || token.length < 32) return null;
  let parsed; try { parsed = new URL(url); } catch { return null; }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))) return null;
  return { url, token };
}

/** Public status: whether the engine is configured. The URL and token are never revealed. */
export function engineeringStatus(env = process.env) { return { connected: Boolean(engineConfig(env)) }; }

const notConnected = () => new AppError(503, 'The Genius Engineering Engine is not connected on this server yet. Open the ESP32 example to explore the workspace.');

/** One request to the engine. Engine messages for 4xx answers are shown; 5xx and network failures are not detailed. */
async function engineRequest(config, path, body, { fetchImpl, signal }) {
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(ENGINE_TIMEOUT_MS)]) : AbortSignal.timeout(ENGINE_TIMEOUT_MS);
  let response;
  try { response = await fetchImpl(`${config.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, body: JSON.stringify(body), signal: deadline, redirect: 'manual' }); }
  catch { if (signal?.aborted) throw new AppError(408, 'The engineering request was cancelled.'); throw new AppError(503, 'The Genius Engineering Engine could not be reached. Try again shortly.'); }
  const text = await response.text();
  if (text.length > MAX_ENGINE_BYTES) throw new AppError(502, 'The Genius Engineering Engine returned too much data.');
  let data = null; try { data = JSON.parse(text); } catch { /* Handled below. */ }
  if (response.status === 401) throw new AppError(503, 'The Genius Engineering Engine refused this server\'s credentials. The operator must check GENIUS_ENGINE_TOKEN.');
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

/**
 * Run one engineering stage to completion: engine step, provider call with the visitor's key, engine step, …
 * `progress` receives { stage, detail } events. Returns { project, validation, usage }.
 */
/** Refuse early, before a stream starts: 503 without a configured engine, 400 for an unusable request. */
export function prepareEngineering(rawInput, env = process.env) {
  const config = engineConfig(env); if (!config) throw notConnected();
  return { config, input: validateEngineeringInput(rawInput) };
}

export async function runEngineering(rawInput, { env = process.env, fetchImpl = fetch, signal, progress = () => {} } = {}) {
  const { config, input } = prepareEngineering(rawInput, env);
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
export async function validateEngineering(input, { env = process.env, fetchImpl = fetch, signal } = {}) {
  const config = engineConfig(env); if (!config) throw notConnected();
  if (!input?.project || input.project.schema !== PROJECT_SCHEMA) throw new AppError(400, 'Send the current project.');
  const result = await engineRequest(config, '/v1/validate', { project: input.project }, { fetchImpl, signal });
  if (!result.project || result.project.schema !== PROJECT_SCHEMA) throw new AppError(502, 'The Genius Engineering Engine returned an unusable project.');
  return { project: result.project, validation: result.validation || null };
}
