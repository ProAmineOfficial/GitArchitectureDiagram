# Provenance

Git Architecture Diagram is open source under the MIT License. Anyone may copy and build on it. This document explains how to tell the **official** project and its builds apart from copies. It relies only on public, verifiable facts.

> This is not a tracking system. Nothing in the application collects, stores, or sends information about visitors, phones home, or embeds hidden beacons or telemetry. Provenance is a set of public records that anyone can check.

## The record

[`PROVENANCE.json`](PROVENANCE.json) is the public provenance record. It holds the project name, the creator (Amine Saoud ibn al-Bashir), the organization (Pro_Amine LLC), the canonical repository and website, the first release year (2026), the license (MIT), and the stable identifiers below. It contains no secrets, and `src/provenance.mjs` must stay identical to it (a test enforces this).

## Stable provenance identifiers

Each core module starts with this header:

```text
// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-…-001
```

| Identifier | Covers |
| --- | --- |
| `GAD-PROVENANCE-CORE-001` | Runtime core: `server.mjs`, `worker.mjs`, `cli.mjs`, GitHub ingestion, analysis service, extract, provenance, build and release scripts |
| `GAD-PROVIDER-LAYER-001` | AI provider layer: adapters, error classification and retries, model registry, Test connection, provider catalog |
| `GAD-GENIUS-PIPELINE-001` | Genius pipeline: Deep Genius teams and orchestrator, agent contracts, server agent runner, grounded questions |
| `GAD-EVIDENCE-001` | Evidence contract and repository intelligence: citation verification, evidence search, hierarchical summaries |
| `GAD-SYSTEM-MAP-001` | System Map 2.0: AI system map, graph validation, structural overview, guided tour, software hierarchy |
| `GAD-EXPORT-PACK-001` | Export Project 2.0: `.gitarchitecture` pack, prompts, skills, reconstruction packs, project extract, secret redaction |
| `GAD-WORKSPACE-UI-001` | Workspace interface: browser application, routing, diagrams, highlights, styles |
| `GAD-BRAND-001` | Official Pro_Amine brand integration: footer, social dock, product icon |

The identifiers never change once published. New areas get new identifiers (`…-002`, or a new name). `tests/provenance.test.mjs` checks that every core module has the header and a documented identifier.

## Build fingerprint: `GET /api/version`

Every deployment answers `GET /api/version` with public data only:

```json
{
  "project": "Git Architecture Diagram",
  "version": "1.1.0",
  "commit": "…40-character commit, when the host provides it…",
  "sourceDigest": "sha256:…",
  "fingerprint": "sha256:…",
  "provenanceId": "GAD-PROVENANCE-CORE-001",
  "organization": "Pro_Amine LLC",
  "creator": "Amine Saoud ibn al-Bashir",
  "repository": "https://github.com/ProAmineOfficial/GitArchitectureDiagram",
  "website": "https://gitarchitecturediagram.com",
  "license": "MIT",
  "runtime": "node"
}
```

- `sourceDigest` is SHA-256 over `path\0sha256(content)\n` lines for the shipped release files (`server.mjs`, `worker.mjs`, `cli.mjs`, `package.json`, `PROVENANCE.json`, `LICENSE`, `src/*.mjs`, and `public/*.js|html|css|svg`), sorted by path.
- `fingerprint` is SHA-256 over the project, version, commit, source digest, and the provenance record.
- `commit` comes from `GAD_COMMIT`, `SOURCE_COMMIT`, or `GIT_COMMIT` when set, otherwise from `.git` if the host keeps it, otherwise `null`. It is accepted only as a hexadecimal SHA.

To verify a deployment, check out the commit and run:

```bash
npm run provenance
```

The printed `sourceDigest` must equal the deployment's value. If it differs, the deployment is not running that commit's code.

## Releases

- Run `npm run provenance -- --checksums` on the release commit. It writes `dist/release/git-architecture-diagram-<version>-<commit>.tar.gz` (a `git archive` of the commit) and `dist/release/SHA256SUMS`. Attach both to the GitHub release.
- Sign release tags where practical: `git tag -s v1.1.0 -m "Git Architecture Diagram 1.1.0"`, then `git push origin v1.1.0`. Signed commits (GPG or SSH signing in GitHub) are encouraged.

## Originality questions

If a copy is suspected, compare stable identifiers, headers, the provenance record, Git history, release checksums, and `/api/version` fingerprints. Similar features or a single similar passage are not proof of copying on their own. Report findings as evidence, not conclusions.
