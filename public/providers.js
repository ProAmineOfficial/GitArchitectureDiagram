// Project: Git Architecture Diagram | Component: Provider catalog (shared by browser and server) | Author: Amine Saoud ibn al-Bashir.
// Each provider offers exactly two recommended models: Fast (economy) and Advanced (best quality). Every model ID
// below was checked against the provider's official model documentation on CATALOG_CHECKED. The server's model
// registry can refresh availability per key, but it only ever chooses among these verified candidates, so a model
// whose structured-output behavior has not been confirmed never appears as a recommendation.

export const CATALOG_CHECKED = '2026-10-04';
export const MODEL_ROLES = ['fast', 'advanced'];
export const ROLE_LABELS = { fast: 'Fast', advanced: 'Advanced' };

export const PROVIDERS = { // Public labels, model choices, and documentation; never credentials.
  openai: {
    name: 'OpenAI', keyEnv: 'OPENAI_API_KEY', keyPrefix: 'sk-', keyHint: 'sk-…',
    docs: 'https://developers.openai.com/api/docs/models',
    recommended: {
      fast: { id: 'gpt-6-luna', note: 'GPT-6 Luna: the most efficient GPT-6 model for focused, high-volume work.' },
      advanced: { id: 'gpt-6-astra', note: 'GPT-6 Astra: OpenAI\'s most capable model for demanding work.' },
    },
    candidates: { fast: ['gpt-6-luna'], advanced: ['gpt-6-astra', 'gpt-6.1-sol'] }, // Verified alternatives, in order of preference.
  },
  anthropic: {
    name: 'Claude', keyEnv: 'ANTHROPIC_API_KEY', keyPrefix: 'sk-ant-', keyHint: 'sk-ant-…',
    docs: 'https://platform.claude.com/docs/en/models/overview',
    recommended: {
      fast: { id: 'claude-haiku-4-5-20251001', note: 'Claude Haiku 4.5: the fastest and lowest-cost current Claude model.' },
      advanced: { id: 'claude-opus-5-5', note: 'Claude Opus 5.5: Anthropic\'s recommended starting point for demanding work.' },
    },
    candidates: { fast: ['claude-haiku-4-5-20251001'], advanced: ['claude-opus-5-5', 'claude-sonnet-5-5'] },
  },
  gemini: {
    name: 'Gemini', keyEnv: 'GEMINI_API_KEY', keyPrefix: null, keyHint: 'from Google AI Studio', // Keys created since 2026-05-28 are auth keys that no longer start with AIza.
    docs: 'https://ai.google.dev/gemini-api/docs/models',
    recommended: {
      fast: { id: 'gemini-3.5-flash-lite', note: 'Gemini 3.5 Flash-Lite: the most economical stable Gemini text model.' },
      advanced: { id: 'gemini-3.8-flash', note: 'Gemini 3.8 Flash: Google\'s most capable stable model for software engineering.' },
    },
    candidates: { fast: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'], advanced: ['gemini-3.8-flash', 'gemini-3.7-flash'] },
  },
  kimi: {
    name: 'Kimi', keyEnv: 'MOONSHOT_API_KEY', keyPrefix: null, keyHint: 'from platform.kimi.ai', // Moonshot does not document a key prefix.
    docs: 'https://platform.kimi.ai/docs/pricing/chat',
    recommended: {
      fast: { id: 'kimi-k2.6', note: 'Kimi K2.6: the lowest-priced Kimi general model, used in JSON mode without thinking.' },
      advanced: { id: 'kimi-k3', note: 'Kimi K3: Moonshot\'s most capable model (strict JSON schema, low reasoning effort).' },
    },
    candidates: { fast: ['kimi-k2.6'], advanced: ['kimi-k3'] },
  },
  deepseek: {
    name: 'DeepSeek', keyEnv: 'DEEPSEEK_API_KEY', keyPrefix: 'sk-', keyHint: 'sk-…',
    docs: 'https://api-docs.deepseek.com/quick_start/pricing',
    recommended: {
      fast: { id: 'deepseek-flash', note: 'DeepSeek Flash (DeepSeek-V4.1-Flash): the economical model, used without thinking mode.' },
      advanced: { id: 'deepseek-v4-pro', note: 'DeepSeek V4 Pro: the most capable DeepSeek model, with thinking mode.' },
    },
    candidates: { fast: ['deepseek-flash'], advanced: ['deepseek-v4-pro'] },
  },
};
for (const provider of Object.values(PROVIDERS)) provider.models = MODEL_ROLES.map(role => provider.recommended[role].id); // Older callers read a plain list.

/** Which structured-output contract a model supports: a strict JSON schema, or JSON mode plus a schema in the instructions. */
export function structuredMode(provider, model = '') {
  if (provider === 'deepseek') return 'json_object'; // DeepSeek documents response_format json_object only.
  if (provider === 'kimi') return /^kimi-k3(\b|[.-]|$)/.test(model) ? 'json_schema' : 'json_object'; // Kimi documents strict json_schema for K3.
  return 'json_schema';
}

/** The role ("fast" or "advanced") of a model ID within a provider, or "custom". */
export function roleOf(provider, model) {
  const entry = PROVIDERS[provider]; if (!entry) return 'custom';
  return MODEL_ROLES.find(role => entry.candidates[role].includes(model)) || 'custom';
}

/** Cheap local plausibility check of a pasted key. It never proves the key works; Test connection does that. */
export function checkKeyFormat(provider, key) {
  const value = String(key || '');
  if (!value) return { ok: false, message: 'Paste an API key first.' };
  if (/\s/.test(value)) return { ok: false, message: 'The key contains spaces or line breaks. Paste it again.' };
  if (value.length < 16 || value.length > 1024 || !/^[\x21-\x7e]+$/.test(value)) return { ok: false, message: 'This does not look like an API key.' };
  const prefix = PROVIDERS[provider]?.keyPrefix;
  if (prefix && !value.startsWith(prefix)) return { ok: true, warning: `${PROVIDERS[provider].name} keys usually start with ${prefix}. Check that this key belongs to ${PROVIDERS[provider].name}.` };
  return { ok: true };
}
