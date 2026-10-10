// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI: the public project format.
// The gad.project/1 format shared by the browser, the public server, and the Genius Engineering Engine, plus the
// public helpers that read it: a format check, labels for verification statuses, Markdown views, a dependency diagram,
// and the Development Pack layout. Engineering generation and the validation engine are not part of this module.

export const PROJECT_SCHEMA = 'gad.project/1';
export const VALIDATION_SCHEMA = 'gad.validation/1';

/** Verification status of each artifact, from "generated" to "externally tool-verified". "edited" is set in the browser. */
export const ARTIFACT_STATUS = {
  generated: { label: 'Generated — not independently verified', tone: 'muted' },
  structurally_checked: { label: 'Structurally checked', tone: 'info' },
  syntax_checked: { label: 'Syntax checked', tone: 'info' },
  build_verified: { label: 'Build verified', tone: 'good' },
  simulation_tested: { label: 'Simulation tested', tone: 'good' },
  tool_verified: { label: 'Externally tool-verified', tone: 'good' },
  requires_physical_testing: { label: 'Requires physical or laboratory testing', tone: 'warn' },
  failed: { label: 'Failed validation', tone: 'bad' },
  edited: { label: 'Edited — not re-validated', tone: 'warn' },
};

/** What a file is. */
export const ARTIFACT_CLASS = {
  'native-source': 'Native source for a real tool',
  interoperable: 'Interoperable format',
  template: 'Template to complete',
  specification: 'Specification for a design tool',
  conceptual: 'Conceptual',
};

/** Where a requirement came from. */
export const SOURCE_LABEL = { user: 'Stated by you', 'user-confirmed': 'Confirmed by you', assumed: 'Assumption', 'ai-proposed': 'Proposed by Genius AI', validated: 'Validated' };

/** Check results in a validation report. */
export const CHECK_STATUS = { pass: 'Pass', warn: 'Warning', fail: 'Fail', not_run: 'Not run' };

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Check that a value has the gad.project/1 shape this workspace can display. It is a format check only; engineering
 * validation is the engine's validation report. Returns a list of problems (empty when the shape is usable).
 */
export function checkProjectShape(project) {
  const problems = [];
  if (!isObject(project)) return ['The file is not a project object.'];
  if (project.schema !== PROJECT_SCHEMA) problems.push(`Unknown format "${String(project.schema).slice(0, 40)}"; expected ${PROJECT_SCHEMA}.`);
  if (typeof project.title !== 'string' || !project.title.trim()) problems.push('The project has no title.');
  for (const key of ['requirements', 'components', 'artifacts']) if (!Array.isArray(project[key])) problems.push(`"${key}" must be a list.`);
  const ids = new Set(); const duplicates = new Set();
  for (const key of ['requirements', 'components', 'interfaces', 'artifacts', 'diagrams', 'validationPlan']) for (const item of Array.isArray(project[key]) ? project[key] : []) { if (!isObject(item) || !item.id) continue; if (ids.has(item.id)) duplicates.add(item.id); ids.add(item.id); }
  if (duplicates.size) problems.push(`Duplicated IDs: ${[...duplicates].slice(0, 10).join(', ')}.`);
  for (const artifact of Array.isArray(project.artifacts) ? project.artifacts : []) {
    if (!isObject(artifact) || typeof artifact.path !== 'string' || typeof artifact.content !== 'string') { problems.push('Every file needs a path and text content.'); break; }
    if (artifact.path.startsWith('/') || artifact.path.includes('\\') || artifact.path.split('/').some(part => part === '..' || part === '.' || !part)) problems.push(`Unsafe file path: ${artifact.path.slice(0, 80)}`);
  }
  if (project.validation && project.validation.schema !== VALIDATION_SCHEMA) problems.push('The attached validation report has an unknown format.');
  return problems;
}

