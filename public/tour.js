// Project: Git Architecture Diagram | Component: Guided architecture tour | Author: Amine Saoud ibn al-Bashir.
// Steps come from a validated graph (the AI system map, or the deterministic component overview): each names a real
// node on screen, the stage of the walkthrough, the files that support it, and the kind of evidence behind it.
// Nothing here calls a model.
import { focusNode, highlight, clearHighlight, fit } from './diagram.js';
const $ = selector => document.querySelector(selector);
const DWELL = 5600; // Milliseconds per step while playing.
export const STAGE_LABELS = { start: 'Who starts it', entry: 'Entry point', control: 'Receives control', component: 'Next component', data: 'Data that moves', external: 'External system', state: 'Where state lives', output: 'What it produces', other: '' };
const BASIS_LABELS = { observed: 'Observed in source', documented: 'Stated in documentation', inferred: 'Genius interpretation' };
let steps = []; let index = 0; let timer = null; let playing = false; let options = {};
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function show(next) {
  index = Math.max(0, Math.min(steps.length - 1, next)); const step = steps[index];
  $('#tour-count').textContent = `Step ${index + 1} of ${steps.length}`; $('#tour-node').textContent = step.label; $('#tour-text').textContent = step.text;
  $('#tour-stage').textContent = STAGE_LABELS[step.stage] || ''; $('#tour-stage').hidden = !STAGE_LABELS[step.stage];
  const basis = step.basis || 'inferred'; $('#tour-basis').textContent = BASIS_LABELS[basis] || BASIS_LABELS.inferred; $('#tour-basis').dataset.basis = basis;
  const files = (step.files || []).slice(0, 4); $('#tour-files').replaceChildren(...files.map(path => { const button = document.createElement('button'); button.type = 'button'; button.className = 'tour-file'; button.textContent = path.split('/').slice(-2).join('/'); button.title = `Open ${path}`; button.addEventListener('click', () => { pause(); options.onFile?.(path); }); return button; }));
  $('#tour-files').hidden = !files.length;
  $('#tour-prev').disabled = index === 0; $('#tour-next').disabled = index === steps.length - 1;
  highlight(step.id, index ? steps[index - 1].id : null); focusNode(step.id);
  const bar = $('#tour-progress i'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth;
  if (playing) { bar.style.transition = reduceMotion() ? 'none' : `width ${DWELL}ms linear`; bar.style.width = '100%'; clearTimeout(timer); timer = setTimeout(() => (index < steps.length - 1 ? show(index + 1) : pause()), DWELL); }
}
function play() { playing = true; $('#tour-play').setAttribute('aria-label', 'Pause tour'); $('#tour-play').dataset.state = 'playing'; show(index >= steps.length - 1 ? 0 : index); }
function pause() { playing = false; clearTimeout(timer); $('#tour-play').setAttribute('aria-label', 'Play tour'); $('#tour-play').dataset.state = 'paused'; const bar = $('#tour-progress i'); bar.style.transition = 'none'; }
export function tourActive() { return !$('#tour').hidden; }
/** Start a tour of 3–12 validated steps; `onFile` opens a supporting file. Reduced motion starts paused. */
export function startTour(list, { onFile } = {}) { if (!list?.length) return; steps = list.slice(0, 12); index = 0; options = { onFile }; $('#tour').hidden = false; $('#canvas').classList.add('with-tour'); if (reduceMotion()) { playing = false; $('#tour-play').dataset.state = 'paused'; $('#tour-play').setAttribute('aria-label', 'Play tour'); show(0); } else play(); $('#tour-next').focus({ preventScroll: true }); }
export function stopTour({ refit = true } = {}) { pause(); $('#tour').hidden = true; $('#canvas').classList.remove('with-tour'); clearHighlight(); if (refit) fit(); }
$('#tour-prev').addEventListener('click', () => { pause(); show(index - 1); });
$('#tour-next').addEventListener('click', () => { pause(); show(index + 1); });
$('#tour-play').addEventListener('click', () => (playing ? pause() : play()));
$('#tour-close').addEventListener('click', () => stopTour());
document.addEventListener('keydown', event => { if (!tourActive() || event.target.closest('input, textarea, select')) return; if (event.key === 'ArrowRight') { pause(); show(index + 1); } else if (event.key === 'ArrowLeft') { pause(); show(index - 1); } else if (event.key === 'Escape') stopTour(); else if (event.key === ' ' && !event.target.closest('button')) { event.preventDefault(); playing ? pause() : play(); } else return; });
