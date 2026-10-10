// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-EVIDENCE-001
// Project: Git Architecture Diagram | Component: Portable evidence search | Author: Amine Saoud ibn al-Bashir.
export function searchEvidence(result, question) { // Search the already-read source in either the browser or Node without another provider request.
  const words = String(question).toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu)?.slice(0, 12) || []; const matches = []; // Extract a bounded Unicode query while preserving original source text.
  for (const file of result.files) { // Search only files actually fetched for the current analysis.
    file.content.split('\n').forEach((line, index) => { const haystack = `${file.path} ${line}`.toLowerCase(); const score = words.filter(word => haystack.includes(word)).length; if (score) matches.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 400), score, url: `${result.repository.htmlUrl}/blob/${result.repository.sha}/${file.path.split('/').map(encodeURIComponent).join('/')}#L${index + 1}` }); }); // Keep matches tied to their immutable source lines.
  } // End the sampled-source search.
  return matches.sort((a, b) => b.score - a.score).slice(0, 8); // Return evidence rather than a simulated AI answer.
} // End portable evidence search.
