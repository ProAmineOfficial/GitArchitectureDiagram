# Release validation

## Version 0.9.0: view dock and Export Project

Validation date: **2026-10-03**, sandbox, Chromium 141.

- `npm run check`: 34 modules. `npm run build`: succeeded.
- `npm test`: **67 passing**, with 3 new tests:
  - the magnification curve at the dock's item pitch, which is symmetric and decreasing;
  - the rise in proportion to scale;
  - the developer and knowledge packs, including their *verified source* and *Genius inference* labels.
- `npm run test:browser`: **26 passing**, with 7 new checks:
  - ten distinct dock icons, the AI badge, the count badge shown only with diagrams, two separators, and the amber active state with its moving dot;
  - proximity magnification on neighbors, and the reset when the pointer leaves;
  - arrow-key focus and Enter;
  - the dock's Export opening the shared menu under the dock button without changing the view, then returning to the command bar;
  - Export Project cards, the exact clone command, SVG, PNG, and Mermaid downloads for non-current views, the Developer Pack ZIP contents, and plan modes;
  - permalinks carrying and restoring the view;
  - reduced motion and narrow layouts with no magnification.
- **Measured magnification** across six icons with the pointer on Software Hierarchy: 1.062, 1.220, 1.480, 1.235, 1.063, 1.008.
- **No horizontal overflow** at 820 px or 390 px, and no page errors.

Found and fixed during validation:

- **Dock calibration:** the curve was first calibrated for a 58 px item pitch, but the real pitch is about 67 px.
- **Narrow windows:** narrow windows with a mouse magnified icons inside a scroll container that clips them.
- **Count badge:** it showed 0.
- **Icon shadow:** the magnified icon's shadow covered its label.


## Version 0.8.0: Project extract

Validation date: **2026-10-03**, sandbox.

- `npm test`: **64 passing**, with 5 new tests:
  - pattern semantics;
  - one API request plus one codeload download, with the token sent only to `api.github.com`;
  - credentials never read, binaries and oversized files excluded, default excludes;
  - scope, include/exclude, and size limits on the server;
  - an unexpected redirect host refused without contact, and malformed input refused before any request;
  - rate-limit, compressed, unpacked, and content-budget limits;
  - the Worker NDJSON stream.
- `npm run test:browser`: **19 passing**, with 2 new flows:
  - the five sections, per-section Copy, Copy all, and Markdown download;
  - the entire repository through the server with include/exclude filters.
- **Real large repository:** an archive built from `inngest/inngest` (80 MB, 13,143 files) and fed to the extractor.
  - Node with default filters: 3,024 files, 13.9 MB, 2.3 s.
  - Node with `*.go`: 1,155 files, 2.1 s.
  - Worker limits: refused in 0.1 s by Content-Length, before download.
  - This exercises the parser and the limits on real data; it was not a live GitHub download.
- Fixed during validation: server-locale-dependent ordering is now code-point ordering, and token counts are labeled by what they measure.

