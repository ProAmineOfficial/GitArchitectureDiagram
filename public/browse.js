// Project: Git Architecture Diagram | Component: Browse examples | Author: Amine Saoud ibn al-Bashir.
// Saved snapshots of real repositories. Counts are the analyzer's own measurements at the pinned commit;
// they are not stars, usage numbers, or test results. Opening a card runs a fresh analysis.
import { EXAMPLES } from './examples.js';
import { icon } from './icons.js';
import { renderPreview } from './diagram.js';

const $ = selector => document.querySelector(selector);
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
let kind = 'All';
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) return; observer.unobserve(entry.target); drawPreview(entry.target); }), { rootMargin: '200px' }) : null;

async function drawPreview(container) {
  const example = EXAMPLES[Number(container.dataset.index)];
  const ok = await renderPreview(container, example.preview);
  if (!ok) container.replaceChildren(el('span', 'preview-empty', 'Preview unavailable'));
}

/** The workspace address for a snapshot, in the same GitHub shape the visitor would type. */
export function examplePath(example) {
  const scope = example.scope ? '/' + example.scope.split('/').map(encodeURIComponent).join('/') : '';
  return `/${example.repository}/tree/${example.sha}${scope}${example.maxFiles !== 32 ? `?files=${example.maxFiles}` : ''}`;
}

function card(example) {
  const index = EXAMPLES.indexOf(example);
  const item = el('article', 'example-card');
  const preview = el('div', 'example-preview'); preview.dataset.index = String(index); preview.setAttribute('aria-hidden', 'true');
  if (example.preview) { preview.append(el('span', 'preview-empty', 'Loading preview')); if (observer) observer.observe(preview); else drawPreview(preview); } else preview.append(el('span', 'preview-empty', 'No preview saved'));
  const body = el('div', 'example-body');
  const top = el('div', 'example-top'); top.append(el('span', 'card-kind', example.kind), el('span', 'saved', 'Saved snapshot'));
  const title = el('h3', '', example.title);
  const repo = el('code', 'example-repo', `${example.repository}${example.scope ? '/' + example.scope : ''}`);
  const description = el('p', '', example.description);
  const stats = el('dl', 'example-stats');
  for (const [value, label] of [[`${example.readFiles} of ${example.listedFiles}`, 'files read'], [example.relationships, 'local imports'], [example.diagrams, 'authored diagrams']]) { const group = el('div'); group.append(el('dt', '', label), el('dd', '', String(value))); stats.append(group); }
  const actions = el('div', 'example-actions');
  const open = el('a', 'primary-button', 'Open diagram'); open.href = examplePath(example); open.dataset.internal = '';
  const github = el('a', 'quiet-button', 'GitHub'); github.href = `https://github.com/${example.repository}/tree/${example.sha}${example.scope ? '/' + example.scope.split('/').map(encodeURIComponent).join('/') : ''}`; github.target = '_blank'; github.rel = 'noreferrer'; github.prepend(icon('external'));
  actions.append(open, github);
  const checked = el('p', 'example-checked', `Measured ${new Date(example.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} at commit ${example.sha.slice(0, 7)}. Opening runs a fresh analysis of that commit.`);
  body.append(top, title, repo, description, stats, actions, checked);
  item.append(preview, body);
  return item;
}

export function renderStarters(container) { container.replaceChildren(...EXAMPLES.slice(0, 3).map(card)); }

export function renderBrowse() {
  const kinds = ['All', ...new Set(EXAMPLES.map(item => item.kind))];
  $('#kind-filters').replaceChildren(...kinds.map(name => { const chip = el('button', 'chip', name); chip.type = 'button'; chip.setAttribute('aria-pressed', String(name === kind)); chip.addEventListener('click', () => { kind = name; renderBrowse(); }); return chip; }));
  const query = $('#example-search').value.toLowerCase().trim(); const sort = $('#example-sort').value;
  const sorters = { checked: (a, b) => b.checkedAt.localeCompare(a.checkedAt), read: (a, b) => b.readFiles - a.readFiles, diagrams: (a, b) => b.diagrams - a.diagrams, name: (a, b) => a.repository.localeCompare(b.repository) };
  const shown = EXAMPLES.filter(item => (kind === 'All' || item.kind === kind) && `${item.title} ${item.repository} ${item.kind} ${item.description}`.toLowerCase().includes(query)).sort(sorters[sort] || sorters.checked);
  $('#example-grid').replaceChildren(...shown.map(card));
  $('#example-count').textContent = `${shown.length} of ${EXAMPLES.length} saved snapshots`;
  $('#examples-empty').hidden = Boolean(shown.length);
}
$('#example-search').addEventListener('input', renderBrowse);
$('#example-sort').addEventListener('change', renderBrowse);
