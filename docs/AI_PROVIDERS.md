# Genius AI providers

Genius performs tree, import/include, component, reading-order, documentation, tour, and Mermaid analysis without an AI service. AI features use the provider chosen in **API settings**, and each runs only on an explicit action:

| Feature | Starts when | Sends | Output limit per call |
| --- | --- | --- | --- |
| Genius system map | **Genius** mode under Options, or **Generate** in the System Map view | Repository identity, coverage, located dependencies, and up to 110,000 characters of line-numbered excerpts from files already read | 12,000 tokens (Claude requests reserve at least 8,000) |
| Deep Genius | **Run Deep Genius…** in the Genius panel or the Process view, after a confirmation that shows provider, model, maximum calls, concurrency, input scope, and a cost warning | Per agent: bounded excerpts and summaries retrieved for that agent (at most 150,000 characters of payload, usually far less) | 3,000–6,000 tokens depending on the stage |
| Ask *provider* | **Ask OpenAI / Claude / Gemini / Kimi / DeepSeek** in the Genius panel | Your question and up to 12 excerpts, at most 32,000 characters, chosen from files already read | 3,000 tokens |
| Test connection | **Test connection** in API settings | One model-list request and one tiny structured request | 1,024 tokens (plus reasoning headroom on models that always reason) |

**Search sources** is always free: a local keyword search over the files read. An AI failure leaves the structural report intact.

## Two recommended models per provider

The normal interface shows exactly two models per provider: **Fast** (economy) and **Advanced** (best quality). Each ID below was checked against the provider's official documentation on **October 4, 2026**. No model is labeled free.

| Provider | Fast | Advanced | Verified alternatives (used only if your key lists them instead) | Structured output |
| --- | --- | --- | --- | --- |
| OpenAI | `gpt-6-luna` | `gpt-6-astra` | `gpt-6.1-sol` | Responses API, strict `json_schema`, `store: false`, low reasoning effort |
| Claude | `claude-haiku-4-5-20251001` | `claude-opus-5-5` | `claude-sonnet-5-5` | Messages API, `output_config.format` JSON schema |
| Gemini | `gemini-3.5-flash-lite` | `gemini-3.8-flash` | `gemini-3.1-flash-lite`, `gemini-3.7-flash` | generateContent, `generationConfig.responseFormat.text` with `mimeType: "application/json"` and a schema |
| Kimi | `kimi-k2.6` | `kimi-k3` | — | K3: strict `json_schema`, `reasoning_effort: low`, `max_completion_tokens` with reasoning headroom; K2.6: JSON mode with `thinking: disabled` |
| DeepSeek | `deepseek-flash` | `deepseek-v4-pro` | — | JSON mode (`response_format: json_object`); Flash without thinking, V4 Pro with thinking |

Claude Opus 5.5 is the Advanced choice because Anthropic recommends it as the starting point for demanding work; Claude Fable 5.1 (adaptive thinking always on) can be entered as a custom model.

### Keeping the list current

`src/model-registry.mjs` keeps the recommendations current without inventing IDs:

1. The verified pair above is bundled in `public/providers.js`.
2. When you paste a key, the server reads the provider's official model list (`/v1/models`, `/v1beta/models`, or `/models`) with your key.
3. Each role keeps the first verified candidate your key can use. A newer, unknown model is never promoted, because its structured-output behavior has not been checked.
4. Results are cached for 12 hours per provider and key fingerprint (a SHA-256 prefix; the key itself is never a cache key).
5. If discovery fails, the last verified pair (or the bundled pair) stays in use.

A custom model ID remains available under **Advanced: use a custom model ID**. Custom models are not checked.

## DeepSeek

DeepSeek uses its official OpenAI-format endpoint `https://api.deepseek.com/chat/completions` with `Authorization: Bearer`, set server-side with `DEEPSEEK_API_KEY` when an operator provides one. DeepSeek documents JSON mode (`response_format: {"type": "json_object"}`) rather than strict schemas, so the adapter adds the word "json", the exact schema, and an example to the system instructions, and every response is shape-checked (`conform`) before use. `reasoning_content` is never read or shown. The Fast model runs with `thinking: {"type": "disabled"}`; V4 Pro keeps DeepSeek's default thinking with extra token headroom.

## Test connection

Test connection runs two independent checks and shows four rows:

| Row | Passes when |
| --- | --- |
| Authentication | The provider accepted the key. It fails only on an actual HTTP 401; a 403 means the key is valid but lacks access. |
| Provider reachable | The Git Architecture Diagram server received any HTTP answer from the provider. |
| Model available | The tiny request answered, or the key's model list includes the model. |
| Tiny inference | One structured request returned exactly `{"ok": true}`. |

Check A reads the provider's official model list (authentication and discovery). Many keys cannot list models — an OpenAI project key without the Models permission answers 403 — so a failed list is recorded but never decides the result. Check B, the tiny structured request, decides. A failed model list with a working inference is a success: "Connected. Model discovery was unavailable, so the verified bundled model pair is being used." Neither check is retried.

A 401 or 403 that is not the provider's JSON error (for example a plain-text refusal from an egress firewall or proxy) is reported as **Provider unreachable**, never as a key problem: the key was not tested.

**Diagnostics** (folded under the result, and written to the server log as one `[provider-test]` line) show only safe facts: provider, model, whether a key reached the server and its length, whether it has the provider's documented prefix, endpoint host, the HTTP status and classification of each check, and the duration. The key and the authorization header are never shown or logged.

If the key does not have the provider's documented prefix (OpenAI and DeepSeek `sk-`, Claude `sk-ant-`), the result says so with the length the server received. The API key field is a masked text field rather than a password field, because browsers ignore `autocomplete="off"` on password fields and can fill a saved site password into it. Gemini (auth keys created since May 28, 2026) and Kimi keys have no documented prefix, so they are never questioned.

### Provider contract notes (re-verified October 4, 2026)

- **Gemini:** the structured-output MIME type is lowercase `application/json` (1.0.0 sent `APPLICATION_JSON`). New AI Studio keys are auth keys that no longer start with `AIza`; unrestricted standard keys are rejected by Google.
- **Kimi:** `max_tokens` is deprecated in favor of `max_completion_tokens`. K2.6 thinks by default, so the Fast role sends `thinking: {"type": "disabled"}`; K3 always thinks, so it gets `reasoning_effort: "low"` and output headroom. K3's fixed sampling parameters are never sent.
- **Claude:** keys that are not scoped to a workspace (personal and service-account keys) need an `anthropic-workspace-id` header that this site does not send; the result says "Workspace API key required". Use a workspace API key. `x-api-key` remains supported alongside `Authorization: Bearer`.
- **DeepSeek:** `deepseek-chat` and `deepseek-reasoner` were retired on July 24, 2026. DeepSeek's September 2026 news and changelog disagree on whether `deepseek-v4-pro` keeps its own model after September 14, 2026; the ID is still listed and accepted, so it stays the Advanced choice until DeepSeek retires it.
- **OpenAI:** `max_output_tokens` includes reasoning tokens, so the probe allows 1,024 tokens rather than 400.

## Errors, rate limits, and retries

`src/provider-errors.mjs` classifies every failure from documented fields only; raw provider payloads are never shown.

| Response | Kind | Message | Retried |
| --- | --- | --- | --- |
| 400 | Invalid request or unsupported model capability (Anthropic "credit balance" → quota; a missing `anthropic-workspace-id` → workspace key required) | *Provider* rejected the request (HTTP 400). … | No |
| 401 | Invalid API key | API key rejected by *Provider*. Check or create a new provider API key. | No |
| 403 | Key lacks access | The API key is valid but does not have access to this resource/model. | No |
| 404 | Model unavailable or retired | The selected model is not available for this account. | No |
| 408, network timeout | Timeout | Provider did not respond in time. | Yes |
| 429 | Rate limited | Rate limit reached. Wait and retry. | Yes |
| 429 with `insufficient_quota`, `exceeded_current_quota_error`, or a Gemini per-day quota; 402 (DeepSeek) | Quota exhausted | Provider quota/credits are exhausted. | No |
| 500, 502, 503, 504, 529 | Provider temporarily unavailable | *Provider* is temporarily unavailable. | Yes |
| No connection | Network | The Git Architecture Diagram server could not reach *Provider*. | No |
| 401 or 403 whose body is not a provider JSON error (a firewall, proxy, or WAF page) | Blocked | The Git Architecture Diagram server could not reach *Provider*: the connection was refused before the key was checked. … | No |
| Redirect | Rejected; credentials are never forwarded | No |
| Malformed JSON, empty or truncated output, refusal | Unexpected response | No |

Retries: **at most 3 attempts in total**. `Retry-After` (seconds or HTTP date, or Gemini `RetryInfo`) is honored; without it the waits are about 1 s, then 2 s, with ±25% jitter. A requested wait longer than 30 seconds is reported instead of waited for. Cancelling stops immediately. While retrying, the interface says "*Provider* is busy. Retrying in N s."