Not verified: a live codeload download from GitHub (the sandbox's GitHub allowance was unavailable), and the hosting platform's real CPU limits for large archives.


## Version 0.7.0: Highlights, Software hierarchy, Repository mind map, Build with Genius, verified answers

Validation date: **2026-10-03**, sandbox.

- `npm run check`: 30 modules. `npm run build`: succeeded.
- `npm test`: **59 passing**, with 13 new tests:
  - highlight modes and basis labels;
  - the hierarchy layers and badges;
  - mind map concepts that map to paths, and README features;
  - observed versus recommended skills, and no invented skills;
  - every required prompt section;
  - the clone command without credentials, the README badge and picture Markdown, extract limits, and the reconstruction pack contents;
  - server-side citation verification against a real Git repository, including a planted quote that must stay unverified.
- `npm run test:browser`: **17 passing**, in-repository, with Playwright Chromium 141. A temporary Git repository is served by the GitHub emulator, and model calls are answered by a deterministic mock in the OpenAI Responses shape. Covered:
  - the system map opening first, and its animated flow edges;
  - Highlights: data flow, keyword, and clear;
  - grouped Export tabs, the README badge, and the README picture PNG download;
  - development prompt modes and download, the skills JSON export, and skills for your app;
  - verified and inferred answers through the UI;
  - hierarchy collapse and Explain;
  - mind map to Genius to Architecture cross-view selection;
  - drawers and Escape, light theme, the mobile bottom sheet with no overflow, and no page errors.

Found and fixed during validation:

- **Mermaid render-id prefix:** this Mermaid version prefixes edge ids with the render id, which silently disabled edge highlighting.
- **Data-flow entry points:** a heuristic treated `App.jsx` as an entry point.
- **Mind map labels:** labels contained parentheses that the label sanitizer removes.

Not verified: real provider calls; a live GitHub run of this release; Safari and Firefox; very large repositories such as `inngest/inngest`.


## Version 0.6.0: diagram-first workspace

Validation date: **2026-09-30**, sandbox, Chromium 141. `npm test`: **52 passing**; check and build succeeded.

Browser checks, all passing:

- **14 new layout checks:**
  - the home page centers the input, and the repository page tucks it away behind the action bar;
  - the diagram spans more than 1,200 px at a 1,440 px viewport;
  - page scrolling is not captured by the diagram until it is clicked;
  - Info summary, Files and Genius drawers, Escape closing them, SVG export from the menu, Tour starting from the bar, and pinning panels side by side;
  - at 390 px there is no horizontal overflow and the Genius drawer opens;
  - no page errors.
- **The 40 earlier journeys and 13 system-map checks still pass.** Three journey steps now use the new controls: the search button reveals the input, the Files drawer toggle, and the Export menu.

The system map in these checks still comes from a **mocked provider response**; no real model request was made.


## Version 0.5.0: System map, guided tour, liquid glass

Validation date: **2026-09-29**, sandbox. `npm test`: **52 passing**, with 4 new tests covering actor/external kinds, tour validation and flow edges, one model call per saved public map, the daily limit, private repositories never using the site key, and visitor-paid maps not being shared. `npm run check` and `npm run build` succeeded.

Browser, Chromium 141: the **40 earlier journey checks still pass**. **13 system-map checks pass** against the Driver-NanoKit repository (real clone) with a **mocked OpenAI response** (a hand-written graph using real paths and README lines). Covered:

- the System map opening first, and actors, outside systems, and groups being drawn;
- 4 animated flow edges, with dotted styles restored after the entrance animation;
- the legend;
- tour steps that focus nodes and light the incoming edge;
- Escape ending the tour, and a mapped node opening `silabser.inf`;
- a reload serving the saved map with **one model call across four page loads**;
- the empty state without a key, reduced motion, and no page errors.

This validates rendering, validation, caching, and motion. **It does not measure the quality of a real model's map.** No real provider request has been made.


## Version 0.4.0: routes, component overview, grounded answers

Validation date: **2026-09-29**, in a development sandbox. Each check type below is reported separately, because they prove different things.

### Unit and integration tests (Node, no network)

`npm test`: **48 passing, 0 failing**. `npm run check`: 25 modules. `npm run build`: succeeded. New tests cover:

- ref resolution for slash branches, tags, and commit SHAs in at most 5 GitHub requests, against a real temporary Git repository;
- blob URLs scoping to the nearest project folder, with the file read first;
- rate-limit reset messages, HTML interstitials, and a single retry for 5xx only;
- evidence-following ingestion (a manifest's `main`, then imports) ahead of examples;
- the component overview drawing only observed edges and skipping standard libraries;
- graph validation (invented paths become unmapped concepts; out-of-excerpt evidence is downgraded);
- grounded answers (citation filtering, input limits enforced before any provider call, Claude thinking blocks ignored, provider HTML errors);
- the Worker's `/api/ask` (an anonymous visitor cannot use the server key) and workspace fallback for GitHub pull-request and commit paths.

### Browser journeys (Chromium 141, sandbox)

A harness ran the real Node server with GitHub traffic served by `tests/support/github-emulator.mjs` from **real Git clones** of `ProAmineOfficial/NanoKit-ESP32` (17834db), `ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC` (4fddb89), and `expressjs/express` (98bd4cd). This proves application behavior on real repository content. It does not prove live GitHub availability. The harness script is not part of this repository.

**40 of 40 journey checks passed**:

- Deep links and history:
  - root, tree, and blob deep links;
  - `#L20-L24` highlighting that survives a refresh, and line-number anchors;
  - Back and Forward without re-analysis;
  - Back during a running analysis, which cancels it without rewriting history.
- Navigation and diagrams:
  - permalinks pinned to the SHA;
  - component click → folder inspector → file drill-down → source inspector, with the tree selection in sync;
  - docs scopes opening the author's diagram with its colors.
- Editing and exports:
  - Mermaid syntax errors caught before rendering, edited previews labeled, and reset restoring source links;
  - SVG, PNG, and `.genius` ZIP downloads, with the ZIP's members checked.
- Controls:
  - arrow keys between tabs, `+` to zoom the canvas, `/` to focus file search;
  - panel collapse.
- Error messages: rate limit, HTML gateway, GitHub pull-request URL, and unknown branch.
- Browse: six cards with previews, type filter, search, and opening a live analysis at the pinned commit.
- No uncaught page errors.

The sandbox screenshots also covered light theme and a 390-pixel mobile layout; the mobile layout had no horizontal overflow and a working panel switcher.

### Live external calls

- **GitHub:** the sandbox's shared unauthenticated allowance (60 requests per hour) was exhausted throughout this session, so no full live analysis ran. One live request confirmed the new rate-limit handling end to end: HTTP 429 with *"It resets in about 38 minutes (19:18 UTC)"* taken from GitHub's headers.
- **AI providers:** none. No credentials were available. Architecture graphs and answers are verified only against mocked responses in each provider's documented shape.

### Not yet verified

- A complete live GitHub analysis of this release, and the production Worker running 0.4.0. It must be deployed first.
- Any real OpenAI, Claude, Gemini, or Kimi request, including structured-output acceptance of the new graph schema by each provider.
- Private repositories with a real fine-grained token.
- Safari and Firefox, and screen readers beyond keyboard operation.
- `diagram.proamine.tech` and `gitarchitecturediagram.com`. See [Deployment](DEPLOYMENT.md#custom-domain) for the observed DNS state.

### Deferred

Narrated video tours, like GitDiagram's `/video` pages, are **not implemented**. They need script generation, speech synthesis, rendering, storage, and a cost model, and should be scoped separately with real assets.

Validation date: **2026-09-26**. These observations describe the tested revision and environment, not a guarantee for every repository or hosting provider.

## Version 0.2.1: reported production failures

Follow-up: version 0.2.1 passed the Node tests but still failed on the production Worker. An actual workerd probe identified an additional failure: `redirect: 'error'` is rejected by that runtime before a network request starts. Version **0.2.2** uses `redirect: 'manual'` and explicitly rejects redirected GitHub requests without forwarding credentials. The optional AI request uses the same supported mode. A permanent workerd integration test bundles the actual Worker, substitutes only the two external providers, and verifies GitHub ingestion, blob hashing, optional AI, the streamed browser protocol, and both generated diagram sources. No paid AI request is involved.

Version 0.2.2 passes **27 tests**, including the native runtime test, plus the syntax checks and production build. The configured Mermaid parser also accepts the generated architecture, generated mind map, and authored flowchart fixtures in a DOM-backed syntax check; that is not a browser visual/layout check.

The production API reproduced the reported `Cannot reach GitHub` error for `ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC`, while GitHub itself returned HTTP 200 for that repository. The reader was calling the native fetch function as an object method, which violates the Workers receiver contract. A native-style receiver regression reproduced the failure before the fix. The transport now invokes fetch without rebinding it to the reader.

The browser response reader now checks content types before parsing. Regression tests cover HTML gateway pages, HTTP 200 HTML fallbacks, JSON access errors, malformed and interrupted streams, and UTF-8 characters split across network chunks. HTTP failures no longer surface as raw `Unexpected token '<'` exceptions. Configured custom domains are tested against an explicit origin allowlist, including rejection of lookalike and insecure origins.

The full suite passes **25 tests**, all **13 application/build modules** pass syntax checks, and the production browser/Worker build succeeds. These checks do not imply a fresh browser visual pass or completed custom-domain DNS validation.

## Version 0.2.0: hosted workspace

- `npm test`: **20 passing tests**. The added Worker tests exercise repository route fallback, streamed analysis with real ingestion logic and deterministic GitHub fixtures, request boundaries, role colors, and preservation of authored Mermaid styles.
- `npm run check`: all **12 application and build modules** passed syntax checks.
- `npm run build`: produced the browser assets and the Worker with a callable default `fetch` handler. The compiled health endpoint reported version `0.2.0` and a 40-file hosted limit.
- A **live GitHub analysis through the compiled Worker** resolved the exact scoped URL `https://github.com/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance/docs` to commit `17834db850daec9b450239069c4aa2e758bf0644`. It read **2 files**, found **1 authored Mermaid block**, and skipped **0 files** in that scope.
- That live check exposed GitHub's HTTP 422 response for an invalid branch-plus-folder candidate. The resolver now tries shorter candidates for both 404 and 422 responses, with a regression fixture covering 422.
- Tracked project text was checked for Arabic characters after removing the translated README. Original source excerpts and filenames from analyzed repositories remain verbatim.

The live ingestion check ran locally against GitHub using the compiled hosting adapter. The hosting provider reported a successful production publication at `https://git-architecture-diagram.pro-amine.chatgpt.site`. This confirms deployment status, not a browser interaction pass on that URL. No new browser visual or download pass was performed for this release. The optional, feature-detected WebMCP integration has not been exercised in a supporting browser.

## Version 0.1.0: original workspace

- `npm test`: **16 passing tests**, using actual module logic and deterministic provider fixtures.
- `npm run check`: all **9 application modules** passed Node syntax checks.
- `npm audit --omit=dev`: **0 reported vulnerabilities** at the time of the check.
- Chromium desktop and mobile checks: four workspace views, source inspection from tree and graph nodes, source evidence search, Mermaid source editing/reset, dark/light themes, and no horizontal overflow at 390 pixels. No uncaught browser errors were observed.
- Browser downloads: Mermaid, SVG, PNG, and `.genius` ZIP produced real files. ZIP integrity and expected members were checked.

## Live GitHub ingestion

The actual GitHub API was used to analyze `ProAmineOfficial/NanoKit-ESP32` at commit `17834db850daec9b450239069c4aa2e758bf0644`:

| Measure | Observed result |
| --- | --- |
| Tree entries | 326 |
| Listed files | 195 |
| Eligible text files | 181 |
| Files read with a 24-file budget | 24 |
| Verified source bytes | 160,591 |
| Local import/include references | 14 |
| Authored Mermaid blocks in that sample | 1 |

The remaining eligible files were explicitly marked as unread. Subsequent UI interaction tests replayed this recorded public result to avoid consuming GitHub quota repeatedly; the initial ingestion itself was live.

A separate **live CLI analysis** of `examples_on_platformio/ultrasonic_distance` read 12 files and successfully wrote a Genius guide, architecture, mind map, tree, and evidence JSON. Its zero resolved local dependency edges correctly do not turn external Arduino headers into invented local modules. The generated guide reported its actual input scope and source commit.

## Not validated against a live service

OpenAI integration was tested with a mocked Responses API contract. No paid model request was made because no provider key was configured. Private-token isolation was tested with fixtures, not a user's private repository. Docker has not been deployed in these checks. The custom domain `gitarchitecturediagram.com` still requires ownership verification and DNS configuration; it is separate from the generated hosting address.

## Reproduce essential checks

```bash
npm ci
npm run check
npm test
npm run build
npm start
```

In the browser, analyze a small repository, inspect both a read and an unread file, switch all four views, edit/reset Mermaid, export every format, and repeat at mobile width. For a large repository, narrow the folder scope and confirm the coverage changes. Do not enable paid AI during routine validation unless you intend to use provider credits.

## v0.3.0 — provider and workspace expansion

The v0.2.2 fix was published to the existing website and verified through real hosted analysis requests. The Worker reported version `0.2.2` and successfully returned reports for:

| Repository / scope | Commit | Files read | Authored Mermaid blocks | Located relationships |
| --- | --- | ---: | ---: | ---: |
| Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC | `4fddb896b515fc31896737c2fbe9b71478947969` | 3 | 0 | 0 |
| NanoKit-ESP32 / docs | `17834db850daec9b450239069c4aa2e758bf0644` | 6 | 0 | 0 |
| NanoKit-ESP32 / examples_on_platformio/ultrasonic_distance/docs | `17834db850daec9b450239069c4aa2e758bf0644` | 2 | 1 | 0 |
| GitArchitectureDiagram | `7479a8dc36a179fd2b86c2ee09e48c6af4cfde1d` | 10 | 1 | 8 |

The public examples catalog records these real snapshots and their coverage. A successful analyzer request is not a successful test or build of the analyzed project.

The v0.3.0 regression suite covers four native provider contracts, invalid or truncated model output, provider credential isolation, scoped file/folder navigation, and the examples/blob routes. A separate DOM-backed interaction check exercised the actual application with a stubbed Mermaid SVG renderer: provider changes cleared the previous key, example search filtered cards, generated nodes supported keyboard navigation, the inspector exposed exact dependency lines, and edited/authored diagrams stayed unmapped even after a theme change.

Mermaid syntax is also checked with the installed real parser against generated architecture, generated mind maps, and the preserved NanoKit authored flowchart. These checks do not substitute for a browser layout review. No fresh browser visual review or paid-provider generation is claimed.

Final local release checks: **31 tests passed**, **19 shipped modules passed syntax checks**, the production Worker/browser build completed, all eight generated/authored Mermaid samples parsed, and both DOM interaction scenarios passed. Paid provider responses and browser layout remain outside this validation.

Post-publication check: v0.3.0 was published successfully and GitHub CI passed for `96e97511a9ddfa4ea920d0dbbda317f2f8c900ae`. The final anonymous production analysis attempt returned GitHub's access/rate-limit error before a report completed. Earlier real v0.2.2 requests succeeded as listed above; the later request is not counted as a successful analysis. A caller-supplied GitHub read token in API settings provides authenticated allowance; no real token or paid AI key was available for this final check. The custom hostname `diagram.proamine.tech` remains pending DNS validation because Hostinger blocked cloud-browser access.
