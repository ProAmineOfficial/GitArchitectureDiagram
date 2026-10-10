// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-WORKSPACE-UI-001
// Project: Git Architecture Diagram | Component: Mermaid canvas | Author: Amine Saoud ibn al-Bashir.
import mermaid from '/vendor/mermaid/mermaid.esm.min.mjs'; // Load the pinned local Mermaid distribution.
import DOMPurify from '/vendor/dompurify/purify.es.mjs'; // Sanitize generated SVG before inserting it into the page.
import { mappedTarget } from './source-navigation.js'; // Resolve only independently generated source targets.
import { MINDMAP_THEME } from './diagram-colors.js'; // Match folder legends to Mermaid's section indexing.
const canvas = document.querySelector('#canvas'); const content = document.querySelector('#diagram-content'); const message = document.querySelector('#diagram-empty'); // Bind the interactive canvas elements.
let scale = 1; let offset = { x: 0, y: 0 }; let drag = null; let serial = 0; let lastSource = ''; let activePaths = {}; let targets = new WeakMap(); let selectFile = () => {}; // Keep rendering and navigation state local to this module.
function transform() { content.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`; document.querySelector('#zoom-label').textContent = `${Math.round(scale * 100)}%`; } // Apply the current pan and zoom without mutating diagram data.
export function fit() { scale = 1; offset = { x: 0, y: 0 }; transform(); } // Restore the default fitted view.
export function zoom(multiplier) { scale = Math.max(0.2, Math.min(5, scale * multiplier)); transform(); } // Bound zoom to useful and accessible limits.
export function getSource() { return lastSource; } // Export the source currently shown, including user edits.
export function getSVG() { return content.querySelector('svg'); } // Expose the sanitized diagram for image export.
export function redrawDiagram() { return renderDiagram(lastSource, activePaths, selectFile, { generated: generatedSource }); } // Preserve the current source provenance when changing theme.
export function clearDiagram(text) { serial++; activePaths = {}; targets = new WeakMap(); content.replaceChildren(); message.textContent = text; message.hidden = false; lastSource = ''; } // Present an honest empty state without stale diagrams.
function configureMermaid(light = document.documentElement.dataset.theme === 'light') { // One place for Mermaid security and palette settings.
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme: 'base', themeVariables: { darkMode: !light, background: light ? '#f4f7f9' : '#0b1118', primaryColor: light ? '#e4f2f0' : '#163244', primaryTextColor: light ? '#192c3d' : '#e7eef5', primaryBorderColor: '#69b6bd', lineColor: light ? '#5e7887' : '#759bac', clusterBkg: light ? '#edf3f7' : '#12212d', clusterBorder: light ? '#c9d8e2' : '#314755', tertiaryColor: light ? '#f1edf9' : '#24233b', fontSize: '15px', fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif', ...MINDMAP_THEME }, maxTextSize: 50000, maxEdges: 500, suppressErrorRendering: true, flowchart: { htmlLabels: false, useMaxWidth: false, curve: 'basis' }, fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif' }); // Keep labels as SVG text and control rendering settings independently of repository content.
} // End Mermaid configuration.
const mix = (hex, target, amount) => { const a = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16)); const b = target.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16)); return '#' + a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join(''); }; // Blend two #rrggbb colors.
export function lightTint(stroke) { return { fill: mix(stroke, '#ffffff', 0.8), stroke: mix(stroke, '#000000', 0.35) }; } // Light-theme swatch derived from a role's stroke color.
function forTheme(source, generated) { // Re-tint application-generated classes in light theme; authored diagrams keep the author's colors.
  if (!generated || document.documentElement.dataset.theme !== 'light') return source;
  return source.replace(/^(\s*classDef\s+\S+\s+)fill:#[0-9a-f]{6},stroke:(#[0-9a-f]{6})(.*?)color:#[0-9a-f]{6}/gim, (match, head, stroke, middle) => { const tint = lightTint(stroke); return `${head}fill:${tint.fill},stroke:${tint.stroke}${middle}color:#14202e`; });
} // End theme adaptation.
let generatedSource = false; // Whether the current source came from this application.
export async function renderDiagram(source, paths = {}, onFile = () => {}, { generated = false } = {}) { // Render either factual analysis or an attributed repository diagram.
  const current = ++serial; lastSource = source; activePaths = paths; selectFile = onFile; content.replaceChildren(); message.textContent = 'Rendering the diagram…'; message.hidden = false; // Replace the previous drawing and announce progress.
  if (source.length > 50000 || /%%\s*\{|^\s*---/m.test(source)) { message.textContent = 'This diagram contains a configuration directive or exceeds the preview limit.\nYou can still inspect and export its Mermaid source.'; return; } // Prevent repository text from overriding Mermaid security settings.
  const light = document.documentElement.dataset.theme === 'light'; // Match graph surfaces to the surrounding workspace.
  configureMermaid(light); // Apply the workspace palette and security settings.
  try { // Catch syntax errors without breaking the rest of the workspace.
    await document.fonts?.ready; // Measure labels with the loaded interface font so boxes fit their text.
    generatedSource = generated; const { svg } = await mermaid.render(`diagram${current}`, forTheme(source, generated)); if (current !== serial) return; // Ignore outdated asynchronous render results.
    content.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'a'], FORBID_ATTR: ['onload', 'onclick'] }); // Remove active content and external clickable links.
    content.querySelectorAll('[href], [xlink\\:href]').forEach(node => { for (const attribute of ['href', 'xlink:href']) { const value = node.getAttribute(attribute); if (value && !value.startsWith('#')) node.removeAttribute(attribute); } }); // Allow only local SVG references.
    targets = new WeakMap(); content.querySelectorAll('.node, .mindmap-node').forEach(element => { const target = mappedTarget(element, paths); if (!target) return; targets.set(element, target); element.dataset.sourceNode = 'true'; element.setAttribute('tabindex', '0'); element.setAttribute('role', 'link'); element.setAttribute('aria-label', `Open ${target.path || 'repository root'} at the analyzed commit`); }); const svgElement = getSVG(); if (svgElement) { svgElement.setAttribute('role', 'group'); svgElement.setAttribute('aria-label', 'Repository diagram; focus a linked node and press Enter to open its source'); } message.hidden = true; fit(); // Label the rendered image and fit its view.
  } catch (error) { if (current === serial) { const detail = String(error?.message || '').split('\n').find(line => /line \d+/i.test(line)) || ''; message.textContent = `Mermaid could not render this source.${detail ? '\n' + detail.slice(0, 160) : ''}\nOpen the Mermaid source tab to review, fix, or reset it.`; content.replaceChildren(); document.dispatchEvent(new CustomEvent('diagram-error', { detail: detail })); } } // Preserve source access and name the failing line when Mermaid reports it.
} // End Mermaid rendering.
canvas.addEventListener('wheel', event => { if (event.target.closest('.canvas-tools, .tour-card')) return; if (!event.ctrlKey && !event.metaKey && canvas.dataset.engaged !== 'true' && canvas.dataset.wheel !== 'on' && !document.fullscreenElement) return; event.preventDefault(); zoom(event.deltaY > 0 ? 0.9 : 1.1); }, { passive: false }); // The page scrolls until the diagram is clicked; Ctrl/Cmd + scroll always zooms.
canvas.addEventListener('pointerdown', () => { canvas.dataset.engaged = 'true'; }, true); canvas.addEventListener('pointerleave', () => { canvas.dataset.engaged = 'false'; }); // Engage wheel zoom by clicking the diagram. // Zoom only inside the interactive canvas.
canvas.addEventListener('pointerdown', event => { if (event.target.closest('.canvas-tools, .tour-card') || event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false }; canvas.setPointerCapture(event.pointerId); }); // Start mouse or touch panning with pointer capture.
canvas.addEventListener('pointermove', event => { if (!drag) return; const x = event.clientX - drag.x; const y = event.clientY - drag.y; if (Math.abs(x) + Math.abs(y) > 5) drag.moved = true; offset = { x: drag.ox + x, y: drag.oy + y }; transform(); }); // Pan the diagram without altering its underlying SVG.
canvas.addEventListener('pointerup', event => { const moved = drag?.moved; drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); if (moved) return; const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-source-node]'); const target = element && targets.get(element); if (target) selectFile(target); }); // Open mapped source only after a click, never after a pan gesture.
content.addEventListener('keydown', event => { if (!['Enter', ' '].includes(event.key)) return; const element = event.target.closest('[data-source-node]'); const target = element && targets.get(element); if (target) { event.preventDefault(); selectFile(target); } }); // Give keyboard users the same exact source navigation.
canvas.addEventListener('pointercancel', () => { drag = null; }); // End interrupted touch gestures cleanly.

