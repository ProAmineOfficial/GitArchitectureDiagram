// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Search metadata for the public landing pages, shared by the Node
// server and the hosted Worker. Repository deep links are never rewritten and never get a canonical link.
//
// The application is one HTML document. For the three landing pages the server sends route-specific metadata (title,
// description, Open Graph, a self-canonical link) and marks the inactive sections hidden, so the first visible heading
// matches the page before any script runs. The browser script sets the same titles (public/app.js, public/idea.js).

export const SITE = 'https://gitarchitecturediagram.com';

/** One title per page, used by the server here and by the browser script. */
export const PAGE_TITLES = {
  home: 'Git Architecture Diagram — Make Any Product with Genius AI',
  idea: 'Start from an Idea with Genius AI | Git Architecture Diagram',
  browse: 'Browse examples · Git Architecture Diagram',
};

const PAGES = {
  '/': { page: 'home', canonical: '/', description: 'Make any product with Genius AI: develop an engineering plan from an idea, or explore GitHub repositories with interactive architecture diagrams.' },
  '/new': { page: 'idea', canonical: '/new', description: 'Turn a product idea into structured requirements, proposed architecture, Mermaid diagrams, editable engineering files and clearly labeled validation reports.' },
  '/browse': { page: 'browse', canonical: '/browse', description: 'Browse GitHub repository architecture diagram examples, Mermaid visualizations, software hierarchies, mind maps and source-grounded developer insights.' },
  '/examples': { page: 'browse', canonical: '/browse', description: 'Browse GitHub repository architecture diagram examples, Mermaid visualizations, software hierarchies, mind maps and source-grounded developer insights.' }, // An alias of /browse; canonical to it.
};

/** The landing page for a path, or null for repository deep links and everything else. */
export function routeMetadata(pathname) {
  const route = String(pathname || '/').length > 1 ? String(pathname).replace(/\/+$/, '') : '/';
  const entry = PAGES[route.toLowerCase()];
  return entry ? { ...entry, title: PAGE_TITLES[entry.page] } : null;
}

const escapeAttribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Add or remove the `hidden` attribute on the first element whose opening tag matches `pattern`. */
function setHidden(html, pattern, hidden) {
  return html.replace(pattern, tag => {
    const bare = tag.replace(/\s+hidden(?=[\s>])/, '');
    return hidden ? bare.replace(/>$/, ' hidden>') : bare;
  });
}

/** Rewrite the application HTML for a landing page. Other paths are returned unchanged. */
export function withSearchMetadata(html, pathname) {
  const meta = routeMetadata(pathname); if (!meta) return html;
  let page = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(meta.title)}</title>`);
  const replaceMeta = (attribute, key, value) => { page = page.replace(new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`), `$1${escapeAttribute(value)}$2`); };
  replaceMeta('name', 'description', meta.description);
  replaceMeta('property', 'og:title', meta.title);
  replaceMeta('property', 'og:description', meta.description);
  if (!/<link rel="canonical"/.test(page)) page = page.replace('</head>', `  <link rel="canonical" href="${SITE}${meta.canonical}">\n</head>`);
  // Show the right section before scripts run: the home sections for /, the idea workspace for /new, the catalog for /browse.
  page = setHidden(page, /<section\b[^>]*\bid="welcome"[^>]*>/, meta.page !== 'home');
  page = setHidden(page, /<section\b[^>]*\bid="idea-view"[^>]*>/, meta.page !== 'idea');
  page = setHidden(page, /<section\b[^>]*\bid="browse-view"[^>]*>/, meta.page !== 'browse');
  page = setHidden(page, /<section\b[^>]*\bclass="command-bar"[^>]*>/, meta.page === 'idea'); // The idea workspace has its own form.
  return page;
}
