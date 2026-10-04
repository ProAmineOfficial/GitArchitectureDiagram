// Project: Git Architecture Diagram | Component: Provider adapters | Author: Amine Saoud ibn al-Bashir.
// Fixed-endpoint text-model adapters; caller credentials never choose an arbitrary destination.
// Each adapter builds one provider-native request and normalizes the final text, keeping reasoning or thinking
// content out of every result. Network calls, retries, and error classification live in provider-errors.mjs.
import { AppError } from './github.mjs'; // Reuse safe, bounded errors that do not echo provider payloads.
import { PROVIDERS, structuredMode } from '../public/providers.js'; // Keep the UI and server provider identities aligned.
export { PROVIDERS, structuredMode }; // Expose the same catalog to analysis orchestration.

const ENDPOINTS = { // Official HTTPS endpoints only.
  openai: 'https://api.openai.com/v1/responses',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: model => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  kimi: 'https://api.moonshot.ai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};
const THINKING_HEADROOM = 16000; // Extra output budget for models that always reason before answering; only used tokens are billed.
const MODEL_LISTS = { // Official model-list endpoints used by the model registry and Test connection.
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models?limit=1000',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
  kimi: 'https://api.moonshot.ai/v1/models',
  deepseek: 'https://api.deepseek.com/models',
};

/** Provider-specific authentication headers. Keys never appear in a URL. */
export function authHeaders(provider, apiKey) {
  if (provider === 'anthropic') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (provider === 'gemini') return { 'x-goog-api-key': apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

/** A minimal example object for a JSON schema, used to describe JSON-mode output to providers without strict schemas. */
export function exampleFromSchema(schema, depth = 0) {
  if (!schema || depth > 6) return null;
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, exampleFromSchema(value, depth + 1)]));
  if (schema.type === 'array') { const item = exampleFromSchema(schema.items, depth + 1); return item === null ? [] : [item]; }
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  return '';
}

/** Instructions appended for JSON mode: the word "json", the exact schema, and an example (DeepSeek requires both). */
export function jsonModeInstructions(schema) {
  return `\n\nOutput format: respond with one json object only, no prose and no code fences. It must validate against this JSON Schema (every listed property is required; do not add other properties):\n${JSON.stringify(schema)}\nExample of the shape (values are placeholders): ${JSON.stringify(exampleFromSchema(schema))}`;
}

/** Build one provider-specific request without performing network operations. */
export function providerRequest(provider, { apiKey, model, instructions, payload, schema, name = 'genius_architecture', maxTokens = 6000 }) {
  if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Choose OpenAI, Claude, Gemini, Kimi, or DeepSeek in API settings.'); // Reject unknown provider names and object prototype keys.
  const headers = { 'Content-Type': 'application/json', ...authHeaders(provider, apiKey) }; const input = JSON.stringify(payload); // Serialize only the bounded source context.
  const mode = structuredMode(provider, model); const system = mode === 'json_object' ? instructions + jsonModeInstructions(schema) : instructions; // JSON mode carries the schema in the instructions.
  if (provider === 'openai') return { url: ENDPOINTS.openai, headers, body: { model, store: false, instructions, input, max_output_tokens: maxTokens, ...(/^gpt-6/.test(model) ? { reasoning: { effort: 'low' } } : {}), text: { format: { type: 'json_schema', name, strict: true, schema } } } }; // Strict JSON, no stored response, bounded reasoning that shares the output budget.
  if (provider === 'anthropic') return { url: ENDPOINTS.anthropic, headers, body: { model, max_tokens: Math.max(maxTokens, 8000), system: instructions, messages: [{ role: 'user', content: input }], output_config: { format: { type: 'json_schema', schema } } } }; // The current non-beta structured output field.
  if (provider === 'gemini') return { url: ENDPOINTS.gemini(model), headers, body: { systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: 'user', parts: [{ text: input }] }], generationConfig: { maxOutputTokens: maxTokens, responseFormat: { text: { mimeType: 'application/json', schema } } } } }; // The documented generateContent structured-output contract (lowercase MIME type).
  if (provider === 'kimi') return { url: ENDPOINTS.kimi, headers, body: { model, messages: [{ role: 'system', content: system }, { role: 'user', content: input }], ...(mode === 'json_schema' ? { max_completion_tokens: maxTokens + THINKING_HEADROOM, reasoning_effort: 'low', response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } } } : { max_completion_tokens: maxTokens, ...(/^kimi-k2/.test(model) ? { thinking: { type: 'disabled' } } : {}), response_format: { type: 'json_object' } }) } }; // K3 always thinks: strict schema, low effort, and headroom. K2 models think by default, so the economy role turns it off. max_tokens is deprecated.
  const thinking = model !== 'deepseek-flash'; // Flash is the economy role: no thinking. Pro keeps DeepSeek's default thinking with extra token headroom.
  return { url: ENDPOINTS.deepseek, headers, body: { model, messages: [{ role: 'system', content: system }, { role: 'user', content: input }], max_tokens: thinking ? maxTokens + THINKING_HEADROOM : maxTokens, stream: false, thinking: { type: thinking ? 'enabled' : 'disabled' }, response_format: { type: 'json_object' } } };
}