export async function validateSource(source) { // Check Mermaid syntax before rendering edited source.
  if (!source.trim()) return { ok: false, message: 'The source is empty.' };
  if (source.length > 50000 || /%%\s*\{|^\s*---/m.test(source)) return { ok: false, message: 'Configuration directives and front matter are not rendered here, to keep repository content from changing security settings.' };
  try { await mermaid.parse(source); return { ok: true, message: 'Valid Mermaid syntax.' }; } catch (error) { return { ok: false, message: String(error?.message || 'Invalid Mermaid syntax.').split('\n').slice(0, 3).join(' ').slice(0, 300) }; }
} // End syntax validation.
let previews = 0; // Unique identifiers for non-interactive previews.
export async function renderPreview(container, source) { // Draw a small, non-interactive diagram for catalog cards.
  if (!source || source.length > 20000 || /%%\s*\{|^\s*---/m.test(source)) return false;
  try { await document.fonts?.ready; configureMermaid(); const { svg } = await mermaid.render(`preview${++previews}`, source); container.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'a'], FORBID_ATTR: ['onload', 'onclick'] }); container.querySelector('svg')?.setAttribute('aria-hidden', 'true'); return true; } catch { return false; }
} // End preview rendering.
canvas.addEventListener('keydown', event => { // Keyboard zoom and pan when the canvas has focus.
  if (event.target.closest('[data-source-node], .canvas-tools')) return;
  const step = 40; const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (event.key === '+' || event.key === '=') zoom(1.2); else if (event.key === '-') zoom(1 / 1.2); else if (event.key === '0') fit(); else if (moves[event.key]) { offset = { x: offset.x + moves[event.key][0], y: offset.y + moves[event.key][1] }; transform(); } else return;
  event.preventDefault();
}); // End keyboard canvas controls.

