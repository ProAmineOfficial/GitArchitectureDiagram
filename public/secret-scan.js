// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-EXPORT-PACK-001
// Project: Git Architecture Diagram | Component: Secret detection for exports and repository scans (browser and Node).
// High-confidence credential shapes only, so ordinary code is not mangled. Exports replace every match with a visible
// [REDACTED:type] marker; the repository scanner reports file, line, and type, never the value itself.

export const SECRET_PATTERNS = [ // [type, pattern]; patterns are global so every occurrence is found.
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?:\s|\\n)*[A-Za-z0-9+/=\r\n]{64,}(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----)?/g], // Key material, not a bare header.
  ['anthropic-key', /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{20,}/g],
  ['provider-api-key', /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['slack-token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/g],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/-]{32,}=*/g],
  ['assigned-secret', /\b(?:api[_-]?key|apikey|secret|password|passwd|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{24,}["']/gi],
];

/** Values that are obviously synthetic fixtures (tests, docs, examples); the repository scanner ignores them. */
export const SYNTHETIC = /placeholder|example|sample|dummy|fake|mock|test|fixture|redacted|x{6,}|0{6,}|\.\.\.|…/i;

/** Find credential-shaped values. Returns [{ type, index, line, length }] — never the matched value. */
export function findSecrets(text, { ignoreSynthetic = false } = {}) {
  const source = String(text ?? ''); const found = [];
  for (const [type, pattern] of SECRET_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (ignoreSynthetic && SYNTHETIC.test(match[0])) continue;
      if (found.some(item => match.index >= item.index && match.index < item.index + item.length)) continue; // One report per span.
      found.push({ type, index: match.index, length: match[0].length, line: source.slice(0, match.index).split('\n').length });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Replace every credential-shaped value with [REDACTED:type]. Returns the safe text and what was removed (types only). */
export function redactSecrets(text) {
  const source = String(text ?? ''); const found = findSecrets(source); if (!found.length) return { text: source, count: 0, types: [] };
  let output = ''; let cursor = 0;
  for (const item of found) { output += source.slice(cursor, item.index) + `[REDACTED:${item.type}]`; cursor = item.index + item.length; }
  return { text: output + source.slice(cursor), count: found.length, types: [...new Set(found.map(item => item.type))] };
}

/** Redact every text file of an export bundle ({ path: text }). Binary entries pass through unchanged. */
export function redactFiles(files) {
  let count = 0; const types = new Set(); const safe = {};
  for (const [path, content] of Object.entries(files || {})) {
    if (typeof content !== 'string') { safe[path] = content; continue; }
    const result = redactSecrets(content); safe[path] = result.text; count += result.count; result.types.forEach(type => types.add(type));
  }
  return { files: safe, count, types: [...types] };
}
