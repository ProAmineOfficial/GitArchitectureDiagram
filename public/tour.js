// Project: Git Architecture Diagram | Component: Guided system-map tour | Author: Amine Saoud ibn al-Bashir.
// Steps come from the validated AI graph: each names a real node on screen. Nothing here calls a model.
import { focusNode, highlight, clearHighlight, fit } from './diagram.js';
const $ = selector => document.querySelector(selector);
const DWELL = 5200; // Milliseconds per step while playing.
let steps = []; let index = 0; let timer = null; let playing = false;
function show(next) {
  index = Math.max(0, Math.min(steps.length - 1, next)); const step = steps[index];
  $('#tour-count').textContent = `Step ${index + 1} of ${steps.length}`; $('#tour-node').textContent = step.label; $('#tour-text').textContent = step.text;
  $('#tour-prev').disabled = index === 0; $('#tour-next').disabled = index === steps.length - 1;
  highlight(step.id, index ? steps[index - 1].id : null); focusNode(step.id);
  const bar = $('#tour-progress i'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth;
  if (playing) { bar.style.transition = `width ${DWELL}ms linear`; bar.style.width = '100%'; clearTimeout(timer); timer = setTimeout(() => (index < steps.length - 1 ? show(index + 1) : pause()), DWELL); }
}
function play() { playing = true; $('#tour-play').setAttribute('aria-label', 'Pause tour'); $('#tour-play').dataset.state = 'playing'; show(index >= steps.length - 1 ? 0 : index); }
function pause() { playing = false; clearTimeout(timer); $('#tour-play').setAttribute('aria-label', 'Play tour'); $('#tour-play').dataset.state = 'paused'; const bar = $('#tour-progress i'); bar.style.transition = 'none'; }
export function tourActive() { return !$('#tour').hidden; }
export function startTour(list) { if (!list?.length) return; steps = list; index = 0; $('#tour').hidden = false; $('#canvas').classList.add('with-tour'); play(); $('#tour-next').focus({ preventScroll: true }); }
export function stopTour({ refit = true } = {}) { pause(); $('#tour').hidden = true; $('#canvas').classList.remove('with-tour'); clearHighlight(); if (refit) fit(); }
$('#tour-prev').addEventListener('click', () => { pause(); show(index - 1); });
$('#tour-next').addEventListener('click', () => { pause(); show(index + 1); });
$('#tour-play').addEventListener('click', () => (playing ? pause() : play()));
$('#tour-close').addEventListener('click', () => stopTour());
document.addEventListener('keydown', event => { if (!tourActive() || event.target.closest('input, textarea, select')) return; if (event.key === 'ArrowRight') { pause(); show(index + 1); } else if (event.key === 'ArrowLeft') { pause(); show(index - 1); } else if (event.key === 'Escape') stopTour(); else if (event.key === ' ' && !event.target.closest('button')) { event.preventDefault(); playing ? pause() : play(); } else return; });