/** Normalize final text while rejecting refusals and truncated output. Reasoning and thinking content is never returned. */
export function providerOutput(provider, data) {
  const incomplete = (kind = 'truncated') => { const error = new AppError(502, kind === 'refused' ? 'The AI provider refused this request. The structural report remains available.' : 'The AI response was refused or incomplete. The structural report remains available.'); error.kind = kind; throw error; }; // Avoid displaying partial output as a completed report.
  if (provider === 'openai') { const content = (data.output || []).flatMap(item => item.content || []); if (content.some(item => item.type === 'refusal')) incomplete('refused'); if (data.status === 'incomplete' || data.status === 'failed') incomplete(); return { text: content.filter(item => item.type === 'output_text').map(item => item.text).join(''), model: data.model, usage: data.usage }; } // Inspect all Responses output blocks, not just the first item.
  if (provider === 'anthropic') { if (data.stop_reason === 'refusal') incomplete('refused'); if (data.stop_reason === 'max_tokens') incomplete(); return { text: (data.content || []).filter(item => item.type === 'text').map(item => item.text).join(''), model: data.model, usage: data.usage }; } // Ignore thinking and other non-text blocks.
  if (provider === 'gemini') { const candidate = data.candidates?.[0]; if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') incomplete('refused'); if (!candidate || candidate.finishReason !== 'STOP') incomplete(); return { text: (candidate.content?.parts || []).filter(item => !item.thought && typeof item.text === 'string').map(item => item.text).join(''), model: data.modelVersion, usage: data.usageMetadata }; } // Never expose thought parts.
  const choice = data.choices?.[0]; if (choice?.finish_reason === 'content_filter') incomplete('refused'); if (!choice || choice.finish_reason !== 'stop') incomplete(); // Kimi and DeepSeek share the Chat Completions envelope.
  return { text: choice.message?.content || '', model: data.model, usage: data.usage }; // reasoning_content stays out of the answer.
}

/** Host names of a provider's official endpoints, for safe diagnostics (never a key or a full URL with parameters). */
export function endpointHosts(provider, model = 'model') {
  if (!Object.hasOwn(ENDPOINTS, provider)) return { inference: '', modelList: '' };
  const inference = typeof ENDPOINTS[provider] === 'function' ? ENDPOINTS[provider](model) : ENDPOINTS[provider];
  return { inference: new URL(inference).host, modelList: new URL(MODEL_LISTS[provider]).host };
}

/** The official model-list request for a provider. */
export function modelListRequest(provider, apiKey) {
  if (!Object.hasOwn(MODEL_LISTS, provider)) throw new AppError(400, 'Unknown AI provider.');
  return { url: MODEL_LISTS[provider], headers: authHeaders(provider, apiKey) };
}

/** Model IDs from a model-list response. Gemini entries must support generateContent. */
export function parseModelList(provider, data) {
  if (provider === 'gemini') return (Array.isArray(data?.models) ? data.models : []).filter(item => !item.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent')).map(item => String(item.name || '').replace(/^models\//, '')).filter(Boolean);
  return (Array.isArray(data?.data) ? data.data : []).map(item => String(item?.id || '')).filter(Boolean);
}

/**
 * Resolve the provider, key, and model for one web request. Only the key the person entered in this browser tab is
 * used: a web request never borrows a server-side provider key, and no instance password exists. The site's own key
 * is used only for opted-in public system maps (GENIUS_PUBLIC_AI), inside the analysis service.
 */
export function resolveCredentials(input) {
  const provider = typeof input?.provider === 'string' && input.provider ? input.provider : 'openai';
  if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Choose OpenAI, Claude, Gemini, Kimi, or DeepSeek in API settings.');
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  if (apiKey.length > 1024) throw new AppError(400, 'The API key is too long.');
  const model = typeof input?.model === 'string' ? input.model.trim() : '';
  return { provider, apiKey, model };
}
