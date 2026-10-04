# Application architecture

The browser, the HTTP API (Node server or hosted Worker), and the CLI share one analysis engine. Repository content is read as data and never executed.

```mermaid
flowchart TD
  Browser["Browser workspace"] -->|"POST /api/analyze · NDJSON"| HTTP["Node server / Worker"]
  Browser -->|"POST /api/ask · opt-in"| HTTP
  CLI["Local CLI"] --> Service["Analysis service"]
  HTTP --> Service
  Service --> Reader["GitHub reader"]
  Reader -->|"refs, commit, tree, blobs"| GitHub[("GitHub REST API")]
  Reader --> Ingest["Evidence-following ingestion"]
  Ingest --> Genius["Genius: imports, overview, reading order"]
  Genius --> Graph["Graph validator and Mermaid compiler"]
  Service -.->|"explicit AI only"| Model["Selected provider"]
  Model -.->|"component graph"| Graph
  Graph --> Report["Report and guide"]
  Browser -->|"POST /api/genius/agent · one agent per call"| HTTP
  HTTP -.->|"allowlisted agent, server instructions"| Model
  Report --> Browser
  Report --> CLI
  classDef ext fill:#1b212b,stroke:#8a96a8,stroke-dasharray:5 4,color:#f3f7ff
  class GitHub,Model ext
```

| Module | Responsibility |
| --- | --- |
| `src/github.mjs` | Validate inputs; resolve tree/blob refs through `git/matching-refs` (slash branches, tags, SHAs); pin one commit; read the tree and SHA-verified blobs; rate-limit, permission, HTML, and transient-failure handling; evidence-following ingestion |
| `src/overview.mjs` | Reference discovery (imports, manifest entry points), component overview, reading order |
| `src/graph.mjs` | Validate a structured graph against the commit's paths and excerpt lines; compile it to Mermaid with one shape and color per kind and one line style per evidence basis |
| `src/genius.mjs` | Lexical import/include extraction, file-level graph, mind map, authored-diagram discovery (`.md`, `.mmd`), guide |
| `src/ai.mjs` | Bounded excerpts, the architecture interpretation schema, reference and graph validation |
| `src/ask.mjs` | Grounded single-question answers from client-supplied excerpts, with citation validation |
| `src/providers.mjs` | Fixed-endpoint adapters for OpenAI Responses, Claude Messages, Gemini generateContent, Kimi, and DeepSeek Chat Completions; model-list requests; credential resolution |
| `src/provider-errors.mjs` | One classification of provider failures (auth, quota, rate limit, model, timeout, malformed, truncated, refused), bounded retries with `Retry-After` and jittered backoff |
| `src/model-registry.mjs` | Exactly two verified models per provider, refreshed from the official model list per key (12-hour cache), and Test connection |
| `src/genius-agent.mjs` | One allowlisted Deep Genius agent call: server-side instructions and schema, schema conformance of the output |
| `public/providers.js` | The shared provider catalog: Fast and Advanced models, structured-output mode, key-format check |
| `public/repo-intel.js` | Repository intelligence: role classification, per-file/folder/subsystem/repository summaries cached by blob SHA, per-agent retrieval, lazy expansion |
| `public/genius-evidence.js` | The evidence contract: paths, lines, quotes, and commits verified against the analysis |
| `public/genius-agents.js`, `public/genius-core.js` | Nine agents in three teams plus Genius Core; the orchestrator (concurrency 3, at most two revise-and-revalidate loops, UNRESOLVED kept with both positions) |
| `public/deep-genius.js` | Deep Genius panel section, confirmation, agent results, and the Process view |
| `public/brand.js` | Local brand assets with fallbacks, official icon swap, footer reveal |
| `src/service.mjs` | Orchestration, credential isolation, public cache (Node only), sessions (Node only) |
| `server.mjs` / `worker.mjs` | HTTP routing, origin/access/rate checks, NDJSON streaming, SPA fallback for every `/owner/repo/...` path |
| `public/route.js` | Pure mapping between GitHub-shaped paths and analysis requests; permalinks |
| `public/app.js` | Workspace state, history, views, tree, inspector, Genius panel |
| `public/diagram.js` | Mermaid rendering (strict security, sanitized SVG), pan/zoom, syntax checks, light-theme tints for generated diagrams |
| `public/ask.js`, `public/browse.js`, `public/exports.js` | Questions, the example catalog, and local downloads |
| `tests/support/github-emulator.mjs` | Test transport that serves real Git repositories through the GitHub REST routes above |