// ——— Motion: entrance, flowing edges, and guided focus. All of it is skipped under prefers-reduced-motion. ———
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function nodeElement(id) { return content.querySelector(`g.node[id^="flowchart-${id}-"]`) || content.querySelector(`g.node[id*="-flowchart-${id}-"]`); } // Resolve a compiled node id to its drawn group.
function edgesBetween(a, b) { return [a, b].flatMap(([x, y] = []) => []).concat(...[[a, b], [b, a]].map(([x, y]) => [...content.querySelectorAll(`path[id^="L_${x}_${y}_"], path[id*="-L_${x}_${y}_"], path[data-id^="L_${x}_${y}_"], path[data-id*="-L_${x}_${y}_"]`)])); } // Mermaid may prefix edge ids with the render id. // Mermaid names edge paths L_<from>_<to>_<n>.
export function decorate({ flowEdges = [] } = {}) { // Call after each render.
  content.querySelectorAll('g.node, g.cluster').forEach((item, index) => item.style.setProperty('--i', String(Math.min(index, 40))));
  for (const [a, b] of flowEdges) edgesBetween(a, b).forEach(path => path.classList.add('flow-edge'));
  content.classList.remove('entering'); if (still()) return; // No entrance animation under reduced motion.
  const drawn = [...content.querySelectorAll('.edgePaths path, path.flowchart-link')].filter(path => !path.classList.contains('flow-edge')); drawn.forEach(path => path.setAttribute('pathLength', '1')); // Normalize lengths so every edge draws in at once.
  void content.getBoundingClientRect(); content.classList.add('entering');
  setTimeout(() => { content.classList.remove('entering'); drawn.forEach(path => path.removeAttribute('pathLength')); }, 1500); // Restore dotted styles after drawing.
} // End decoration.
export function focusNode(id, { zoomTo = Math.max(scale, 1.35), lift = 70 } = {}) { // Glide the camera so a node sits above the tour caption.
  const element = nodeElement(id); if (!element) return false;
  const box = canvas.getBoundingClientRect(); const rect = element.getBoundingClientRect();
  const qx = (rect.left + rect.width / 2 - (box.left + box.width / 2) - offset.x) / scale; const qy = (rect.top + rect.height / 2 - (box.top + box.height / 2) - offset.y) / scale;
  scale = Math.min(3, zoomTo); offset = { x: -scale * qx, y: -scale * qy - lift };
  if (!still()) { content.classList.add('gliding'); setTimeout(() => content.classList.remove('gliding'), 800); }
  transform(); return true;
} // End focus.
export function highlight(id, previous = null) { // Emphasize one node and the edge that led to it.
  content.classList.add('touring'); content.querySelectorAll('.tour-active, .flow-active').forEach(item => item.classList.remove('tour-active', 'flow-active'));
  nodeElement(id)?.classList.add('tour-active'); if (previous) edgesBetween(previous, id).forEach(path => path.classList.add('flow-active'));
} // End highlight.
export function clearHighlight() { content.classList.remove('touring'); content.querySelectorAll('.tour-active, .flow-active').forEach(item => item.classList.remove('tour-active', 'flow-active')); }
