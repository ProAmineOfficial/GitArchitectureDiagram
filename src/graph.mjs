// Project: Git Architecture Diagram | Component: Structured graph compiler | Author: Amine Saoud ibn al-Bashir.
// Description: Validate a component graph against the repository inventory, then compile it into Mermaid.
// Both the deterministic overview and optional AI output use this path, so every rendered node is either
// mapped to a verified repository path or explicitly marked as a concept with no source location.

// Semantic kinds: one shape and one color each, so the legend can explain every node on screen.
export const KINDS = {
  entry: { label: 'Entry point', shape: ['([', '])'], fill: '#12334c', stroke: '#66d4ff' },
  source: { label: 'Source module', shape: ['[', ']'], fill: '#123638', stroke: '#55d6ca' },
  ui: { label: 'User interface', shape: ['(', ')'], fill: '#3c2349', stroke: '#e3a0ed' },
  hardware: { label: 'Hardware / firmware', shape: ['[/', '\\]'], fill: '#173d2c', stroke: '#79d99b' },
  service: { label: 'Service / API', shape: ['[[', ']]'], fill: '#1c2f4d', stroke: '#8fb3ff' },
  data: { label: 'Data / storage', shape: ['[(', ')]'], fill: '#2a2f3d', stroke: '#9fb0c8' },
  config: { label: 'Configuration / build', shape: ['[/', '/]'], fill: '#44341b', stroke: '#f2c66d' },
  docs: { label: 'Documentation', shape: ['>', ']'], fill: '#2d2550', stroke: '#b9a4ff' },
  tests: { label: 'Tests', shape: ['{{', '}}'], fill: '#2f3a17', stroke: '#c3e36b' },
  examples: { label: 'Examples / projects', shape: ['[[', ']]'], fill: '#1d3340', stroke: '#6fc3df' },
  automation: { label: 'Automation / CI', shape: ['[\\', '\\]'], fill: '#45281c', stroke: '#ff9f68' },
  assets: { label: 'Assets / binaries', shape: ['[(', ')]'], fill: '#26303b', stroke: '#8aa0b6' },
  actor: { label: 'Person or device', shape: ['((', '))'], fill: '#2a2146', stroke: '#c9a7ff' },
  external: { label: 'External system or dependency', shape: ['[', ']'], fill: '#1b212b', stroke: '#8a96a8', dashed: true },
  concept: { label: 'Concept (no source mapping)', shape: ['(', ')'], fill: '#1f2430', stroke: '#b0b8c6', dashed: true },
};

// Edge provenance is shown by line style: evidence type must stay visible after rendering.
export const BASES = {
  observed: { label: 'Observed in source (import / include)', arrow: '-->' },
  documented: { label: 'Stated in repository documentation', arrow: '==>' },
  inferred: { label: 'AI interpretation — review the evidence', arrow: '-.->' },
};

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/; // Model-supplied identifiers are validated before use.