## Analysis contract

1. Parse the address. For tree/blob URLs, list matching branch and tag names and choose the longest that prefixes the path; a hexadecimal first segment is tried as a commit. The remainder is the folder or file.
2. Resolve one commit and read its recursive tree. A blob URL analyzes the file's nearest folder containing a project manifest, with the file read first.
3. Rank candidate files by path hints (scope README and manifests first; examples and tests demoted when core code exists). Read files one at a time; after each read, raise the priority of files it imports and entry points it declares. Record why each file was read.
4. Verify every blob against its Git SHA. Report skipped and unread files.
5. Extract located imports/includes; build the component overview, per-component file graphs, the mind map, the reading order, and the guide. Invisible Mermaid links only arrange unconnected nodes and are marked as such in the source.
6. Only on request, send bounded excerpts to the chosen provider. Validate its graph against the commit before compiling Mermaid; keep interpretation separate from extracted facts.

## HTTP API

`POST /api/analyze` — JSON `repository`, optional `ref`, `scope`, `maxFiles`, `githubToken`, `refresh`, `ai`, `provider`, `apiKey`, `model`. Returns `application/x-ndjson` with `progress`, `result`, and `error` events. After streaming starts, errors arrive as an `error` event with HTTP 200; clients must read to the end. The browser checks the content type before parsing and names HTML gateway pages as such.

`POST /api/ask` — JSON `ai: true`, `question` (≤600 characters), `excerpts` (≤12, each `path`, `startLine`, `text` ≤4,000 characters, ≤32,000 total), `repository`, `commit`, `provider`, `apiKey`, `model`. Returns `answer`, `findings` (each with `path` and `line` inside a sent excerpt), `suggestions`, `answered`, `discardedCitations`, `usage`. Requests without `ai: true` get evidence search on the Node server (session-based) and HTTP 400 on the Worker, where keyword search runs in the browser.

`POST /api/models` — JSON `provider`, optional `apiKey`. Returns the two recommended models (`pair.fast`, `pair.advanced`), their availability for the key, and whether they came from the bundled catalog, discovery, or the cache.

`POST /api/provider/test` — JSON `provider`, `apiKey`, `model`. Runs two independent checks (the official model list, then one tiny structured request that must return `{"ok": true}`) and returns `status`, `message`, four `checks` (Authentication, Provider reachable, Model available, Tiny inference), and safe `diagnostics` (provider, model, whether a key arrived and its length, endpoint host, HTTP statuses, classification — never the key).

`POST /api/genius/agent` — JSON `agent` (1A–3C or `core`), `stage`, `repository`, full `commit`, `scope`, `payload` (bounded evidence and prior team outputs), `provider`, `apiKey`, `model`. Returns the schema-conformed `output`, `usage`, `model`, and `attempts`. Provider failures return HTTP 502 with `error`, `kind`, `retryable`, and `suggestion`. The browser runs the orchestrator and verifies every citation against the analysis it holds.

`GET /api/health` — version, runtime limits, provider identifiers, and the public system-map allowance. There is no instance password: every API route is public, same-origin, and rate-limited, and a web request only ever uses the provider key sent with it.

Both runtimes allow 20 API requests per client address per minute (90 for Deep Genius agent calls, which are short and bounded at three in flight); the Node server runs up to 3 analyses at once, the Worker 2 per isolate with 48 GitHub requests per run. Request bodies are capped at 20 KB (64 KB for `/api/ask`).

## Hosted build

`npm run build` writes `dist/client` (bundled browser code, styles, fonts) and `dist/server/index.js` with `wrangler.json` declaring the assets binding and Node compatibility.
