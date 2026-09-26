# Release validation

Validation date: **2026-09-26**. These observations describe the tested revision and environment, not a guarantee for every repository or hosting provider.

## Version 0.2.1: reported production failures

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
