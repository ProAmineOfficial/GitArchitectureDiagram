// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-BRAND-001
// Project: Git Architecture Diagram | Component: Brand assets and footer behavior | Author: Amine Saoud ibn al-Bashir.
// Official Pro_Amine and Git Architecture Diagram images are served locally from /assets/brand/ (provenance in
// docs/BRAND.md). A missing asset never shows a broken image: its card falls back to a labeled placeholder, and the
// favicon and header mark switch to the official icon only after it has actually loaded. No remote HTML or script
// from any other site is used.

export const BRAND_ICON = '/assets/brand/git-architecture-diagram-icon.png';

/** Show a labeled fallback when an image is missing; remove it when the image loads. */
function settle(image) {
  const figure = image.closest('.brand-media'); if (!figure) return;
  const missing = () => figure.classList.add('missing'); const loaded = () => figure.classList.remove('missing');
  image.addEventListener('error', missing); image.addEventListener('load', loaded);
  if (image.complete && image.currentSrc && !image.naturalWidth) missing();
}

/** Use the official icon for the favicon, touch icon, and header once it loads. */
function useOfficialIcon() {
  const probe = new Image(); probe.decoding = 'async';
  probe.addEventListener('load', () => {
    document.querySelectorAll('link[rel="icon"]').forEach(link => { link.href = BRAND_ICON; link.type = 'image/png'; link.sizes = 'any'; });
    document.querySelectorAll('.brand-icon').forEach(mark => { const image = document.createElement('img'); image.src = BRAND_ICON; image.alt = ''; image.width = 34; image.height = 34; image.className = 'brand-mark'; mark.replaceChildren(image); mark.classList.add('official'); });
  }, { once: true });
  probe.src = BRAND_ICON;
}

/** Fade the footer cards in once, when they approach the viewport. */
function reveal() {
  const cards = [...document.querySelectorAll('.site-footer .footer-card, .site-footer .footer-copyright')];
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { cards.forEach(card => card.classList.add('in-view')); return; }
  document.documentElement.classList.add('footer-reveal'); // Cards start hidden only when this script can reveal them.
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { rootMargin: '0px 0px 120px 0px' });
  cards.forEach(card => observer.observe(card));
}

export function setupBrand() {
  document.querySelectorAll('.brand-media img').forEach(settle);
  useOfficialIcon(); reveal();
}
