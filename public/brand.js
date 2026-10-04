// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-BRAND-001
// Project: Git Architecture Diagram | Component: Brand assets and footer behavior | Author: Amine Saoud ibn al-Bashir.
// Official Pro_Amine and Git Architecture Diagram images are served locally from /assets/brand/ (provenance in
// docs/BRAND.md). A missing asset never shows a broken image: its card falls back to a labeled placeholder, and a
// missing product icon falls back to the vector mark. No remote HTML or script from any other site is used.
import { icon } from './icons.js';

export const BRAND_ICON = '/assets/brand/git-architecture-diagram-icon-pro.png'; // The official master, unmodified.
export const ICON_SIZES = [16, 32, 48, 64, 96, 180, 192, 512]; // Padded derivatives in /assets/brand/icons/gad-icon-{size}.png.

/** Show a labeled fallback when an image is missing; remove it when the image loads. */
function settle(image) {
  const figure = image.closest('.brand-media'); if (!figure) return;
  const missing = () => figure.classList.add('missing'); const loaded = () => figure.classList.remove('missing');
  image.addEventListener('error', missing); image.addEventListener('load', loaded);
  if (image.complete && image.currentSrc && !image.naturalWidth) missing();
}

/** The official icon is in the markup (header, footer identity, ecosystem link). If it ever fails, show the vector mark. */
function guardMarks() {
  document.querySelectorAll('img.brand-mark, img.identity-mark, img.nav-mark').forEach(image => {
    const fallback = () => { if (!image.classList.contains('brand-mark')) { image.remove(); return; } const holder = image.parentElement; holder.classList.remove('official'); holder.replaceChildren(icon('network')); };
    image.addEventListener('error', fallback, { once: true }); if (image.complete && image.currentSrc && !image.naturalWidth) fallback();
  });
}

/** Fade the footer cards up once, when they approach the viewport; CSS staggers them (0, 150, 300, 450 ms). */
function reveal() {
  const cards = [...document.querySelectorAll('.site-footer .footer-card, .site-footer .footer-copyright')];
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { cards.forEach(card => card.classList.add('in-view')); return; }
  document.documentElement.classList.add('footer-reveal'); // Cards start hidden only when this script can reveal them.
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { rootMargin: '0px 0px -60px 0px' });
  cards.forEach(card => observer.observe(card));
}

export function setupBrand() {
  document.querySelectorAll('.brand-media img').forEach(settle);
  guardMarks(); reveal();
}