/** Mermaid flowchart of components and interfaces, generated from the project data (not by AI). */
export function dependencyMermaid(project) {
  const node = id => `n_${String(id).replace(/[^A-Za-z0-9_]/g, '_')}`;
  const label = text => String(text).replace(/["\\]/g, "'").replace(/[\r\n]+/g, ' ').slice(0, 60);
  const lines = ['flowchart LR'];
  for (const component of project.components || []) lines.push(`  ${node(component.id)}["${label(component.name)}"]`);
  const known = new Set((project.components || []).map(item => item.id));
  for (const link of project.interfaces || []) if (known.has(link.from) && known.has(link.to)) lines.push(`  ${node(link.from)} -->|"${label(link.kind || 'link')}"| ${node(link.to)}`);
  for (const component of project.components || []) for (const dependency of component.dependsOn || []) if (known.has(dependency) && !(project.interfaces || []).some(link => link.from === dependency && link.to === component.id)) lines.push(`  ${node(dependency)} -.-> ${node(component.id)}`);
  return lines.join('\n');
}

const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map(row => `| ${row.map(cell).join(' | ')} |`)].join('\n');

/** Markdown overview of the project. */
export function projectMarkdown(project) {
  const lines = [`# ${project.title}`, '', project.summary || '', ''];
  if (project.provenance?.example) lines.push('> Example project prepared by Pro_Amine LLC to show the workspace. It was not generated from your text.', '');
  lines.push(`Domains: ${(project.domains || []).join(', ') || '—'}  `, `Targets: ${(project.targets || []).map(item => item.name || item.id).join(', ') || '—'}  `, `Format: ${PROJECT_SCHEMA}`, '');
  lines.push('## Requirements', '', table(['ID', 'Requirement', 'Kind', 'Priority', 'Source'], (project.requirements || []).map(item => [item.id, item.text, item.kind, item.priority, SOURCE_LABEL[item.source] || item.source])), '');
  if ((project.assumptions || []).length) lines.push('## Assumptions', '', ...project.assumptions.map(item => `- ${item.id}: ${item.text}`), '');
  lines.push('## Components', '', table(['ID', 'Name', 'Kind', 'Part number', 'Satisfies'], (project.components || []).map(item => [item.id, item.name, item.kind, item.partNumber || '', (item.satisfies || []).join(', ')])), '');
  if ((project.interfaces || []).length) lines.push('## Interfaces', '', table(['ID', 'From', 'To', 'Kind', 'Signals', 'Voltage'], project.interfaces.map(item => [item.id, item.from, item.to, item.kind, (item.signals || []).join(', '), item.voltage ? `${item.voltage} V` : ''])), '');
  if ((project.pinMap || []).length) lines.push('## Pin map', '', table(['GPIO', 'Signal', 'Component', 'Direction'], project.pinMap.map(item => [item.gpio, item.signal, item.component, item.direction])), '');
  if ((project.risks || []).length) lines.push('## Risks', '', table(['ID', 'Risk', 'Severity', 'Mitigation'], project.risks.map(item => [item.id, item.text, item.severity, item.mitigation])), '');
  if ((project.milestones || []).length) lines.push('## Milestones', '', ...project.milestones.map(item => `- ${item.id}: ${item.title}${(item.deliverables || []).length ? ` (${item.deliverables.join(', ')})` : ''}`), '');
  return lines.join('\n');
}

/** Markdown view of a validation report, including what was not run and why. */
export function validationMarkdown(project) {
  const report = project.validation;
  if (!report) return '# Validation report\n\nThis project has not been validated yet.\n';
  const lines = ['# Validation report', '', `Project: ${project.title}  `, `Generated: ${report.generatedAt} by Genius Engineering Engine ${report.engineVersion}  `, `Summary: ${report.summary.pass} pass, ${report.summary.warn} warnings, ${report.summary.fail} failures, ${report.summary.notRun} not run`, '', 'Checks are run by code, not by an AI model. "Not run" means the check needs a tool or a person that was not available; it is never counted as a pass.', ''];
  lines.push(table(['Check', 'Tier', 'Target', 'Status', 'Tool', 'Evidence', 'Limitation', 'Recommendation'], report.checks.map(check => [check.id, `${check.tier} ${check.tierName || ''}`, check.target, CHECK_STATUS[check.status] || check.status, check.tool, check.evidence, check.limitation || '', check.recommendation || ''])), '');
  lines.push('## Files', '', table(['File', 'Class', 'Status'], (project.artifacts || []).map(item => [item.path, ARTIFACT_CLASS[item.class] || item.class, ARTIFACT_STATUS[item.status]?.label || item.status])), '');
  return lines.join('\n');
}

/**
 * The Development Pack: every engineering file at its own path, plus the project data, the overview, the diagrams,
 * and the validation report under .genius-project/. Returns a { path: text } map for the zip.
 */
export function developmentPack(project) {
  const folder = `${String(project.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project'}`;
  const files = {};
  for (const artifact of project.artifacts || []) files[`${folder}/${artifact.path}`] = artifact.content;
  files[`${folder}/.genius-project/project.json`] = JSON.stringify(project, null, 2);
  files[`${folder}/.genius-project/OVERVIEW.md`] = projectMarkdown(project);
  files[`${folder}/.genius-project/VALIDATION_REPORT.md`] = validationMarkdown(project);
  files[`${folder}/.genius-project/diagrams/dependencies.mmd`] = dependencyMermaid(project);
  for (const diagram of project.diagrams || []) files[`${folder}/.genius-project/diagrams/${String(diagram.id).replace(/[^A-Za-z0-9_-]/g, '')}-${String(diagram.title || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.mmd`] = diagram.mermaid;
  return { folder, files };
}
