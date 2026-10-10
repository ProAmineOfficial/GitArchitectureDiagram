# Project maintenance

- The canonical repository is `ProAmineOfficial/GitArchitectureDiagram`. Make project updates here. Do not create a replacement GitHub repository or a fork for routine work.
- Production is the Hostinger Node.js Web App at `https://gitarchitecturediagram.com`, deployed from `main` with entry file `server.mjs`. GitHub `main` is the single source of truth. Never patch files on the server.
- Keep the earlier hosted Site synchronized when it is published. Preserve the existing project ID in `.openai/hosting.json`; it is a hosting identity, not an OpenAI API integration or a credential. A deployment checkout is a build mirror, not a separate product source.
- Keep application text, project documentation, code comments, and generated explanations in English. Preserve source excerpts and filenames exactly as retrieved from analyzed repositories.
- Use English inline comments for executable code where the language allows them. Do not add comments to JSON or other formats that forbid comments. Never insert a `//` comment in the middle of a line that continues with code.
- Maintain distinct Mermaid role colors and a visible legend. Label filename-based roles as hints. Preserve styles in author-written repository diagrams.
- Keep extracted dependencies, authored diagrams, and AI interpretations visibly distinct. Do not claim full analysis, execution, model output, or a working provider connection without evidence.
- Never modify a repository being analyzed.

## Security policy (permanent)

Follow [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md) for every change. It is a non-negotiable rule set and is weakened only with the owner's explicit approval. In short:

- Never commit a secret, and never hide one in code, Base64, comments, bundles, or tests. Secrets live in Hostinger environment variables, a secret manager, GitHub Actions secrets, or an untracked local `.env`. Test fixtures use obvious placeholders.
- Every byte sent to the browser is public. User provider keys stay in tab memory for one request and are never persisted, logged, or exported.
- Before every push: review the diff and the staged files, then run `npm run scan:secrets`, `npm audit`, `npm run check`, `npm test`, `npm run test:browser`, and `npm run build`. Do not push when a critical check fails.
- Never delete or keep a legacy file because of its age. Trace it and classify it (KEEP, UPDATE, MIGRATE, DEPRECATE, REMOVE) with a reason. See [docs/LEGACY_AUDIT.md](docs/LEGACY_AUDIT.md).
- Provenance is public attribution (headers, `PROVENANCE.json`, `/api/version`), never tracking or telemetry. Keep the copyright header and provenance ID at the top of every core module. The project license is GNU AGPL-3.0-only; do not change it without the owner's approval.
- End every meaningful update with the SECURITY STATUS report from the policy.
