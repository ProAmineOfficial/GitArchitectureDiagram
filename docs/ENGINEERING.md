# Make Any Product with Genius AI

**Start from an Idea** is the primary path of Git Architecture Diagram. Describe a product and Genius AI turns the idea into a structured engineering project:

- requirements, assumptions, and open questions;
- an architecture (components, interfaces, pin map, bill of materials) and Mermaid diagrams;
- engineering files you can edit;
- a tiered validation report;
- a Development Pack to download.

**Import GitHub Project** is the second path: the existing repository analysis. This document covers the first path.

## One workspace for both paths

An idea project opens in **the same workspace as a GitHub repository**. It uses the same Files sidebar, canvas, Genius sidebar, and Dock. The new **Workspace** icon comes first in the Dock.

- **Workspace (`/new`):** the composer when no project is open. It offers:
  - describe a product;
  - open the example project;
  - import a project file;
  - import a GitHub repository.

  When a project is open, the Workspace view shows its overview: requirements, progress, diagrams, files, validation, recent operations, and exports.
- **System Map:** the project's architecture diagram.
- **Architecture:** components and interfaces, drawn by code from the project data.
- **Hierarchy:** component groups, components, and files.
- **Mind Map:** requirements, components, files, and risks.
- **Diagrams:** the project's own diagrams.
- **Source:** every one of these diagrams, editable.
- **Genius:** the overview as Markdown.
- **Process:** how the project was made, and the validation tiers.
- **Export Project:** the Development Pack.
- **Export:** the current diagram.
- **Build:** the build and test steps from the report. They are **not run here**.

**What an idea project never shows:**

- the commit, refresh, permalink, Highlights, Deep Genius, or repository Ask controls;
- a repository tree. The Files sidebar lists the **generated engineering files**, each with its status from the validation report.

**Behavior of runs:**

- Until a project exists, every Dock view except Workspace is disabled.
- A failed run keeps the idea text and offers Retry. It never shows another project as its result.
- The prepared example opens only when asked.
- A project stays open in the tab while you visit a repository, so Back and Forward return to it.

## What runs where (open core)

| Part | Where | License |
|---|---|---|
| The composer (`public/idea.js`), the project views in the unified workspace (`public/project-workspace.js`, `public/project-views.js`), the `gad.project/1` format and its public helpers (`public/engineering.js`), the server interface (`src/engineering.mjs`), the HTTP routes, and the labeled example (`public/assets/engineering/example-esp32.json`) | This repository | AGPL-3.0-only |
| The **Genius Engineering Engine**: stage orchestration, prompts, structured-output schemas, the validation tiers and domain rule packs | A separate private service operated by Pro_Amine LLC | Proprietary |

No engine code, prompt, or rule pack is shipped to the browser or committed here. The public repository holds the format and the client, and that is enough to read, edit, export, and re-import a project. Running the generation itself needs the operator's engine.

## How a run works

The engine plans and checks. The public server runs every model call with the visitor's own key.

```
Browser ──(idea, key in tab memory)──▶ Public server ──(idea, no key)──▶ Engine POST /v1/start
                                            │◀── generation request + signed state
                                            │── model call with the visitor's key ──▶ AI provider (fixed endpoint)
                                            │── model output + state ───────────────▶ Engine POST /v1/resume
                                            │◀── next generation request … or the project + validation report
Browser ◀── NDJSON progress, then { project, validation, usage }
```

- **Stages:**
  - `clarify` produces requirements, assumptions, and questions.
  - `design` produces the architecture, then the files, then runs validation.
  - `regenerate` rewrites one file and re-validates.
  - `POST /api/engineering/validate` runs the checks only, with no model call and no key.
- **Key handling:** the server removes `apiKey` before anything goes to the engine. The engine never receives a provider key and never calls a provider.
- **Provider calls:** they use the existing provider layer (`callProviderJSON`), with fixed endpoints, classified errors, and bounded retries.
- **Limits:**
  - At most 6 engine steps per run.
  - 30 s per engine request; 180 s per provider call; 10 min per run.
  - 3 runs in flight per Node process.
  - 20 engineering requests per client address per minute.
  - Bodies up to 2.6 MB.

## Public HTTP API

| Route | Body | Result |
|---|---|---|
| `GET /api/engineering/status` | — | `{ state, configured, operational, connected, checkedAt }`. `state` is one of the readiness states below. Never the engine address, the token, its key id, or a refusal reason. |
| `POST /api/engineering/run` | `stage` (`clarify`, `design`, `regenerate`), `provider`, `model`, `apiKey`, plus `idea` (clarify: 12–4,000 characters) or `project` (design and regenerate), and optionally `answers` (`{ questionId: text ≤600 }`), `artifactId`, `instruction` (≤1,000) | `application/x-ndjson` stream: `progress` events, then one `result` (`{ project, validation, usage }`) or one `error` event |
| `POST /api/engineering/validate` | `{ project }` | `{ project, validation }` |

