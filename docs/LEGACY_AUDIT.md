# Legacy file verification

Audit date: **October 4, 2026**, at commit `683094b` (main) before release 1.1.0. Method: for each file, its purpose, every reference in the repository (`git grep`), use by the runtime, CI, Hostinger, the docs, and the tests, and the production impact of removing it. Nothing was deleted. See [SECURITY_POLICY.md](SECURITY_POLICY.md) §7.

| Path | Purpose (verified) | Used by | Decision | Reason |
| --- | --- | --- | --- | --- |
| `.github/workflows/ci.yml` | GitHub Actions: `npm ci`, check, unit tests, build on Node 22 and 24 | CI only; never deployed | **UPDATE** | Already `permissions: contents: read`. Added `persist-credentials: false`, the secret scan, `npm audit --omit=dev --audit-level=high`, and a browser-test job. No secrets are used. |
| `.openai/hosting.json` | The project ID of the earlier hosted Site (`git-architecture-diagram.pro-amine.chatgpt.site`), which `npm run build` targets with the Worker | `AGENTS.md`, `docs/DEPLOYMENT.md`; no code reads it | **KEEP** | A hosting identity, not an OpenAI API integration and not a credential (no key or token in it). Removing it could break publishing to the secondary hosted Site. Production on Hostinger does not use it. |
| `docs/` | Architecture, AI providers, deployment, privacy, brand, validation history, images | README links, contributors | **UPDATE** | DEPLOYMENT, AI_PROVIDERS, ARCHITECTURE, PRIVACY, and BRAND described the removed instance password, the GitHub token field, and the old copyright line. `VALIDATION.md` is a dated historical log and stays as written. Added SECURITY_POLICY.md and this audit. |
| `scripts/build.mjs` | Builds the browser bundle and the Cloudflare-compatible Worker into `dist/` | `npm run build`, CI, `tests/runtime.test.mjs` | **UPDATE** | Still needed for the Worker. Now injects the commit and source digest for the Worker's `/api/version`. Hostinger does not need it. |
| `scripts/check.mjs` | Syntax check of every shipped module | `npm run check`, CI | **UPDATE** | Now also checks the two new scripts. |
| `scripts/fetch-brand-assets.mjs` | Downloads the five official images from proamine.tech when missing | `docs/BRAND.md`, `tests/brand.test.mjs` (offline, with a fake fetch) | **KEEP** | The images are now committed, but the script restores missing ones and verifies PNG/WebP signatures. It never runs at deploy time. |
| `Dockerfile` | Container image: Node 22, `npm ci --omit=dev`, non-root user, `node server.mjs` | `docs/DEPLOYMENT.md` | **KEEP** | Valid alternative deployment. It copies only what `.dockerignore` allows and bakes in no credentials. Hostinger does not use it. |
| `.dockerignore` | Keeps local files out of the image | Docker builds | **UPDATE** | Added `.github`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, SSH keys, `credentials.json`, `secrets.json`. |
| `.gitignore` | Keeps secrets and build output out of Git | Git | **UPDATE** | Added the full secret-bearing pattern list (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `credentials.json`, `secrets.json`). |
| `.env.example` | Public template of environment variables | Local setup, docs | **UPDATE** | Removed `GENIUS_ACCESS_TOKEN` (retired). Every secret is an empty placeholder (enforced by a test). |
| `AGENTS.md` | Instructions for AI coding agents working on the repository | Agents | **UPDATE** | Now points to the permanent security policy and names Hostinger as production. |
| `SECURITY.md` | Vulnerability reporting | GitHub security tab | **UPDATE** | Rewritten around the current boundaries and the policy. It no longer mentions an instance password. |
| `CONTRIBUTING.md` | Contribution steps | Contributors | **UPDATE** | Added the pre-push checklist. |
| `cli.mjs` | Local command-line analysis (`npm run analyze`) | `package.json`, `scripts/check.mjs` | **KEEP** | The only way to analyze private repositories now (with your own local `GITHUB_TOKEN`). It runs locally and never on Hostinger. |
| `server.mjs` | Production Node server (Hostinger entry file) | Hostinger, `npm start`, Docker, tests | **UPDATE** | Removed instance-password gating and browser GitHub tokens. Added `/api/version` and safe connection diagnostics. The runner-safe autostart (the 503 fix) is unchanged and covered by `tests/hosting.test.mjs`. |
| `worker.mjs` | Cloudflare-compatible Worker for the earlier hosted Site | `scripts/build.mjs`, Worker tests | **UPDATE** | The same credential changes as `server.mjs`, so neither runtime silently keeps old behavior. Also gained `/api/version`. |

## Findings that changed production behavior

- **`GENIUS_ACCESS_TOKEN`:** while it was set, every API request without the matching `X-Instance-Token` header returned 401, and it controlled whether the server lent its own AI key. It is removed from both runtimes. A leftover value is ignored and logged by name only. Remove it from hPanel.
- **Browser GitHub token:** it only affected GitHub requests (analysis, extract, citation checks). It was never sent to an AI provider. The field is removed, and both runtimes now ignore a `githubToken` in requests.

## Secret scan

On October 4, 2026, the tracked tree and the full Git history (all 17 commits of `main` and the `v0.9.0` tag) were scanned for provider keys, GitHub tokens, Google and AWS keys, bearer tokens, assigned secrets, and private keys. Result: **no real credential**. The only matches were obvious test placeholders (for example `sk-test-placeholder-…`). No secret-bearing file (`.env`, `*.pem`, `*.key`, …) was ever committed; `.env.example` is the only `.env*` file ever tracked.
