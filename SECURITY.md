# Security

## Reporting a vulnerability

Do not publish access tokens, private source, or exploitable deployment details in a public issue. If GitHub's private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**. Otherwise contact Pro_Amine LLC through an available private channel and ask for a reporting method before sharing details.

## Boundaries

The analyzer processes untrusted repository text. Its main boundaries are:

- fixed official outbound hosts (GitHub and the five AI providers), with redirects refused for authenticated requests;
- no server-side credential in browser code. A visitor's AI provider key lives only in that tab's memory and travels only with the AI request they start. It is never stored in browser storage, cookies, URLs, logs, caches, or exports;
- no instance password and no browser GitHub token. Web requests never borrow the operator's provider key, except for opted-in public system maps;
- file and byte budgets, sanitized rendering, a strict Content Security Policy, and same-origin JSON requests with rate limits;
- secret redaction in every export, and a secret scan of the tree and history before pushes (`npm run scan:secrets`);
- public provenance only (`/api/version`, [PROVENANCE.md](PROVENANCE.md)), with no tracking or telemetry.

The full permanent rule set is in [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md). Read [deployment](docs/DEPLOYMENT.md) and [data handling](docs/PRIVACY.md) before public hosting. This project is not a security audit of analyzed repositories, and not a hardened multi-tenant service. Keep dependencies updated, and configure HTTPS, secret management, reverse-proxy limits, and request logging appropriately.
