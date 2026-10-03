// Project: Git Architecture Diagram | Component: Highlights | Author: Amine Saoud ibn al-Bashir.
// Isolate the parts of a diagram that matter. Selection is a pure function over a small graph model,
// so it is unit-tested in Node; the DOM layer only reads the rendered SVG and toggles classes.

const has = (node, pattern) => pattern.test(`${node.label} ${node.path}`);
const kind = (node, ...kinds) => kinds.includes(node.kind);
/** Highlight modes. basis says how to label the result: source-derived, Genius interpretation, or keyword match. */
export const MODES = [
  { id: 'key', label: 'Key architecture', basis: 'source', pick: (node, ctx) => kind(node, 'entry') || ctx.top.has(node.id) || ctx.tour.has(node.id) },
  { id: 'entry', label: 'Entry points', basis: 'source', pick: node => kind(node, 'entry') || has(node, /(^|\/|\s)(main|index|app|server|cli)\.[a-z]+\b/i) },
  { id: 'core', label: 'Core components', basis: 'source', pick: (node, ctx) => (kind(node, 'source', 'service', 'hardware') && ctx.degree(node.id) >= 1) || ctx.top.has(node.id) },
  { id: 'flow', label: 'Data flow', basis: 'source', flow: true },
  { id: 'api', label: 'API flow', basis: 'source', pick: node => has(node, /\bapi\b|route|controller|endpoint|graphql|rest|handler|gateway/i), neighbors: true },
  { id: 'frontend', label: 'Frontend', basis: 'source', pick: node => kind(node, 'ui') || has(node, /frontend|client|\bui\b|\bweb\b|public\/|components?|pages|views?|\.(jsx|tsx|vue|svelte|html|css)\b/i) },
  { id: 'backend', label: 'Backend', basis: 'source', pick: node => kind(node, 'service') || has(node, /server|backend|service|worker|\bapi\b/i) },
  { id: 'storage', label: 'Storage', basis: 'source', pick: node => kind(node, 'data') || has(node, /\bdb\b|database|store|storage|cache|redis|sql|schema|migration|artifact/i) },
  { id: 'external', label: 'External services', basis: 'source', pick: node => kind(node, 'external', 'actor') },
  { id: 'ai', label: 'AI components', basis: 'source', pick: node => has(node, /\bai\b|llm|openai|anthropic|claude|gemini|kimi|genius|prompt|model\b|agent/i) },
  { id: 'hardware', label: 'Hardware and devices', basis: 'source', pick: node => kind(node, 'hardware') || has(node, /gpio|i2c|spi|uart|sensor|driver|board|firmware|\bhal\b|esp32|arduino|\.ino\b|footprint/i) },
  { id: 'security', label: 'Security-critical', basis: 'source', pick: node => has(node, /auth|login|token|secret|crypt|security|permission|password|saniti[sz]|\bcsp\b|access|credential/i) },
  { id: 'build', label: 'Build and deployment', basis: 'source', pick: node => kind(node, 'config', 'automation') || has(node, /build|deploy|\bci\b|docker|wrangler|workflow|package\.json|platformio|cmake|makefile|\.github/i) },
  { id: 'tests', label: 'Tests', basis: 'source', pick: node => kind(node, 'tests', 'test') || has(node, /(^|\/|\s)tests?\b|spec|\.test\./i) },
  { id: 'docs', label: 'Documentation', basis: 'source', pick: node => kind(node, 'docs', 'document') || has(node, /\.md\b|(^|\/|\s)docs?\b|readme|guide/i) },
  { id: 'hubs', label: 'High-dependency nodes', basis: 'source', pick: (node, ctx) => ctx.hubs.has(node.id) },
  { id: 'genius', label: 'Genius highlights', basis: 'genius', pick: (node, ctx) => ctx.tour.has(node.id) || (ctx.top.has(node.id) && ctx.ai) },
];

/**
 * Compute which nodes and edges to emphasize.
 * @param {{nodes: {id,label,kind,path}[], edges: {from,to}[]}} model
 * @param {string} modeId a MODES id, or 'query'
 * @param {{tour?: string[], flowEdges?: string[][], query?: string, paths?: string[], ai?: boolean}} options
 */