**Error handling:**

- A run answers HTTP 503 before any stream starts, and before the visitor's key is used, unless the engine is `operational` (or `unverified`). A malformed request answers 400.
- Engine messages for its own 4xx answers are shown.
- Engine 5xx answers and network failures are not detailed.
- An engine that rejects this server's token is reported as an operator problem (503).

## Engine contract

The private engine answers four routes. Each takes `Authorization: Bearer <GENIUS_ENGINE_TOKEN>`.

| Route | Body | Result |
|---|---|---|
| `GET /v1/health` | — | `{ ok, version }` |
| `POST /v1/ready` | — | `{ ok, version, stateSecret }`. This is the authenticated readiness check (engine 0.1.1 and later). |
| `POST /v1/start` | The validated run request **without** `apiKey` | `{ done: false, generation, state }` or `{ done: true, project, validation }` |
| `POST /v1/resume` | `{ state, output }` | Same as start |
| `POST /v1/validate` | `{ project }` | `{ done: true, project, validation }` |

A `generation` has this shape:

```
{ name, instructions, payload, schema, maxTokens }
```

The public server accepts it only when:

- `name` matches `^[a-z0-9_]{1,64}$`;
- `instructions` is 60,000 characters or fewer;
- `maxTokens` is 20,000 or fewer.

The `state` is opaque to the public server. It is the engine's signed, short-lived token, so neither side stores work in progress.

## Configuration

Set both variables in the hosting panel, never in Git:

| Variable | Purpose |
|---|---|
| `GENIUS_ENGINE_URL` | The engine's base URL. It must be HTTPS (plain HTTP is allowed only for `localhost` and `127.0.0.1`) and must contain no credentials. |
| `GENIUS_ENGINE_TOKEN` | Shared secret, 32 characters or more, identical to the engine's `ENGINE_TOKEN`. |

When the variables are absent, the workspace says the engine is not set up and offers the example. Both the Node server and the hosted Worker read the same variables.

### The token

Both services normalize the token the same way. The engine has a copy of the rules, and both test suites share `tests/fixtures/token-cases.json`.

- **Ignored:** surrounding whitespace and a trailing newline, one pair of surrounding quotes, and a `Bearer ` prefix.
- **Refused:** inner spaces, inner quotes, and fewer than 32 characters. The message names the variable and never shows the value.

At start-up, each service prints a **key id**: 8 hex characters of a one-way HMAC of the token.

- Public server log: `[engine] configured · key id 1a2b3c4d`
- Engine log: `Genius Engineering Engine 0.1.1 listening · key id 1a2b3c4d`

When the two key ids are equal, the tokens are equal. The key id cannot be turned back into the token.

### Readiness states

"Configured" only means the variables are set. Readiness means one authenticated `POST /v1/ready` succeeded. The result is cached for 60 s when operational and 15 s otherwise. Concurrent status requests share one engine call. An unreachable engine is retried once after 1.5 s, which covers a host waking from sleep.

| State | Meaning | What to do |
|---|---|---|
| `not_configured` | `GENIUS_ENGINE_URL` or `GENIUS_ENGINE_TOKEN` is missing or malformed | Read the `[engine] not configured: …` line in the server log |
| `unreachable` | No answer, or the host's own 502/503/504 page | Check the URL, the engine deployment, `HOST=0.0.0.0` on Railway, and sleeping services |
| `unauthorized` | The engine refused the token. The server log shows `reason=missing\|malformed\|mismatch` | Compare the key ids in both logs. If they differ, rotate the token (below) |
| `unavailable` | The engine answered with another error | Read the engine's log |
| `unverified` | The engine is older than 0.1.1 and has no `/v1/ready`. Runs are allowed | Deploy the current engine |
| `operational` | Connected and authorized | — |

`npm run engine:check` runs the same check where the public server's variables are set (or with a local `.env`). It prints the key id and the state, never the token.

### Rotating the token

1. Generate a token on your computer:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
2. On Railway, set `ENGINE_TOKEN` and **deploy** the staged change.
3. On Hostinger, set `GENIUS_ENGINE_TOKEN` to the same value and **restart** the app.
4. Check that both start-up lines show the same key id, and that `/new` reads "connected and authorized".