/** Escape untrusted text for a quoted Mermaid label; structural characters are removed. */
export function labelText(value, limit = 60) {
  return String(value ?? '').replace(/[\x00-\x1f]/g, ' ').replace(/[[\]{}()|`"<>#;]/g, ' ').replace(/&/g, 'and').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Validate a structured graph against the repository inventory.
 * @param {object} raw untrusted graph (from a model or a builder)
 * @param {{paths: Set<string>, folders: Set<string>, lineLimits?: Map<string, number>}} inventory
 * @returns {{graph: object, discarded: string[]}} a safe graph plus human-readable reasons for removed items
 */
export function validateGraph(raw, { paths, folders, lineLimits = new Map() }) {
  const discarded = [];
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return { graph: { groups: [], nodes: [], edges: [] }, discarded: ['The graph was missing its node or edge list.'] };
  const groups = (Array.isArray(raw.groups) ? raw.groups : []).filter(group => group && ID.test(group.id) && typeof group.label === 'string').slice(0, 16).map(group => ({ id: group.id, label: labelText(group.label, 48) }));
  const groupIds = new Set(groups.map(group => group.id));
  const nodes = [];
  for (const item of raw.nodes.slice(0, 60)) {
    if (!item || !ID.test(item.id) || typeof item.label !== 'string' || nodes.some(node => node.id === item.id)) { discarded.push(`Node "${String(item?.id ?? '?').slice(0, 40)}" had an invalid or duplicate identifier.`); continue; }
    const path = typeof item.path === 'string' ? item.path.replace(/^\/+|\/+$/g, '') : '';
    const isFile = path && paths.has(path); const isFolder = path === '' ? false : folders.has(path);
    const mapped = isFile || isFolder;
    if (path && !mapped) discarded.push(`"${item.label.slice(0, 40)}" cited ${path.slice(0, 80)}, which is not in this commit; it is shown as an unmapped concept.`);
    const standalone = item.kind === 'external' || item.kind === 'actor'; // People, devices, and outside systems legitimately have no repository path.
    const kind = mapped || standalone ? (Object.hasOwn(KINDS, item.kind) && item.kind !== 'concept' ? item.kind : 'source') : 'concept';
    nodes.push({ id: item.id, label: labelText(item.label, 48), detail: labelText(item.detail || '', 64), kind, group: groupIds.has(item.group) ? item.group : '', path: mapped ? path : '', pathType: isFile ? 'blob' : isFolder ? 'tree' : '', basis: ['observed', 'documented', 'inferred'].includes(item.basis) ? item.basis : 'inferred' });
  }
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = [];
  for (const item of raw.edges.slice(0, 120)) {
    if (!item || !nodeIds.has(item.from) || !nodeIds.has(item.to) || item.from === item.to) { discarded.push('A relationship referred to a missing node.'); continue; }
    const basis = Object.hasOwn(BASES, item.basis) ? item.basis : 'inferred';
    const evidencePath = typeof item.evidencePath === 'string' ? item.evidencePath : ''; const line = Number(item.evidenceLine);
    const hasEvidence = evidencePath && paths.has(evidencePath) && Number.isInteger(line) && line >= 1 && (!lineLimits.size || line <= (lineLimits.get(evidencePath) || 0));
    if ((basis === 'observed' || basis === 'documented') && !hasEvidence && !item.count) { discarded.push(`A relationship labeled "${basis}" had no verifiable path and line; it is shown as inferred.`); }
    edges.push({ from: item.from, to: item.to, label: labelText(item.label || '', 40), basis: basis !== 'inferred' && !hasEvidence && !item.count ? 'inferred' : basis, count: Number.isInteger(item.count) ? item.count : null, evidence: hasEvidence ? { path: evidencePath, line } : null });
  }
  const tour = [];
  for (const step of (Array.isArray(raw.tour) ? raw.tour : []).slice(0, 8)) { // A guided walk through the main flow, validated like everything else.
    if (!step || !nodeIds.has(step.node) || typeof step.text !== 'string' || !step.text.trim() || tour.at(-1)?.node === step.node) { if (step) discarded.push('A tour step referred to a missing node or had no text.'); continue; }
    tour.push({ node: step.node, text: step.text.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 280) });
  }
  const steps = new Set(tour.slice(1).map((step, index) => `${tour[index].node}>${step.node}`));
  edges.forEach(edge => { edge.flow = steps.has(`${edge.from}>${edge.to}`) || steps.has(`${edge.to}>${edge.from}`); }); // Edges along the tour carry the animated flow.
  return { graph: { direction: raw.direction === 'LR' ? 'LR' : 'TD', groups, nodes, edges, tour }, discarded };
}

/**
 * Compile a validated graph to Mermaid with stable node identifiers and a source map.
 * @returns {{mermaid: string, nodePaths: object, legend: object[], edgeLegend: object[], nodes: object[], edges: object[]}}
 */
export function compileGraph(graph, { title = '' } = {}) {
  const lines = [`flowchart ${graph.direction || 'TD'}`];
  if (title) lines.push(`%% ${labelText(title, 120)}`);
  const ids = new Map(graph.nodes.map((node, index) => [node.id, `n${index}`])); // Never reuse external identifiers inside Mermaid.
  const nodePaths = {};
  const declare = node => {
    const [open, close] = KINDS[node.kind].shape;
    const label = node.detail ? `${node.label}<br/>${node.detail}` : node.label; // Mermaid renders <br/> as a line break in both label modes.
    if (node.path || node.pathType) nodePaths[ids.get(node.id)] = { path: node.path, type: node.pathType || 'tree' };
    return `${ids.get(node.id)}${open}"${label}"${close}:::${node.kind}`;
  };
  const grouped = new Map(graph.groups.map(group => [group.id, []]));
  const loose = [];
  graph.nodes.forEach(node => (node.group && grouped.has(node.group) ? grouped.get(node.group) : loose).push(node));
  graph.groups.forEach((group, index) => { const members = grouped.get(group.id); if (!members.length) return; lines.push(`subgraph g${index}["${group.label}"]`, ...members.map(node => `  ${declare(node)}`), 'end'); });
  loose.forEach(node => lines.push(declare(node)));
  graph.edges.forEach(edge => {
    const text = [edge.label, edge.count > 1 ? `×${edge.count}` : ''].filter(Boolean).join(' ');
    lines.push(`${ids.get(edge.from)} ${BASES[edge.basis].arrow}${text ? `|${text}|` : ''} ${ids.get(edge.to)}`);
  });
  const connected = new Set(graph.edges.flatMap(edge => [edge.from, edge.to])); // Unconnected nodes would otherwise form one long row.
  const isolated = loose.filter(node => !connected.has(node.id));
  const columns = Math.max(3, Math.ceil(Math.sqrt(isolated.length * 1.5)));
  if (isolated.length > columns) { lines.push('%% Invisible links arrange unconnected nodes in a grid; they are not relationships.'); for (let index = 0; index + columns < isolated.length; index++) lines.push(`${ids.get(isolated[index].id)} ~~~ ${ids.get(isolated[index + columns].id)}`); }
  if (!graph.nodes.length) lines.push('empty["Nothing to show in this scope"]');
  Object.entries(KINDS).forEach(([kind, style]) => lines.push(`classDef ${kind} fill:${style.fill},stroke:${style.stroke},stroke-width:1.6px,color:#f3f7ff${style.dashed ? ',stroke-dasharray:5 4' : ''}`));
  const used = new Set(graph.nodes.map(node => node.kind));
  const legend = Object.entries(KINDS).filter(([kind]) => used.has(kind)).map(([kind, style]) => ({ role: kind, label: style.label, fill: style.fill, stroke: style.stroke, count: graph.nodes.filter(node => node.kind === kind).length, dashed: Boolean(style.dashed) }));
  const edgeLegend = Object.entries(BASES).filter(([basis]) => graph.edges.some(edge => edge.basis === basis)).map(([basis, style]) => ({ basis, label: style.label, arrow: style.arrow, count: graph.edges.filter(edge => edge.basis === basis).length }));
  const tour = (graph.tour || []).map(step => ({ id: ids.get(step.node), label: graph.nodes.find(node => node.id === step.node)?.label || '', text: step.text }));
  const flowEdges = graph.edges.filter(edge => edge.flow).map(edge => [ids.get(edge.from), ids.get(edge.to)]);
  return { mermaid: lines.join('\n'), nodePaths, legend, edgeLegend, nodes: graph.nodes, edges: graph.edges, groups: graph.groups, tour, flowEdges };
}
