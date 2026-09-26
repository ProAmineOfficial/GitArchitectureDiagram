# Project maintenance

- The canonical repository is `ProAmineOfficial/GitArchitectureDiagram`. Make project updates here. Do not create a replacement GitHub repository or a fork for routine work.
- Keep the published website synchronized with this repository. Preserve the existing project ID in `.openai/hosting.json`; a deployment checkout is a build mirror, not a separate product source.
- Keep application text, project documentation, code comments, and generated explanations in English. Preserve source excerpts and filenames exactly as retrieved from analyzed repositories.
- Use English inline comments for executable code where the language allows them. Do not add comments to JSON or other formats that forbid comments.
- Maintain distinct Mermaid role colors and a visible legend. Label filename-based roles as hints. Preserve styles in author-written repository diagrams.
- Keep extracted dependencies, authored diagrams, and AI interpretations visibly distinct. Do not claim full analysis, execution, or model output without evidence.
- Never modify a repository being analyzed. Keep credentials out of Git, browser storage, exports, and logs.
- Check relevant tests and the production build after changing hosting or analysis behavior. Publish changes to the existing website after updating the canonical source when deployment is requested.
