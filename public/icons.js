// Small, consistent vector interface icons; no external images or icon service is required.
const shapes = { // Use only fixed application-owned SVG geometry.
  network: '<rect x="8" y="2" width="8" height="6" rx="2"/><rect x="2" y="16" width="7" height="6" rx="2"/><rect x="15" y="16" width="7" height="6" rx="2"/><path d="M12 8v4M5.5 16v-4h13v4"/>', // Represent the source graph.
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>', // Mark repository folders.
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5"/>', // Mark source documents.
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>', // Mark implementation files.
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>', // Mark the Genius view.
  branch: '<circle cx="6" cy="5" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><path d="M6 8v8m0-4h6a6 6 0 0 0 6-4"/>', // Mark revision-aware links.
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>', // Mark the examples catalog.
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-3-3 3-3m-6 0 3-3"/>', // Mark temporary API credentials.
  external: '<path d="M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>', // Mark external source navigation.
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', // Mark repository search.
  check: '<path d="m4 12 5 5L20 6"/>', // Mark a completed analysis check.
}; // End the fixed icon set.
export function icon(name, className = '') { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', `ui-icon ${className}`); svg.innerHTML = shapes[name] || shapes.file; return svg; } // Render only known geometry, never repository content.
export function installIcons() { document.querySelectorAll('[data-icon]').forEach(element => element.replaceChildren(icon(element.dataset.icon))); } // Initialize semantic icon placeholders after the document loads.
