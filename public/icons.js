// Small, consistent vector interface icons; no external images or icon service is required.
const shapes = { // Use only fixed application-owned SVG geometry.
  repo: '<path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2V4Z"/><path d="M5 20a2 2 0 0 0 2 2h12v-4M9 7h6"/>', // Repository identity.
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', // Repository information.
  down: '<path d="m7 10 5 5 5-5"/>', // Menu caret.
  'dock-system': '<circle cx="12" cy="12" r="2.6"/><circle cx="5.5" cy="6" r="2.2"/><circle cx="18.5" cy="6" r="2.2"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="m7.3 7.4 2.8 2.7M16.7 7.4l-2.8 2.7M7.3 16.6l2.8-2.7M16.7 16.6l-2.8-2.7"/>',
  'dock-architecture': '<rect x="5" y="2.5" width="14" height="4.5" rx="1.4"/><rect x="3" y="9.75" width="18" height="4.5" rx="1.4"/><rect x="5" y="17" width="14" height="4.5" rx="1.4"/><path d="M12 7v2.75M12 14.25V17"/>',
  'dock-hierarchy': '<rect x="9" y="2.5" width="6" height="4.5" rx="1.2"/><rect x="2.5" y="16.5" width="6" height="4.5" rx="1.2"/><rect x="15.5" y="16.5" width="6" height="4.5" rx="1.2"/><path d="M12 7v4.5M5.5 16.5v-5h13v5"/>',
  'dock-mindmap': '<circle cx="12" cy="12" r="2.8"/><circle cx="12" cy="3.5" r="1.8"/><circle cx="3.8" cy="9" r="1.8"/><circle cx="20.2" cy="9" r="1.8"/><circle cx="6.5" cy="20" r="1.8"/><circle cx="17.5" cy="20" r="1.8"/><path d="M12 9.2V5.3M9.4 11 5.5 9.6M14.6 11l3.9-1.4M10.4 14.3l-2.9 4M13.6 14.3l2.9 4"/>',
  'dock-diagrams': '<path d="M8 3h9.5a2 2 0 0 1 2 2v12.5"/><rect x="4.5" y="6.5" width="12" height="14.5" rx="2"/><circle cx="8.3" cy="11" r="1.4"/><circle cx="12.7" cy="16.3" r="1.4"/><path d="m9.2 12.1 2.6 3.1"/>',
  'dock-source': '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  'dock-guide': '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.2 3.2M15.5 15.5l3.2 3.2M18.7 5.3l-3.2 3.2M8.5 15.5l-3.2 3.2"/><circle cx="12" cy="12" r="1.6"/>',
  'dock-export-project': '<path d="M3.5 7.5 10.5 4l7 3.5v7l-7 3.5-7-3.5Z"/><path d="m3.5 7.5 7 3.5 7-3.5M10.5 11v7"/><path d="M15 19.5h6.5M19 17l2.5 2.5L19 22"/>',
  'dock-export': '<path d="M12 3.5v11M7.5 10 12 14.5 16.5 10"/><path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  'dock-build': '<path d="m7.5 8.5-4.5 4 4.5 4M13.5 8.5l4.5 4-4.5 4"/><path d="M19.5 2.5v4.5M17.25 4.75h4.5"/><path d="m11.5 6.5-2 12"/>',
  'zoom': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6M10.5 7.5v6M7.5 10.5h6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>', // Highlights.
  play: '<path d="M7 5v14l12-7Z"/>', // Play the tour.
  pause: '<path d="M8 5v14M16 5v14"/>', // Pause the tour.
  prev: '<path d="m15 6-6 6 6 6"/>', // Previous step.
  next: '<path d="m9 6 6 6-6 6"/>', // Next step.
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>', // Toggle a side panel.
  plus: '<path d="M12 5v14M5 12h14"/>', // Zoom in.
  minus: '<path d="M5 12h14"/>', // Zoom out.
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>', // Fit the diagram.
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', // Enter fullscreen.
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', // Read the latest commit again.
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', // Copy a permalink.
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>', // Export files.
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>', // Theme toggle.
  close: '<path d="M6 6l12 12M18 6 6 18"/>', // Dismiss.
  ask: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M12 8.5a1.5 1.5 0 1 1 1 1.4c-.6.2-1 .6-1 1.1M12 13.5v.01"/>', // Ask Genius.
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
