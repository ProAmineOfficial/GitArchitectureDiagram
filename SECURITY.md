# Security

Do not publish access tokens, private source, or exploitable deployment details in a public issue. If GitHub's private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**. Otherwise contact the maintainer through an available private channel and ask for a reporting method before sharing details.

The analyzer processes untrusted repository text. Important boundaries include fixed GitHub/OpenAI outbound hosts, redirect refusal for authenticated requests, credential isolation, file/byte budgets, sanitized rendering, same-origin JSON requests, and explicit authorization before using a server-side paid model key.

This is a first release, not a security audit of analyzed repositories or a fully hardened multi-tenant service. Read [deployment](docs/DEPLOYMENT.md) and [data handling](docs/PRIVACY.md) before public hosting. Keep dependencies updated and configure HTTPS, secret management, reverse-proxy limits, and request logging appropriately.
