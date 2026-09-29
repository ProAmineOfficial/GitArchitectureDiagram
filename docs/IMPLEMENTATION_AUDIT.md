# Implementation audit — September 29, 2026

The canonical baseline was `ddb9d8e27616504b0b103e179b9c1b1df1da4b2b` in [ProAmineOfficial/GitArchitectureDiagram](https://github.com/ProAmineOfficial/GitArchitectureDiagram). [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) was inspected as a read-only product and architecture reference. No replacement repository, framework migration, or copied reference implementation was introduced.

The implementation prompt supplied the requirements. Available reference material guided the interaction goals; missing local screenshot paths were not treated as images successfully viewed. The existing repository and deployed project identity remained authoritative.

| Area | Existing project | Reference / requested experience | v0.4.0 changes |
| --- | --- | --- | --- |
| Repository links | Root and tree/blob routing existed; history, branch refresh, and line-range handling were partial | Change only the hostname and understand the selected repository | Shared route-state module, slash refs, source-range restoration, branch-aware refresh, Back/Forward handling, stale-request isolation |
| Architecture | Bounded lexical references and authored Markdown Mermaid | Prominent grouped diagram with meaningful sources | Component inventory overview, source-reference view, standalone Mermaid discovery, safe grouped AI graph compilation |
| Browsing | Classic tree and sampled source inspector | Connected tree, diagram, Genius, and scope navigation | Filters, breadcrumbs, collapsible panels, verified on-demand source reads, synchronized selections |
| Genius | Deterministic report, keyword search, optional interpretation | Evidence-based questions and useful orientation | Suggested reading order, explicit paid Q&A with exact quoted citations, bounded provider context, no automatic spending |
| Examples | Searchable measured historical snapshots | Browse real examples with preview/filter controls | Category filters, real stored inventory previews, fresh NanoKit and Express checks |
| Reliability | Native-fetch/redirect and streamed-response fixes already present | Clear recoverable errors and source/privacy boundaries | HTML/JSON safeguards for upstream reads, cancellation guards, versioned anonymous-public cache, credential-specific cache exclusion |
| Domain | Working generated-domain deployment; pending subdomain | Standalone gitarchitecturediagram.com hostname replacement | Existing Site now has the apex hostname attached and allowed; DNS/SSL validation remains externally blocked |

GitDiagram's structured graph approach informed the design direction. This project keeps its independent deterministic mode: tree, source browsing, inventory, lexical references, and authored Mermaid work without a model. Optional Genius adds interpretations and questions. Observed references, authored intent, filename-based role hints, and model inference remain explicitly separate; none is presented as proof of runtime execution or hardware wiring.

See [release validation](VALIDATION.md), [provider behavior and limits](AI_PROVIDERS.md), and [domain activation](DOMAIN_SETUP.md). Browser visual validation and live paid/private-provider checks remain outstanding. Video tours are explicitly deferred.
