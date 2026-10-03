# Deploy the analyzer

The application supports a **hosted Cloudflare-compatible Worker** and the existing **local Node.js server**. Static hosting alone cannot run repository analysis.

The configured website is [Git Architecture Diagram](https://git-architecture-diagram.pro-amine.chatgpt.site). Its canonical source is the original `ProAmineOfficial/GitArchitectureDiagram` repository. Do not create a replacement repository for updates. The hosting identity is recorded in `.openai/hosting.json`; it is not a provider credential.

## Hosted build

```bash
npm ci
npm run build
```

The build creates `dist/server/index.js` and `dist/client`, with an `ASSETS` binding and Node compatibility declared in `dist/server/wrangler.json`. The existing Site must be published from the same reviewed GitHub source commit. Future changes must update this repository and republish that Site; an arbitrary GitHub push alone does not trigger a Sites deployment.

The hosted Worker accepts up to 40 files per run and does not retain report/session caches. Evidence search runs in the browser using already-read files. Optional AI remains disabled unless requested with an authorized key and model. No provider API key is bundled into browser assets.

When a Worker serves both the generated address and a custom domain, set `PUBLIC_ORIGINS` to a comma-separated list of their exact HTTPS origins. Keep `PUBLIC_ORIGIN` as the primary origin. Without `PUBLIC_ORIGINS`, the Worker uses `PUBLIC_ORIGIN` as before. The local Node server continues to use its single `PUBLIC_ORIGIN`.

## Custom domain

Status checked from the development sandbox on **2026-09-28/29 UTC**; re-check before announcing any address.

| Address | DNS observed | Meaning |
| --- | --- | --- |
| `git-architecture-diagram.pro-amine.chatgpt.site` | Resolves; serves the application | The working public address |
| `diagram.proamine.tech` | **No DNS record** (the name does not resolve) | The hosting side lists it as attached and pending validation, but the record it waits for was never created at the DNS host |
| `gitarchitecturediagram.com` | Resolves to `2.57.91.91` and refuses automated access | Registered, but **not** in the `proamine.tech` owner's Hostinger domain portfolio; ownership is unconfirmed |

To finish `diagram.proamine.tech`:

1. Open the Site's custom-domain panel and copy the exact record it asks for (type, name, target). Do not guess the target; it is specific to the hosting account.
2. In Hostinger, open **Domains → proamine.tech → DNS / Nameservers** and add that record for the name `diagram`. Leave the existing `proamine.tech` records unchanged.
3. Wait for the hosting panel to report the domain as verified and HTTPS as issued. Then check `https://diagram.proamine.tech/api/health` and a deep link such as `/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance`.
4. Set `PUBLIC_ORIGINS=https://git-architecture-diagram.pro-amine.chatgpt.site,https://diagram.proamine.tech` so API requests from both origins are accepted.

For `gitarchitecturediagram.com`, first confirm who owns it (WHOIS or the registrar's search). If it is not yours, choose another name; a GitHub repository name does not create or reserve a domain. Every `/owner/repo/...` path, including GitHub pull-request or issue paths, is served the workspace by both runtimes, so any domain you attach supports the hostname-replacement journey without extra rewrite rules.

## Node hosting

Use a host that supports Node 22.12+, outbound HTTPS to `api.github.com`, and streamed responses. Optional AI needs outbound HTTPS to the selected provider: `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, or `api.moonshot.ai`.

```bash
npm ci --omit=dev
HOST=0.0.0.0 PORT=3000 npm start
```

Configure the host's port and reverse proxy as required by your provider. Keep the application behind HTTPS. Set `PUBLIC_ORIGIN` to the **exact public origin**, such as `https://your-host.example`, without a trailing slash. Behind a TLS proxy, this setting is required so browser-origin validation matches the public URL.

Forward all routes to the Node service, including `/OWNER/REPO` and `/OWNER/REPO/tree/REF/PATH`. Preserve streamed NDJSON and allow requests to run for up to 180 seconds. A proxy that buffers output can delay the progress UI. A serverless function with a shorter timeout may terminate large analyses.

## Docker

```bash
docker build -t git-architecture-diagram .
docker run --rm -p 3000:3000 --env-file .env git-architecture-diagram
```

Remove `HOST=127.0.0.1` from a copied `.env` or change it to `HOST=0.0.0.0` when running in Docker. The Dockerfile sets the container default appropriately. Do not place real credentials in the image or build arguments.

## Optional credentials

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Optional server token for public-repository API allowance. It is not a way to expose private repositories to anonymous users. |
| `GENIUS_PROVIDER` | `openai` (default), `anthropic`, `gemini`, or `kimi`. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `MOONSHOT_API_KEY` | Optional server key for the configured provider. A different selected provider cannot reuse it. |
| `GENIUS_MODEL` | Explicit provider model ID; no default model or price is assumed. |
| `GENIUS_ACCESS_TOKEN` | Shared instance password. When set, every analysis/search request needs it. Required before web requests can use the server-side AI key. |
| `PUBLIC_ORIGIN` | Canonical externally visible origin used for browser request validation. |
| `HOST`, `PORT` | Listening interface and port; local defaults are `127.0.0.1:3000`. |

Users can instead provide their own GitHub/provider keys in Settings. Keys pass through your server, so offer this only from a deployment whose operator they trust. Private repositories always require a request-specific GitHub token. Never publish an unrestricted proxy to a paid model key.

## Domain replacement

Once your deployment is live, configure a domain you control using your hosting provider's DNS instructions. Domain availability and ownership must be checked separately. Then:

```text
https://github.com/ProAmineOfficial/NanoKit-ESP32
https://git-architecture-diagram.pro-amine.chatgpt.site/ProAmineOfficial/NanoKit-ESP32
```

The second link automatically starts analysis. Names containing dots and scoped tree/blob URLs are supported. A copied workspace link pins the commit through query parameters so another user can inspect the same revision using their own access.

## Operating limits

For the local Node deployment, caches and sessions live in process memory and are not synchronized across replicas. Use one instance initially, or sticky routing if you run more than one. Restarting the process clears all reports and invalidates evidence-search sessions. Add a durable job queue and an access-controlled shared store before scaling beyond this design.

The Node server's limiter uses the direct socket address and does not trust arbitrary forwarded IP headers. Behind a proxy, clients may share that address; configure gateway limits or a deliberate trusted-proxy implementation before serving a large public audience. The Worker uses the platform's `CF-Connecting-IP` header and bounds concurrent analysis per isolate; this is not a global distributed quota. Rotate provider credentials through the host's secret settings. Disable request-body logging in the reverse proxy.

Validate a deployment using `/api/health`, a small public repository, a scoped analysis, and the export controls. A successful source release does not by itself prove that a particular hosting configuration works.
