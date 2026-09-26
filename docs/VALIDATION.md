# Initial release validation

Validation date: **2026-09-26**. These observations describe the tested revision and environment, not a guarantee for every repository or hosting provider.

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

OpenAI integration was tested with a mocked Responses API contract. No paid model request was made because no provider key was configured. Private-token isolation was tested with fixtures, not a user's private repository. Docker and provider-specific public hosting were not deployed as part of this source release. A public domain must still be configured by the deployment operator.

## Reproduce essential checks

```bash
npm ci
npm run check
npm test
npm start
```

In the browser, analyze a small repository, inspect both a read and an unread file, switch all four views, edit/reset Mermaid, export every format, and repeat at mobile width. For a large repository, narrow the folder scope and confirm the coverage changes. Do not enable paid AI during routine validation unless you intend to use provider credits.
