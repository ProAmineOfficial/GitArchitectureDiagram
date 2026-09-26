# Contributing

Thank you for helping make repository architecture easier to understand.

1. Fork this repository and create a focused branch.
2. Use Node.js 22.12+ and run `npm ci`.
3. Run `npm run check` and `npm test` after changing the analysis or server behavior.
4. Verify UI changes in both a narrow mobile viewport and a desktop viewport.
5. Explain the problem, resulting behavior, and relevant validation in your pull request.

Keep source comments and developer documentation in English; the Arabic README supports Arabic-speaking users. Preserve source provenance and disclose partial results. Avoid fabricated relationships, hidden model calls, or claims that filename heuristics prove program behavior. Fixtures must be small, deterministic, and contain no real credentials or private code.

Useful future contributions include AST-based language adapters, better multi-language module resolution, commit-to-commit architecture comparisons, access-controlled deployment support, and accessible graph navigation. These are future work, not promises about the current version.

Do not run code from arbitrary analyzed repositories. Do not introduce analytics or transmit source to another service without a clearly disclosed opt-in. Discuss large dependency or architecture changes before implementing them.
