# Security, legacy verification, and provenance policy

This policy is **permanent** for all work on this repository, by people and by AI coding agents. It is a non-negotiable rule set. It is weakened only with the explicit approval of the project owner (Amine Saoud ibn al-Bashir, Pro_Amine LLC). Security comes first: when uncertain, investigate first and change second.

## 1. Secrets

A secret is never stored in source code. A secret is never "hidden" inside JavaScript, HTML, JSON, Base64, minified files, comments, frontend bundles, or obfuscated code. If something is secret, it is not committed to GitHub.

Secrets live only in:

- Hostinger environment variables (hPanel → Node.js → Environment variables);
- a deployment secret manager;
- GitHub Actions secrets, only when CI needs them;
- local untracked `.env` files;
- secure operating-system credential storage.

Never commit:

- AI provider keys (OpenAI, Anthropic, Gemini, Kimi/Moonshot, DeepSeek, any future provider);
- GitHub personal access tokens, GitHub App private keys, OAuth secrets, deploy keys, Actions secrets;
- Hostinger passwords, API tokens, VPS credentials, deployment tokens;
- DNS, registrar, or Cloudflare tokens;
- SSH, TLS, or signing private keys; JWT secrets; encryption keys;
- database passwords or URLs that contain passwords;
- session, cookie, or webhook secrets; SMTP passwords; OAuth client secrets;
- private service tokens; admin passwords.

`.env.example` contains only empty placeholders and non-secret settings (`OPENAI_API_KEY=`, `DEEPSEEK_API_KEY=`, `PUBLIC_ORIGIN=…`). A real value such as `OPENAI_API_KEY=sk-…` is forbidden there.

`.gitignore` stays strict: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `credentials.json`, `secrets.json`, with `!.env.example` allowed.

## 2. The browser is public

Every byte delivered to the browser is public. Server-side credentials are never embedded in frontend code. A key that a visitor enters exists only in that tab's memory for the specific request: browser → same-origin server → selected provider, then it is discarded. User keys are never persisted in `localStorage`, `sessionStorage`, IndexedDB, cookies, URLs, logs, exported files, or project bundles. The key field must not be fillable or savable by browser password managers.

## 3. Before every push

1. Inspect `git diff` and the staged file list.
2. Run `npm run scan:secrets` (and `npm run scan:secrets -- --history` before a release). It checks the patterns `sk-`, `sk-ant-`, `github_pat_`, `ghp_`, `AIza`, `AKIA`, `Bearer`, assigned `api_key` / `secret` / `password` / `token` values, and private-key blocks. It prints file, line, and type, never a value.
3. Confirm `.env` is not tracked.
4. Run `npm audit` (`--omit=dev` must report no high or critical issue).
5. Run `npm run check`, `npm test`, `npm run test:browser`, and `npm run build`.
6. Confirm Hostinger compatibility (`tests/hosting.test.mjs` simulates its runner) and that no secret reaches the frontend or an export.

Do not push when a critical check fails.

If a real secret is found: stop and do not push. Identify the provider, revoke or rotate the credential, remove it from the tree (and from history when necessary), verify that the old credential no longer works, and record only the type of secret, never its value.

## 4. Logging and errors

Never log API keys, Authorization headers, cookies, session tokens, passwords, private keys, GitHub tokens, or DNS credentials. Safe to log: provider, model, `apiKeyPresent`, key length, endpoint host, HTTP status, request ID, duration, classification. Errors shown to people never reveal secrets, stack traces, filesystem paths, or environment values.

## 5. Exports

Every export (the `.gitarchitecture` pack, prompts, skills, reconstruction and developer packs, Mermaid, Genius reports, AI-ready context, README snippets, project extracts) passes through `public/secret-scan.js`. Credential-shaped values become a visible `[REDACTED:type]` marker.

## 6. Dependencies and CI

Run `npm audit` before every release. Prefer fewer, maintained, pinned dependencies. Do not add a package for something trivial or purely cosmetic. CI uses minimum permissions (`permissions: contents: read`, `persist-credentials: false`), never passes secrets to untrusted pull-request code, and never echoes secrets.

## 7. Legacy files

A legacy file is never deleted, or kept, because of its age alone. First identify its purpose, its references, whether runtime, CI, Hostinger, the docs, or the tests use it, and what removing it would affect in production. Then classify it as **KEEP**, **UPDATE**, **MIGRATE**, **DEPRECATE**, or **REMOVE**, with the reason. Do not assume a name explains a file (for example, `.openai/` is not an OpenAI API integration). Never delete first and investigate later. Old code must not silently control production. Trace the path (browser → route → handler → service → provider adapter → provider) before blaming a file. The current classification is in [LEGACY_AUDIT.md](LEGACY_AUDIT.md).

## 8. Open source

The code is public. Security never depends on hiding code. Production depends on secrets kept out of Git, server-side validation, least privilege, safe logging, and verified dependencies.

## 9. Provenance, not surveillance

Provenance is public and verifiable ([PROVENANCE.md](../PROVENANCE.md)): copyright headers, `PROVENANCE.json`, `NOTICE.md`, stable identifiers, the `/api/version` fingerprint, signed tags, and release SHA-256 checksums where practical. Never track users, phone home, collect personal information, or add telemetry or hidden beacons. Never build a deceptive "invisible tracking system". Do not change the license without the owner's explicit approval.

## 10. After every deployment

Verify `/api/health`, `/api/version`, `/`, `/owner/repository`, `/tree/…`, `/blob/…`, API settings and Test connection with a real provider key, Genius, System Map, Export Project, the footer, mobile, and dark and light themes. A deployment is not successful just because Hostinger says "Deployment completed".

## 11. Security status report

Every meaningful update ends with:

```text
SECURITY STATUS
Secrets exposed: YES / NO
Credentials committed: YES / NO / NOT FULLY VERIFIED
Legacy files affected: list
New dependencies: list
Environment variables changed: list
Frontend credential exposure: YES / NO
Production verification: PASS / FAIL / NOT TESTED
Risk level: CRITICAL / HIGH / MEDIUM / LOW / CLEAN
```

## Never

Never commit a real API key. Never paste a password into code. Never commit Hostinger or DNS credentials, GitHub tokens, or private keys. Never store API keys in `localStorage`. Never expose secrets in browser JavaScript or print them in logs. Never upload `.env`. Never hide secrets with Base64. Never add covert tracking. Never remove legacy files without verifying their dependencies. Never change the production architecture without tests. Never push when tests fail.

Before each change, ask: Could this expose a secret? Could it put a secret in the browser, a log, or an export? Does it touch a legacy file I have not traced? Does it add a dependency? Does it change an environment variable? Does it change production behavior without a test? Does it weaken this policy? Is the claim I am about to make verified?
