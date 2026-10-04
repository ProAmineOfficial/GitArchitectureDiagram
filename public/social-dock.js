// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-BRAND-001
// Project: Git Architecture Diagram | Component: Pro_Amine social dock (glass buttons, proximity magnification).
// The links are ordinary anchors in the markup (target="_blank", rel="noopener noreferrer"); this module never
// intercepts them. It only adds the dock effect for a fine pointer — 1.28 for the item under the pointer, 1.12 for
// its neighbors, 1.04 for the next ones, 1.0 beyond — and the same emphasis for keyboard focus. Reduced motion turns
// the effect off. Platform glyphs are local SVG files listed in /assets/brand/social/glyphs.json; until a network's
// official file is provided, its button shows a typographic monogram.

export const NETWORKS = ['telegram', 'tiktok', 'youtube', 'facebook', 'instagram', 'github', 'x', 'linkedin']; // Display order.
export const DOCK = { scale: [1.28, 1.12, 1.04], lift: [-6, -2, 0] }; // By ring: under the pointer, neighbors, next neighbors.
const GLYPHS = '/assets/brand/social/glyphs.json';

/** Ring of each item around the active one (0, 1, 2, or 3 for "far"), from item centers in units of the dock pitch. */
export function rings(centers, active, pitch) {
  if (active === null || active < 0 || !centers[active]) return centers.map(() => 3);
  const origin = centers[active];
  return centers.map(point => { const distance = Math.hypot(point.x - origin.x, point.y - origin.y) / pitch; return distance < 0.5 ? 0 : distance <= 1.25 ? 1 : distance <= 2.25 ? 2 : 3; });
}

/** Apply ring-based scale and lift to the dock items through CSS custom properties. */
function paint(items, ringList) {
  items.forEach((item, index) => { const ring = ringList[index]; item.style.setProperty('--dock-scale', String(DOCK.scale[ring] ?? 1)); item.style.setProperty('--dock-lift', `${DOCK.lift[ring] ?? 0}px`); item.classList.toggle('is-active', ring === 0); item.classList.toggle('is-near', ring === 1); });
}

/** Mark the networks whose official glyph file is present, so CSS can show it instead of the monogram. */
async function loadGlyphs(items, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(GLYPHS, { credentials: 'same-origin', cache: 'no-cache' }); if (!response.ok) return;
    const glyphs = (await response.json())?.glyphs || {};
    for (const item of items) { const file = glyphs[item.dataset.network]; if (typeof file === 'string' && /^[a-z]+\.svg$/.test(file)) item.classList.add('has-glyph'); }
  } catch { /* Monograms stay; the links work either way. */ }
}

export function setupSocialDock(root = document) {
  const dock = root.querySelector('.footer-social'); if (!dock) return null;
  const items = [...dock.querySelectorAll('.social-link')]; if (!items.length) return null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'); const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0; let pending = null;
  const measure = () => { const boxes = items.map(item => { const box = item.parentElement.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width }; }); const gap = parseFloat(getComputedStyle(dock).columnGap) || 0; return { boxes, pitch: (boxes[0]?.width || 44) + gap }; }; // List items do not move when their links scale.
  const activate = index => { if (reduce.matches) { paint(items, items.map(() => 3)); return; } const { boxes, pitch } = measure(); paint(items, rings(boxes, index, pitch)); };
  const nearest = (x, y) => { const { boxes } = measure(); let best = -1; let distance = Infinity; boxes.forEach((box, index) => { const d = Math.hypot(box.x - x, box.y - y); if (d < distance) { distance = d; best = index; } }); return best; };
  dock.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse' || !fine.matches || reduce.matches) return; pending = [event.clientX, event.clientY]; if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (pending) activate(nearest(...pending)); }); });
  dock.addEventListener('pointerleave', () => { pending = null; activate(null); });
  dock.addEventListener('focusin', event => { const index = items.indexOf(event.target.closest('.social-link')); if (index >= 0) activate(index); });
  dock.addEventListener('focusout', event => { if (!dock.contains(event.relatedTarget)) activate(null); });
  reduce.addEventListener?.('change', () => activate(null));
  loadGlyphs(items);
  return { activate, items };
}
