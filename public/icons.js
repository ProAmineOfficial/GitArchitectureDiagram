// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-WORKSPACE-UI-001
// Small, consistent vector interface icons; no external images or icon service is required.
const shapes = { // Use only fixed application-owned SVG geometry.
  repo: '<path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2V4Z"/><path d="M5 20a2 2 0 0 0 2 2h12v-4M9 7h6"/>', // Repository identity.
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', // Repository information.
  down: '<path d="m7 10 5 5 5-5"/>', // Menu caret.
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>', // Show a masked value.
  'eye-off': '<path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>', // Hide it again.
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
  'dock-agents': '<rect x="9" y="2.5" width="6" height="4" rx="1.3"/><rect x="2.5" y="10" width="5" height="4" rx="1.2"/><rect x="9.5" y="10" width="5" height="4" rx="1.2"/><rect x="16.5" y="10" width="5" height="4" rx="1.2"/><rect x="9" y="17.5" width="6" height="4" rx="1.3"/><path d="M12 6.5V10M5 14v1.75h14V14M12 14v3.5"/>', // Genius Core coordinating a team of agents.
  warning: '<path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17h.01"/>', // Needs attention.
  loop: '<path d="M17 4.5 20 7.5l-3 3"/><path d="M20 7.5H9a5 5 0 0 0-5 5"/><path d="M7 19.5 4 16.5l3-3"/><path d="M4 16.5h11a5 5 0 0 0 5-5"/>', // Revision loop.
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>', // Verified evidence.
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5M10 20v-5.5h4V20"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.6"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
  projects: '<rect x="3" y="4" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1.5"/>',
  'social-send': '<path d="m21 3.5-18 7.2 6.8 2.4L21 3.5Z"/><path d="m21 3.5-4 16.5-7.2-6.9"/>', // Generic paper plane (messaging).
  'social-music': '<path d="M9 18.5V6l10-2v12"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>', // Generic music note (short videos).
  'social-video': '<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="m10 9.2 5 2.8-5 2.8Z"/>', // Generic video player.
  'social-people': '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.8 14.6c2.3.2 3.9 1.8 4.4 4.4"/>', // Generic community.
  'social-camera': '<rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 6.5 10 4h4l1.5 2.5"/>', // Generic camera (photos).
  'social-code': '<path d="m8 8-4.5 4L8 16M16 8l4.5 4L16 16"/><circle cx="12" cy="12" r="1.3"/>', // Generic code (source hosting).
  'social-x': '<path d="m5 4.5 14 15M19 4.5l-14 15"/>', // A plain letter X.
  'social-briefcase': '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2M3 12.5h18"/>', // Generic professional network.
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
