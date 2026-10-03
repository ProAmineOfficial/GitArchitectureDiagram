# Genius AI providers

Genius performs tree, import/include, component, reading-order, documentation, and Mermaid analysis without an AI service. Two optional features use the provider chosen in **API settings**, and each runs only on an explicit action:

| Feature | Starts when | Sends | Output limit |
| --- | --- | --- | --- |
| Architecture interpretation | **Add a Genius AI interpretation** is checked under Options and you analyze | Repository identity, coverage, located dependencies, and up to 110,000 characters of line-numbered excerpts from files already read | 12,000 tokens (Claude requests reserve at least 8,000 because adaptive thinking shares the budget) |
| Ask *provider* | You press **Ask OpenAI / Claude / Gemini / Kimi** in the Genius panel | Your question and up to 12 excerpts, at most 32,000 characters, chosen from files already read | 3,000 tokens |

The exact size, provider, and model are shown before sending. **Search sources** is always free: a local keyword search over the files read. An AI failure leaves the structural report intact.

## Public system maps (operator opt-in)

With `GENIUS_PUBLIC_AI=1`, a provider key, and `GENIUS_MODEL`, anonymous visitors of **public** repositories receive system maps generated with the operator's key. Saved maps are keyed by repository, commit, folder, file budget, provider, model, and analyzer version: in process memory (up to 200) on the Node server, and additionally in the platform Cache API on the Worker when the runtime provides it. `GENIUS_PUBLIC_DAILY_LIMIT` (default 25) counts only real model calls per UTC day. On the Worker this counter is per isolate, so it is an approximate ceiling; a hard global budget needs shared storage such as KV or a database. Keep a spending limit on the provider account as well.

## Validated output

- **Architecture graph.** The model returns components (`nodes`, including `actor` and `external` kinds without paths), `groups`, `edges`, and a `tour` of 3 to 8 steps that must each name an existing node, each edge labeled `observed`, `documented`, or `inferred` with an evidence path and line. Before anything is drawn, every node path is checked against the commit's file list: unknown paths become dashed *unmapped concept* nodes with no link. An `observed` or `documented` edge whose evidence line is outside the supplied excerpts is downgraded to `inferred`. Only then is Mermaid compiled, by the same compiler as the deterministic overview. Validation notes appear in the Genius panel and the guide.
- **Answers.** Findings must cite a path and line inside an excerpt that was sent; others are removed and counted. Suggestions are shown separately from findings. If the excerpts cannot answer the question, the answer says so.

## Model presets

The Claude presets were checked against Anthropic's model overview on **September 28, 2026**, the release day of Claude Sonnet 5.5. The OpenAI, Gemini, and Kimi presets were recorded on **September 27, 2026** and were not rechecked for this release. They are editable suggestions, not a promise of automatic access, ongoing availability, or the same cost. Enter another supported text model ID when needed.

| Provider | Initial preset | Other presets | Native endpoint |
| --- | --- | --- | --- |
| OpenAI | `gpt-6-sol` | `gpt-6-astra`, `gpt-6-luna` | Responses |
| Claude / Anthropic | `claude-sonnet-5-5` | `claude-opus-5-5`, `claude-haiku-4-5-20251001`, `claude-fable-5-1` | Messages |
| Gemini / Google | `gemini-3.8-flash` | `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview` | generateContent |
| Kimi / Moonshot | `kimi-k3` | `kimi-k2.7-code` | Chat Completions |

Model availability and structured-output support depend on the provider account. An image-generation model such as DALL-E does not supply repository text analysis; Mermaid is generated and rendered as source-based vector diagrams.

## Request and credential behavior

- Provider destinations are fixed official HTTPS endpoints. No arbitrary endpoint field is exposed.
- Each provider uses its own authentication header and native JSON-schema request format. Keys never appear in URL parameters.
- Changing providers clears the prior key in the browser. Keys remain in the current tab and request memory, not local storage, reports, or application logs.
- OpenAI uses `store: false`. Data handling by each provider still follows its account policies and terms.
- Redirects are rejected, not followed. This both preserves the credential destination and works in the hosted Worker runtime.
- Refusals, incomplete output, malformed responses, and invalid source references do not become a completed AI report.
- AI relationships are visibly labeled as interpretations. A path that exists is not proof that an interpretation is correct.
- Exported guides identify the provider and model. Optional `ai-interpretation.mmd` is separate from `architecture.mmd`, which contains located source references.

Self-hosted instances can configure `GENIUS_PROVIDER`, the corresponding provider key, and `GENIUS_MODEL`. Web requests may use a server key only with the instance access password. A selection for a different provider never borrows that server key.

## Official implementation references

- [OpenAI models](https://developers.openai.com/api/docs/models) and [structured output](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Claude models](https://platform.claude.com/docs/en/models/overview), [Messages API](https://platform.claude.com/docs/en/api/messages/create), and [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
- [Gemini models](https://ai.google.dev/gemini-api/docs/models) and [generateContent API](https://ai.google.dev/api/generate-content). The adapter uses `generationConfig.responseFormat.text` with `mimeType: "APPLICATION_JSON"` and `schema`.
- [Kimi K3](https://platform.kimi.ai/docs/guide/kimi-k3-quickstart) and [response_format](https://platform.kimi.ai/docs/guide/response_format). The international API remains `api.moonshot.ai`; K3 requests use bounded low reasoning effort.

These integrations were verified with deterministic fixtures in each provider's documented response shape, including Claude responses that contain thinking blocks. **No paid model request was made during the 0.4.0 validation**, because no provider credentials were available; the first real call on each provider is still untested.
