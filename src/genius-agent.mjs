// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-GENIUS-PIPELINE-001
// Project: Git Architecture Diagram | Component: Genius agent endpoint | Author: Amine Saoud ibn al-Bashir.
// Runs exactly one Genius agent call. The caller chooses an allowlisted agent and stage and supplies bounded data
// (repository identity, commit, summaries, excerpts, and prior team outputs); the server supplies the instructions and
// the JSON schema, sends one structured request through the common provider layer, and returns the schema-conformed
// output. Citation verification happens in the orchestrator against the analyzed commit, never on the model's word.
import { AppError } from './github.mjs';
import { PROVIDERS } from './providers.mjs';
import { callProviderJSON } from './provider-errors.mjs';
import { AGENTS, SCHEMAS, STAGE_SCHEMA, OUTPUT_TOKENS, GENIUS_LIMITS, agentRuns, agentInstructions, conform } from '../public/genius-agents.js';

const outputCache = new Map(); // Node only: identical agent calls within an hour reuse their validated output.
const CACHE_TTL = 60 * 60 * 1000;

/** Validate the request shape before any provider call. */
export function validateAgentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'A Genius agent request is required.');
  const { agent, stage } = input;
  if (typeof agent !== 'string' || typeof stage !== 'string' || !agentRuns(agent, stage)) throw new AppError(400, 'Unknown Genius agent or stage.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(input.repository || '') || !/^[0-9a-f]{40}$/i.test(input.commit || '')) throw new AppError(400, 'A repository and full commit SHA are required.');
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) throw new AppError(400, 'The agent payload is missing.');
  const size = JSON.stringify(input.payload).length;
  if (size > GENIUS_LIMITS.payloadCharacters) throw new AppError(413, 'The agent evidence exceeds the per-call limit.');
  return { agent, stage, repository: input.repository, commit: input.commit.toLowerCase(), scope: typeof input.scope === 'string' ? input.scope.slice(0, 1000) : '', payload: input.payload, size };
}

async function digest(text) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }

/**
 * Run one agent.
 * @returns {Promise<{agent: string, stage: string, output: object, usage: object|null, model: string, provider: string, attempts: number, cached: boolean}>}
 */
export async function runGeniusAgent(input, { apiKey, model, provider = 'openai', signal, fetchImpl = fetch, cache = false, onRetry } = {}) {
  const request = validateAgentInput(input);
  if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Choose OpenAI, Claude, Gemini, Kimi, or DeepSeek in API settings.');
  if (!apiKey || !model) throw new AppError(400, 'Deep Genius needs a provider API key and model in API settings.');
  if (typeof model !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(model) || typeof apiKey !== 'string' || apiKey.length > 1024) throw new AppError(400, 'Invalid AI settings.');
  const schema = SCHEMAS[STAGE_SCHEMA[request.stage]];
  const payload = { agent: `${request.agent} ${AGENTS[request.agent].title}`, stage: request.stage, repository: request.repository, commit: request.commit, scope: request.scope, ...request.payload };
  const key = cache ? await digest(JSON.stringify([provider, model, request.agent, request.stage, payload])) : '';
  const hit = key && outputCache.get(key);
  if (hit && hit.expires > Date.now()) return { ...structuredClone(hit.value), cached: true };
  const answer = await callProviderJSON(provider, { apiKey, model, instructions: agentInstructions(request.agent, request.stage), payload, schema, name: `genius_${request.stage}`, maxTokens: OUTPUT_TOKENS[request.stage] }, { fetchImpl, signal, timeoutMs: 120000, onRetry });
  const value = { agent: request.agent, stage: request.stage, output: conform(schema, answer.parsed), usage: answer.usage, model: answer.model || model, provider, attempts: answer.attempts };
  if (key) { outputCache.set(key, { value: structuredClone(value), expires: Date.now() + CACHE_TTL }); while (outputCache.size > 300) outputCache.delete(outputCache.keys().next().value); }
  return { ...value, cached: false };
}
