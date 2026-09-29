# Genius AI providers

Genius performs tree, import/include, documentation, and Mermaid analysis without an AI service. Optional interpretation uses the provider chosen in **API settings** only after **Add Genius AI interpretation** is enabled. It sends bounded source excerpts and validates returned paths and line references before showing an explanation. An AI failure preserves the structural report.

## Analysis and questions

Architecture interpretation uses one request with at most 110,000 source characters and 6,000 output tokens. The response is a validated structured graph: IDs, roles, shapes, groups, verified paths, and quoted edge evidence. The application compiles Mermaid itself. Unsupported paths and citations are removed; conceptual nodes are visibly unmapped. A bounded overview shows up to 24 nodes, with omission counts.

In the Genius panel, **Search source** is free keyword matching. Choose **Ask Genius AI**, review the disclosed file list, and submit to request one paid answer. Each question freshly verifies repository access and the commit, rereads up to eight files, sends at most 24,000 source characters, and limits output to 3,000 tokens. Accepted findings carry exact file/line/quote citations; an inference is labeled explicitly. Suggested follow-up questions only fill the input and never purchase another call automatically.

These are request and token limits, not a guaranteed currency ceiling. Provider/account/model pricing controls the bill. Browser history, direct links, refresh, and folder focusing never replay a paid request. Cancellation stops application processing and signals the provider, but cannot guarantee reversal of charges already incurred.

## Model presets

The following presets were checked against official catalogs on **September 29, 2026**. They are editable suggestions, not a promise of automatic access, ongoing availability, or the same cost. Enter another supported text model ID when needed.

| Provider | Initial preset | Other presets | Native endpoint |
| --- | --- | --- | --- |
| OpenAI | `gpt-6-sol` | `gpt-6-astra`, `gpt-6-luna` | Responses |
| Claude / Anthropic | `claude-sonnet-5-5` | `claude-opus-5-5`, `claude-fable-5-1` | Messages |
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

These integrations were verified with deterministic provider response fixtures. No paid model request was made during this release validation.
