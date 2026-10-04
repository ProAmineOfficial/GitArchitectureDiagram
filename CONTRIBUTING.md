# Contributing

Thank you for helping make repository architecture easier to understand.

1. Fork this repository and create a focused branch.
2. Use Node.js 22.12+ and run `npm ci`.
3. Run `npm run check` and `npm test` after changing the analysis or server behavior, and `npm run test:browser` after interface changes.
4. Verify UI changes in both a narrow mobile viewport and a desktop viewport, in dark and light themes.
5. Explain the problem, resulting behavior, and relevant validation in your pull request.

## Before you push

- Review `git diff` and the staged file list.
- Run `npm run scan:secrets`. It must print "clean". Never commit `.env`, keys, tokens, or private keys, and never hide a secret in code, comments, Base64, or a test fixture. Fixtures use obvious placeholders such as `sk-test-placeholder-…`.
- Run `npm audit --omit=dev` (no high or critical issue), `npm run check`, `npm test`, `npm run test:browser`, and `npm run build`.
- Keep the copyright header and provenance ID at the top of every core module (see [PROVENANCE.md](PROVENANCE.md)).

The full rule set is in [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md).

## Conventions

Keep the interface, source comments, generated explanations, and project documentation in English. Preserve original source excerpts and filenames. Preserve source provenance and disclose partial results. Avoid fabricated relationships, hidden model calls, or claims that filename heuristics prove program behavior. Fixtures must be small, deterministic, and contain no real credentials or private code.

Useful future contributions include AST-based language adapters, better multi-language module resolution, commit-to-commit architecture comparisons, and accessible graph navigation. These are future work, not promises about the current version.

Do not run code from arbitrary analyzed repositories. Do not introduce analytics, telemetry, or tracking, or transmit source to another service without a clearly disclosed opt-in. Discuss large dependency or architecture changes before implementing them.