Fallback is never automatic across providers, because that would need another provider's credentials. Within a provider, the interface suggests the Fast model after an Advanced failure; Deep Genius can continue with Fast only if you tick that option in its confirmation. It never moves from Fast to the more expensive Advanced model on its own.

## Deep Genius orchestration

`public/genius-core.js` runs in the browser and calls `POST /api/genius/agent` once per agent, so no request outlives a hosting proxy timeout. The server chooses the instructions and the JSON schema from `public/genius-agents.js` for an allowlisted agent and stage; a browser cannot supply instructions. At most three calls run at once.

1. **Team 1 — Audit** (in parallel): 1A correctness and reliability, 1B architecture and performance, 1C security, maintainability, and developer experience. Findings are verified, merged, and deduplicated.
2. **Team 2 — Solutions** (in parallel): 2A fix planner, 2B architecture improvement engineer, 2C innovation and tooling engineer (required fixes kept separate from optional innovation).
3. **Validation**: the auditors whose findings a solution addresses review it (APPROVED, NEEDS_REVISION, or REJECTED). Disagreement sends it back. At most two revise-and-revalidate loops follow; what is still disputed becomes **UNRESOLVED** with the author's and the reviewers' positions.
4. **Team 3** (in parallel, approved work only): 3A comparator, 3B documentation and diagrams, 3C development pack.
5. **Genius Core synthesis**: the final twenty-section project intelligence object.

Planned calls: 13 to 25. Agents never receive the whole repository: `public/repo-intel.js` classifies files, builds per-file, per-folder, per-subsystem, and repository summaries (cached by repository, path, and blob SHA, so only changed files are re-summarized on a new commit), and retrieves bounded excerpts for each agent's focus. Requests for more evidence load bounded slices of files already read, with the reason recorded.

## Evidence contract

`public/genius-evidence.js` decides what is verified: a citation is verified only when its path exists at the analyzed commit, its line exists in the SHA-verified file that was read, and its quote appears at that line. A citation of another commit or repository, an invented path, or an impossible line is rejected; a finding whose references are all invented is dropped. Anything that cannot be checked stays visible as **Genius inference** (dotted in the interface), whatever label the model used.

## Public system maps (operator opt-in)

With `GENIUS_PUBLIC_AI=1`, a provider key, and `GENIUS_MODEL`, anonymous visitors of **public** repositories receive system maps generated with the operator's key. Saved maps are keyed by repository, commit, folder, file budget, provider, model, and analyzer version. `GENIUS_PUBLIC_DAILY_LIMIT` (default 25) counts only real model calls per UTC day. Deep Genius never uses the public allowance: it needs your own key. There is no instance password.

## Request and credential behavior

- Provider destinations are fixed official HTTPS endpoints. No arbitrary endpoint field is exposed.
- Each provider uses its own authentication header. Keys never appear in URLs, logs, caches, exports, or browser storage.
- A web request only ever uses the key sent with it. The operator's server key is used only for opted-in public system maps, never for Test connection, Ask, Deep Genius, or a visitor's analysis.
- Changing providers clears the key. A selection for a different provider never borrows another provider's server key.
- Redirects are rejected. Refusals, incomplete output, malformed responses, and invalid source references never become a completed report.
- No agent is asked for hidden reasoning; thinking and reasoning content is discarded from every provider response.

## Official references

- OpenAI: [models](https://developers.openai.com/api/docs/models), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- Anthropic: [models](https://platform.claude.com/docs/en/models/overview), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
- Google: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
- Kimi: [pricing and models](https://platform.kimi.ai/docs/pricing/chat), [K3 quickstart](https://platform.kimi.ai/docs/guide/kimi-k3-quickstart), [JSON mode](https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api).
- DeepSeek: [API](https://api-docs.deepseek.com/), [models and pricing](https://api-docs.deepseek.com/quick_start/pricing), [JSON output](https://api-docs.deepseek.com/guides/json_mode), [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode), [list models](https://api-docs.deepseek.com/api/list-models).

These integrations were verified with deterministic fixtures in each provider's documented response shape (`tests/provider-connection.test.mjs` runs the whole browser → server → provider path for all five providers). **No paid model request was made during the 1.0.0 or 1.1.0 validation**, because no provider credentials were available in the development sandbox; a real connection must be confirmed with Test connection on the production site.
