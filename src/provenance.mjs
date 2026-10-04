// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Provenance record and non-secret build fingerprint.
// This is attribution, not tracking: nothing here collects, stores, or sends anything about visitors. GET /api/version
// returns the public provenance record, the release version, the source commit when the host provides it, a SHA-256
// digest of the shipped source files, and a SHA-256 fingerprint over all of them. Anyone can recompute both with
// `npm run provenance` on a checkout of the same commit and compare.
import { VERSION } from './github.mjs';

/** The same record as PROVENANCE.json (tests keep the two identical). It holds no secrets. */
export const PROVENANCE = Object.freeze({
  provenanceVersion: 1,
  project: 'Git Architecture Diagram',
  creator: 'Amine Saoud ibn al-Bashir',
  organization: 'Pro_Amine LLC',
  copyright: '© 2026 Pro_Amine LLC · Created & Developed by Amine Saoud ibn al-Bashir',
  canonicalRepository: 'https://github.com/ProAmineOfficial/GitArchitectureDiagram',
  canonicalWebsite: 'https://gitarchitecturediagram.com',
  firstReleaseYear: 2026,
  license: 'MIT',
  identifiers: Object.freeze({
    'GAD-PROVENANCE-CORE-001': 'Runtime core: HTTP server, hosted Worker, CLI, GitHub ingestion, analysis service, extract, build and release scripts',
    'GAD-PROVIDER-LAYER-001': 'AI provider layer: adapters, error classification and retries, model registry, connection test, provider catalog',
    'GAD-GENIUS-PIPELINE-001': 'Genius pipeline: Deep Genius teams and orchestrator, agent contracts, server agent runner, grounded questions',
    'GAD-EVIDENCE-001': 'Evidence contract and repository intelligence: citation verification, evidence search, hierarchical summaries',
    'GAD-SYSTEM-MAP-001': 'System Map 2.0: AI system map, graph validation, structural overview, guided tour, software hierarchy',
    'GAD-EXPORT-PACK-001': 'Export Project 2.0: .gitarchitecture pack, prompts, skills, reconstruction packs, project extract, secret redaction',
    'GAD-WORKSPACE-UI-001': 'Workspace interface: browser application, routing, diagrams, highlights, styles',
    'GAD-BRAND-001': 'Official Pro_Amine brand integration: footer, social dock, product icon',
  }),
});

/** Files whose content defines a release; the digest covers exactly these, in sorted order. */
export const SOURCE_PATTERN = /^(server\.mjs|worker\.mjs|cli\.mjs|package\.json|PROVENANCE\.json|LICENSE|src\/[^/]+\.mjs|public\/[^/]+\.(?:js|html|css|svg))$/;

const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export async function sha256(data) { return hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data)); }

/** SHA-256 over "path\0sha256(content)\n" lines for every release file, sorted by path. */
export async function sourceDigest(files) {
  const lines = []; for (const [path, content] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) lines.push(`${path}\0${await sha256(content)}\n`);
  return sha256(lines.join(''));
}

/** The public /api/version body. `commit` and `digest` may be null when the host does not provide them. */
export async function versionInfo({ commit = null, digest = null, runtime = 'node' } = {}) {
  const fingerprint = await sha256(JSON.stringify({ project: PROVENANCE.project, version: VERSION, commit, sourceDigest: digest, provenance: PROVENANCE }));
  return { project: PROVENANCE.project, version: VERSION, commit, sourceDigest: digest ? `sha256:${digest}` : null, fingerprint: `sha256:${fingerprint}`, provenanceId: 'GAD-PROVENANCE-CORE-001', provenanceVersion: PROVENANCE.provenanceVersion, organization: PROVENANCE.organization, creator: PROVENANCE.creator, repository: PROVENANCE.canonicalRepository, website: PROVENANCE.canonicalWebsite, license: PROVENANCE.license, runtime };
}

/** A commit identifier only when it is a plain hex SHA; anything else is ignored. */
export function cleanCommit(value) { const text = String(value || '').trim().toLowerCase(); return /^[0-9a-f]{7,40}$/.test(text) ? text : null; }
