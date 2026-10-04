# Data handling and analysis limits

## Where data goes

The browser sends repository identifiers and options to the instance you are using, plus your provider key only with an AI request you start. The instance reads metadata and source from GitHub. Repository code is never installed or executed. Browser dependencies are served locally; there is no analytics or external font service in the application.

The selected provider (OpenAI, Anthropic, Google, Moonshot, or DeepSeek) is contacted only when you enable AI interpretation, run Deep Genius, press **Ask** or **Test connection**, and your key plus a model is set. A question sends only the question and up to 12 excerpts (at most 32,000 characters) chosen in your browser from files already read; the server validates the size and forwards them to the provider without storing them. It receives repository identity, description, coverage, dependency evidence, and selected source excerpts. OpenAI requests set `store: false`; this does not override any provider's account policies or contractual data handling terms. File-name exclusions do not guarantee that source code contains no secrets. Review your repository and use AI only when authorized to share those excerpts.

## Credentials and private repositories

The only credential the website asks for is your AI provider key. It lives in the API settings field of the current tab (a masked text field that browser password managers neither autofill nor offer to save), travels only with the AI request you start, is forwarded to the provider you chose, and is then discarded. It is never written to browser storage, cookies, links, logs, caches, or exports. Switching providers clears the previous provider key. Fixed official API endpoints prevent an input URL from redirecting credentials.

The website analyzes **public** repositories only. It has no GitHub token field and ignores any GitHub token a request might carry; an optional server-side `GITHUB_TOKEN` raises the public API allowance. For private code, run the command-line tool locally with your own `GITHUB_TOKEN`. **Project extract, entire repository:** the server downloads the analyzed commit's archive from GitHub (one `api.github.com` request redirected to `codeload.github.com`), reads it in memory under size limits, returns the selected text, and keeps nothing. The server-side GitHub token, if configured, is sent to `api.github.com` only. Credential files (`.env`, private keys, `.npmrc`, and similar) are never read.

Only interface preferences are saved in `localStorage`: the color theme and whether each side panel is collapsed. The current tab also keeps up to four finished analyses in memory so Back and Forward do not repeat GitHub requests; **Remove key** clears them, and closing the tab discards them. The application does not log request bodies or keys. A hosting operator or reverse proxy must maintain equivalent controls.

A server-wide GitHub token cannot disclose a private repository: a private repository is refused unless the caller supplied their own token, which only the local command-line tool can do. Never paste credentials into the repository URL, a query parameter, or a public issue.

On the hosted Worker, neither public nor private reports enter a persistent report cache or server session map. Evidence search uses the source already held in the browser tab.

On the local Node server, private reports do not enter the shared public cache. They remain in their browser tab and in the server's bounded session map for evidence search. Sessions have a ten-minute access lifetime and unguessable IDs. Expired entries are cleaned up on subsequent requests; a process restart clears memory. Treat session IDs and downloaded source/documentation as sensitive. This initial version does not provide multi-user accounts or persistent encrypted storage.

On the local Node server, public structural reports are cached in memory by repository, commit, scope, and file budget for ten minutes, with at most twelve retained entries. AI output is not inserted into this shared cache. Refresh bypasses the public cache.

## What is and is not verified

GitHub file bytes are checked against their Git blob SHA. Source links are pinned to the resolved commit. The tree and the source-read budgets are reported separately. Tests and build manifests are checked for **presence**, not successful execution or quality.

Dependency extraction recognizes common literal JS/TS imports, Python imports, and C/C++ includes. It is not an AST or compiler and may miss aliases, multiline constructs, dynamic behavior, or language-specific resolution. An import is not proof of a runtime call. A documented wiring diagram is authored intent, not a hardware safety verification.

AI references are checked against actual repository paths and excerpt line ranges. A valid citation can still accompany an incorrect explanation. AI interpretations, recommendations, and proposed relationships require review. Failed or incomplete model calls leave the structural result available.

Mermaid renders with strict security settings, bounded graph size, sanitized SVG, and rejected configuration directives. Reports use sanitized Markdown, and repository images are not loaded in the generated guide. Unsupported author diagrams remain inspectable as source.
