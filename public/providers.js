// Claude presets checked against Anthropic's model overview on September 28, 2026 (Claude Sonnet 5.5 released that day).
// OpenAI, Gemini, and Kimi presets were recorded on September 27, 2026. Custom model IDs remain available for all providers.
export const PROVIDERS = { // Keep public labels and model suggestions separate from all credentials.
  openai: { name: 'OpenAI', models: ['gpt-6-sol', 'gpt-6-astra', 'gpt-6-luna'], docs: 'https://developers.openai.com/api/docs/models', keyEnv: 'OPENAI_API_KEY' }, // Use the Responses API for OpenAI text models.
  anthropic: { name: 'Claude', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-fable-5-1'], docs: 'https://platform.claude.com/docs/en/models/overview', keyEnv: 'ANTHROPIC_API_KEY' }, // Use Anthropic's native Messages API.
  gemini: { name: 'Gemini', models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'], docs: 'https://ai.google.dev/gemini-api/docs/models', keyEnv: 'GEMINI_API_KEY' }, // Keep preview model names explicit.
  kimi: { name: 'Kimi', models: ['kimi-k3', 'kimi-k2.7-code'], docs: 'https://platform.kimi.ai/docs/guide/kimi-k3-quickstart', keyEnv: 'MOONSHOT_API_KEY' }, // Use Moonshot's official international endpoint.
}; // End the public provider catalog.
