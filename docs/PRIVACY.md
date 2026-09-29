# Data handling and analysis limits

## Where data goes

The browser sends repository identifiers, options, and any supplied credentials to the instance you are using. The instance reads metadata and source from GitHub. Repository code is never installed or executed. Browser dependencies are served locally; there is no analytics or external font service in the application.

The selected provider (OpenAI, Anthropic, Google, or Moonshot) is contacted only when AI interpretation is explicitly enabled and an authorized key plus model is available. An interpretation receives repository identity, description, coverage, dependency evidence, and selected source excerpts. A deliberately submitted AI question rereads up to eight verified files at the same commit and sends bounded relevant excerpts. Free keyword search and source browsing make no model calls. OpenAI requests set `store: false`; this does not override any provider's account policies or contractual data handling terms. File-name exclusions do not guarantee that source code contains no secrets. Review your repository and use AI only when authorized to share those excerpts.

## Credentials and private repositories

Switching providers clears the previous provider key. Fixed official API endpoints prevent an input URL from redirecting credentials.

Credentials are held in browser input fields and request memory, not browser storage or report exports. Only the color theme is saved in `localStorage`. The application does not log request bodies or keys. A hosting operator or reverse proxy must maintain equivalent controls.

A server-wide GitHub token cannot disclose a private repository: the caller must supply their own token. GitHub still decides which resources that token may read. Use the least repository read access needed. Never paste credentials into the repository URL, a query parameter, or a public issue.

On the hosted Worker, anonymous public structural reports can enter a short-lived cache in the current isolate. It expires after ten minutes, holds at most twelve reports, and is not persistent or shared between isolates. There is no hosted server session map. Private reports and any analysis using a caller or server GitHub token bypass the shared cache. Paid interpretations and question answers are not cached. Evidence search uses source already held in the browser tab.

On the local Node server, private reports do not enter the shared public cache. They remain in their browser tab and in the server's bounded session map for evidence search. Sessions have a ten-minute access lifetime and unguessable IDs. Expired entries are cleaned up on subsequent requests; a process restart clears memory. Treat session IDs and downloaded source/documentation as sensitive. This initial version does not provide multi-user accounts or persistent encrypted storage.

On the local Node server, anonymous public structural reports are cached in memory by analyzer version, repository, commit, scope, and file budget for ten minutes, with at most twelve retained entries. AI output is not inserted into this shared cache. Refresh bypasses the public cache.

## What is and is not verified

GitHub file bytes are checked against their Git blob SHA. Source links are pinned to the resolved commit. The tree and the source-read budgets are reported separately. Tests and build manifests are checked for **presence**, not successful execution or quality.

Dependency extraction recognizes common literal JS/TS imports, Python imports, and C/C++ includes. It is not an AST or compiler and may miss aliases, multiline constructs, dynamic behavior, or language-specific resolution. An import is not proof of a runtime call. A documented wiring diagram is authored intent, not a hardware safety verification.

AI graph references are checked against actual repository paths and excerpt line ranges; graph edges also require an exact source-line quote. AI question findings require exact quoted citations within the excerpts sent for that question. Findings with invalid citations are dropped. Concepts without source paths remain visibly unmapped. A valid citation can still accompany an incorrect explanation. AI interpretations, recommendations, and proposed relationships require review. Failed or incomplete model calls leave the structural result available.

Mermaid renders with strict security settings, bounded graph size, sanitized SVG, and rejected configuration directives. Reports use sanitized Markdown, and repository images are not loaded in the generated guide. Unsupported author diagrams remain inspectable as source.
