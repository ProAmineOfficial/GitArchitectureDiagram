// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-EVIDENCE-001
// Project: Git Architecture Diagram | Component: Genius evidence contract (shared by browser and server) | Author: Amine Saoud ibn al-Bashir.
// The single rule for turning a model's citation into evidence: a citation is "verified" only when its path exists in
// the analyzed commit, its line exists in the file that was read (SHA-verified during analysis), and its quote appears
// at that line. A model saying "observed" changes nothing. Invented paths, impossible lines, and citations of another
// commit are rejected; anything that cannot be checked stays visible as Genius inference.

const squash = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const DOC = /\.(md|mdx|rst|txt|adoc)$/i;

/** Index an analysis result as the immutable evidence store for one repository, commit, and scope. */
export function createEvidenceStore(result) {
  const repo = result.repository;
  const entries = repo.entries || [];
  return {
    repository: repo.fullName, commit: repo.sha, scope: repo.scope || '',
    paths: new Set(entries.filter(entry => entry.type === 'blob' || entry.type === 'commit').map(entry => entry.path)),
    folders: new Set(entries.filter(entry => entry.type === 'tree').map(entry => entry.path)),
    files: new Map((result.files || []).map(file => [file.path, String(file.content ?? '').split('\n')])),
    shas: new Map((result.files || []).map(file => [file.path, file.sha || ''])),
  };
}

/** True when a path names a file or folder in this commit. */
export function pathExists(store, path) { const clean = String(path ?? '').replace(/^\/+|\/+$/g, ''); return Boolean(clean) && (store.paths.has(clean) || store.folders.has(clean)); }

/**
 * Check one citation against the store.
 * @returns {{path: string, line: number|null, quote: string, commit: string, status: 'verified'|'unverified'|'rejected', basis: 'observed'|'documented'|'inferred', reason: string}}
 */
export function verifyCitation(store, citation = {}) {
  const path = String(citation.path ?? '').replace(/^\/+/, ''); const quote = String(citation.quote ?? '').slice(0, 240);
  const line = Number.isInteger(citation.line) ? citation.line : Number.isInteger(Number(citation.line)) && citation.line !== '' && citation.line !== null ? Number(citation.line) : null;
  const base = { path, line: line && line > 0 ? line : null, quote, commit: store.commit, repository: store.repository };
  if (citation.commit && String(citation.commit) !== store.commit) return { ...base, status: 'rejected', basis: 'inferred', reason: `Cites commit ${String(citation.commit).slice(0, 12)}, not the analyzed commit ${store.commit.slice(0, 12)}.` };
  if (citation.repository && String(citation.repository) !== store.repository) return { ...base, status: 'rejected', basis: 'inferred', reason: 'Cites another repository.' };
  if (!path || !store.paths.has(path)) return { ...base, status: 'rejected', basis: 'inferred', reason: store.folders.has(path) ? 'Cites a folder, not a file line.' : 'This path does not exist at the analyzed commit.' };
  const lines = store.files.get(path);
  if (!lines) return { ...base, status: 'unverified', basis: 'inferred', reason: 'The file exists but was not read in this analysis, so the line could not be checked.' };
  if (!base.line) return { ...base, status: 'unverified', basis: 'inferred', reason: 'No line number to check.' };
  if (base.line > lines.length) return { ...base, status: 'rejected', basis: 'inferred', reason: `Line ${base.line} is outside the file (${lines.length} lines).` };
  const wanted = squash(quote);
  if (wanted.length < 4) return { ...base, status: 'unverified', basis: 'inferred', reason: 'No verbatim quote to compare.' };
  const window = squash(lines.slice(Math.max(0, base.line - 2), base.line + 1).join(' '));
  if (!window.includes(wanted)) return { ...base, status: 'unverified', basis: 'inferred', reason: 'The quoted text does not appear at this line.' };
  return { ...base, status: 'verified', basis: DOC.test(path) ? 'documented' : 'observed', reason: '' };
}

/**
 * Verify every citation and path of a finding or solution. Invented paths are removed; an item whose paths are all
 * invented and that has no verified evidence is rejected.
 */
export function verifyItem(store, item, { requirePath = true } = {}) {
  const evidence = (Array.isArray(item.evidence) ? item.evidence : []).slice(0, 8).map(citation => verifyCitation(store, citation));
  const kept = evidence.filter(citation => citation.status !== 'rejected');
  const cited = (Array.isArray(item.files) ? item.files : []).map(path => String(path ?? '').replace(/^\/+|\/+$/g, '')).filter(Boolean);
  const files = [...new Set([...cited.filter(path => pathExists(store, path)), ...kept.map(citation => citation.path)])].slice(0, 12);
  const removed = { paths: cited.filter(path => !pathExists(store, path)), evidence: evidence.filter(citation => citation.status === 'rejected') };
  const verified = kept.filter(citation => citation.status === 'verified').length;
  const status = verified ? 'verified' : 'inferred';
  const rejected = requirePath && !files.length && (cited.length > 0 || evidence.length > 0); // Every reference was invented.
  return { ...item, files, evidence: kept, evidenceStatus: status, removed, rejected, rejectionReason: rejected ? 'Every cited path or line was invalid for the analyzed commit.' : '' };
}

/** Coverage counters for a set of verified items. */
export function evidenceCoverage(items, store) {
  const citations = items.flatMap(item => item.evidence || []);
  const removed = items.reduce((sum, item) => sum + (item.removed?.evidence?.length || 0), 0);
  const files = new Set(items.flatMap(item => item.files || []));
  return { citations: citations.length + removed, verified: citations.filter(c => c.status === 'verified').length, unverified: citations.filter(c => c.status === 'unverified').length, rejected: removed, filesCited: files.size, filesRead: store.files.size, filesListed: store.paths.size, commit: store.commit };
}