## The project format: `gad.project/1`

A JSON object with these fields:

- **Identity:**
  - `schema`, `id`, `title`, `summary`;
  - `domains` (for example `embedded`, `hardware`, `software`);
  - `targets` (`{ id, name, kind }`).
- **Requirements:**
  - `requirements` (`{ id, text, kind, priority, source }`);
  - `assumptions`;
  - `questions` (`{ id, question, why, default, answer }`).
- **Architecture:**
  - `components` (`{ id, name, kind, partNumber, purpose, satisfies, dependsOn }`);
  - `interfaces` (`{ id, from, to, kind, signals, voltage }`);
  - `pinMap` (`{ gpio, signal, component, direction, voltage }`);
  - `bom` (`{ ref, partNumber, description, quantity, component }`).
- **Diagrams and files:**
  - `diagrams` (`{ id, title, mermaid }`);
  - `artifacts` (`{ id, path, class, status, tool, purpose, content }`).
- **Planning:**
  - `validationPlan` (`{ id, title, verifies, method, tool }`);
  - `risks`;
  - `milestones`.
- **Record:**
  - `validation` (a `gad.validation/1` report);
  - `provenance` (`example`, `provider`, `model`, `engineVersion`, `generatedAt`);
  - `changes`.

Requirement sources:

| `source` | Meaning |
|---|---|
| `user` | Stated in the idea |
| `user-confirmed` | Answered by the visitor |
| `assumed` | Default used for an unanswered question |
| `ai-proposed` | Proposed by the model |
| `validated` | Confirmed by a check |

Artifact classes:

| `class` | Meaning |
|---|---|
| `native-source` | Source for a real tool, such as PlatformIO firmware |
| `interoperable` | An open format, such as CSV |
| `template` | A file to complete |
| `specification` | Input for a design tool, such as a PCB specification for KiCad |
| `conceptual` | A description, not a buildable file |

Artifact statuses, from weakest to strongest evidence:

| `status` | Shown as |
|---|---|
| `generated` | Generated — not independently verified |
| `structurally_checked` | Structurally checked |
| `syntax_checked` | Syntax checked |
| `build_verified` | Build verified |
| `simulation_tested` | Simulation tested |
| `tool_verified` | Externally tool-verified |
| `requires_physical_testing` | Requires physical or laboratory testing |
| `failed` | Failed validation |
| `edited` (set in the browser) | Edited — not re-validated |

## The validation report: `gad.validation/1`

The report has three parts:

- `summary`: `{ pass, warn, fail, notRun }`;
- `checks`: each check is `{ id, tier, tierName, title, target, tool, status, evidence, limitation, recommendation }`;
- `artifactStatus`.

A check's `status` is `pass`, `warn`, `fail`, or `not_run`. Every check is run by code, never by a model's opinion.

**"Not run" is never a pass.** It means the check needs a tool or a person that was not available, and the report says which. Build checks, for example, are `not_run` with the exact command to run (`pio run -e …`). Generated code is never compiled or executed on the server.

The ten tiers are:

1. Structure
2. Traceability
3. Consistency
4. Syntax and static checks
5. Build
6. Simulation and tests
7. Source ↔ specification
8. Domain rules (an ESP32 pack today)
9. Reproducibility
10. Human and physical review

Hardware specifications stay at "requires physical testing" whatever the code checks find.

## Honesty rules

- A generated PCB, chip, proof, simulation, or physical product is never shown as validated without evidence from a real tool or a real test.
- Native PCB or simulation files are produced only when the required tool actually ran. Today no such tool runs, so PCB output is a specification for KiCad or another design tool.
- An image is never a substitute for an engineering source file.
- The example project is labeled as prepared by Pro_Amine LLC. It was not generated from the visitor's text, and its report comes from the engine's code checks.

## Privacy

Projects live in the browser tab and in the files the visitor exports. The public server and the engine do not store ideas, projects, or model output, and they do not log them. The engine never receives the provider key. Nothing from this workspace enters the public analysis cache. See [PRIVACY.md](PRIVACY.md).

## Current limits (Checkpoint B)

- The engine runs as a separate private service that the operator must deploy and connect. Until then, the live site shows the labeled ESP32 example, project import, editing, and export.
- Domain rules cover the classic ESP32 (WROOM/WROVER). Other targets get structural, traceability, consistency, and syntax checks, and `not_run` for domain rules.
- No compiler, simulator, ERC/DRC tool, or notebook runner is executed. Those tiers report `not_run` with the next step.
- Mermaid syntax is checked by the real Mermaid parser in the browser. On the server it gets a structural scan.
