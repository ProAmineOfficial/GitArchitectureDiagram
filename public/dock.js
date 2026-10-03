// Project: Git Architecture Diagram | Component: View dock | Author: Amine Saoud ibn al-Bashir.
// A centered dock of view icons with proximity magnification: each icon scales by its horizontal distance from the
// pointer along one continuous curve, and rises in proportion. Only transforms change, so layout never reflows.
// Magnification runs for fine pointers only and is off under prefers-reduced-motion.

export const DOCK = { max: 1.48, radius: 250, power: 2.5, lift: 29 }; // With the dock's ~67 px item pitch: ≈1.48 at the pointer, ≈1.22 one icon away, ≈1.07 two away, 1 beyond.

/** Scale for an icon whose center is `distance` pixels from the pointer. */
export function dockScale(distance, { max = DOCK.max, radius = DOCK.radius, power = DOCK.power } = {}) {
  const t = Math.min(1, Math.abs(distance) / radius);
  return 1 + (max - 1) * Math.pow(1 - t, power);
}
/** Upward lift (negative pixels) proportional to the magnification. */
export function dockLift(scale, lift = DOCK.lift) { return -(scale - 1) * lift; }

export function setupDock(dock) {
  const items = [...dock.querySelectorAll('.dock-item')];
  const fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)'); const still = matchMedia('(prefers-reduced-motion: reduce)'); // Narrow docks scroll, and a scroll container would clip magnified icons.
  let frame = 0; let pointer = null;
  const render = () => {
    frame = 0; const origin = dock.getBoundingClientRect().left + dock.clientLeft - dock.scrollLeft;
    for (const item of items) {
      const scale = pointer === null ? 1 : dockScale(pointer - (origin + item.offsetLeft + item.offsetWidth / 2)); // offsetLeft ignores transforms, so centers stay stable.
      item.style.setProperty('--s', scale.toFixed(3)); item.style.setProperty('--y', `${dockLift(scale).toFixed(1)}px`); item.classList.toggle('lifted', scale > 1.02);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  dock.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse' || !fine.matches || still.matches) return; pointer = event.clientX; schedule(); });
  dock.addEventListener('pointerleave', () => { pointer = null; schedule(); });
  fine.addEventListener?.('change', () => { pointer = null; schedule(); });
  still.addEventListener?.('change', () => { pointer = null; schedule(); });
  // Keyboard: arrow keys move focus across every dock item; Enter and Space activate the native buttons.
  dock.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = items.indexOf(document.activeElement); if (index < 0) return; event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });
  return { refresh: render };
}