export function computeHighlight(model, modeId, { tour = [], flowEdges = [], query = '', paths = [], ai = false } = {}) {
  const inbound = new Map(); const outbound = new Map();
  model.edges.forEach(edge => { outbound.set(edge.from, (outbound.get(edge.from) || 0) + 1); inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1); });
  const degree = id => (inbound.get(id) || 0) + (outbound.get(id) || 0);
  const ranked = [...model.nodes].sort((a, b) => degree(b.id) - degree(a.id));
  const cut = Math.max(1, Math.ceil(model.nodes.length * 0.2));
  const top = new Set(ranked.slice(0, cut).filter(node => degree(node.id) > 0).map(node => node.id));
  const hubs = new Set(ranked.filter(node => degree(node.id) >= Math.max(3, degree(ranked[cut - 1]?.id || '') || 0)).map(node => node.id));
  const ctx = { degree, top, hubs, tour: new Set(tour), ai };
  const nodes = new Set(); let edges = new Set(); let basis = 'source'; let note = '';
  const neighborsOf = ids => model.edges.filter(edge => ids.has(edge.from) || ids.has(edge.to));
  if (modeId === 'query' || modeId === 'paths') {
    const terms = String(query).toLowerCase().match(/[\p{L}\p{N}_.-]{3,}/gu)?.filter(term => !['highlight', 'show', 'the', 'and', 'flow', 'path', 'components', 'dependencies'].includes(term)) || [];
    model.nodes.forEach(node => { const text = `${node.label} ${node.path}`.toLowerCase(); if ((terms.length && terms.some(term => text.includes(term))) || paths.some(path => node.path && (node.path === path || node.path.startsWith(path + '/') || path.startsWith(node.path + '/')))) nodes.add(node.id); });
    neighborsOf(new Set(nodes)).forEach(edge => { nodes.add(edge.from); nodes.add(edge.to); edges.add(`${edge.from}>${edge.to}`); });
    basis = modeId === 'paths' ? 'selection' : 'keyword'; note = modeId === 'paths' ? 'Components that contain the selected paths, and their direct relationships.' : `Keyword match for "${query}" and direct neighbors; not an AI interpretation.`;
  } else {
    const mode = MODES.find(item => item.id === modeId); if (!mode) return { nodes, edges, basis, note: 'Unknown highlight.' };
    basis = mode.basis;
    if (mode.flow) {
      if (flowEdges.length) { flowEdges.forEach(([a, b]) => { nodes.add(a); nodes.add(b); edges.add(`${a}>${b}`); }); basis = 'genius'; note = 'The main flow from the Genius tour.'; }
      else { const verified = model.nodes.filter(node => node.kind === 'entry'); const start = (verified.length ? verified : model.nodes.filter(node => /(^|\/)(main|index|server|cli)\.[a-z]+$/i.test(node.path))).map(node => node.id); /* Entry kinds come from the analyzer; filenames are only a fallback. */ const queue = start.length ? start : ranked.slice(0, 1).map(node => node.id); const seen = new Set(queue); for (let depth = 0; depth < 6 && queue.length; depth++) { for (const id of queue.splice(0)) for (const edge of model.edges.filter(item => item.from === id)) { edges.add(`${edge.from}>${edge.to}`); if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); } } } seen.forEach(id => nodes.add(id)); note = 'Followed located imports outward from the entry points.'; }
    } else {
      model.nodes.forEach(node => { if (mode.pick(node, ctx)) nodes.add(node.id); });
      if (mode.neighbors) neighborsOf(new Set(nodes)).forEach(edge => { nodes.add(edge.from); nodes.add(edge.to); });
      model.edges.forEach(edge => { if (nodes.has(edge.from) && nodes.has(edge.to)) edges.add(`${edge.from}>${edge.to}`); });
      note = basis === 'genius' ? 'Chosen from the Genius tour and the most connected components. Interpretation, not verified source.' : 'Matched from node kinds, names, and paths in this diagram.';
    }
  }
  return { nodes, edges, basis, note };
}

/** Read a small graph model from a rendered Mermaid flowchart. */
export function readModel(content, paths = {}) {
  const nodes = []; const kinds = ['entry', 'source', 'ui', 'hardware', 'service', 'data', 'config', 'docs', 'document', 'tests', 'test', 'examples', 'automation', 'assets', 'external', 'actor', 'concept', 'safety'];
  content.querySelectorAll('g.node').forEach(element => { const id = (element.id.match(/flowchart-([A-Za-z0-9_]+)-\d+$/) || [])[1]; if (!id) return; const kindName = kinds.find(name => element.classList.contains(name)) || ''; nodes.push({ id, label: element.textContent.trim().replace(/\s+/g, ' '), kind: kindName, path: paths[id]?.path || '' }); });
  const ids = new Set(nodes.map(node => node.id)); const edges = [];
  content.querySelectorAll('path[id*="L_"], path[data-id*="L_"]').forEach(path => { const full = path.id || path.dataset.id || ''; const raw = full.includes('-L_') ? full.slice(full.lastIndexOf('-L_') + 1) : full; if (!raw.startsWith('L_')) return; const match = raw.match(/^L_(.+)_(.+)_\d+$/); if (!match) return; let [, from, to] = match; if (!ids.has(from) || !ids.has(to)) { const parts = raw.slice(2).replace(/_\d+$/, '').split('_'); for (let i = 1; i < parts.length; i++) { const a = parts.slice(0, i).join('_'); const b = parts.slice(i).join('_'); if (ids.has(a) && ids.has(b)) { from = a; to = b; break; } } } if (ids.has(from) && ids.has(to)) edges.push({ from, to, element: path }); });
  return { nodes, edges };
}

/** Apply a computed highlight to the rendered diagram. */
export function applyHighlight(content, model, selection) {
  clearHighlight(content);
  if (!selection.nodes.size) return 0;
  content.classList.add('highlighting');
  content.querySelectorAll('g.node').forEach(element => { const id = (element.id.match(/flowchart-([A-Za-z0-9_]+)-\d+$/) || [])[1]; if (selection.nodes.has(id)) element.classList.add('hl-on'); });
  model.edges.forEach(edge => { if (selection.edges.has(`${edge.from}>${edge.to}`)) edge.element.classList.add('hl-edge'); });
  return selection.nodes.size;
}
export function clearHighlight(content) { content.classList.remove('highlighting'); content.querySelectorAll('.hl-on, .hl-edge').forEach(element => element.classList.remove('hl-on', 'hl-edge')); }
