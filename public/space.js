// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-WORKSPACE-UI-001
// Project: Git Architecture Diagram | Component: the decorative space background for the landing pages.
//
// A purely decorative starfield drawn on a <canvas> behind the interface: small stars of varied size and brightness
// that twinkle and drift slowly, with an occasional shooting star. The coloured nebulae and the faint black-hole ring
// are CSS (public/styles.css). This layer never receives pointer events and never blocks scrolling or interaction.
// It honours prefers-reduced-motion (a still starfield, no loop), pauses while the tab is hidden, and thins the star
// field on small screens. It runs only on the pages that ask for it (home and REP), via setSpaceActive().

const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const prefOff = () => { try { return localStorage.getItem('gad-space-motion') === 'off'; } catch { return false; } };

export function setupSpace() {
  const canvas = document.getElementById('space-stars');
  const ctx = canvas?.getContext?.('2d', { alpha: true });
  if (!canvas || !ctx) return { setActive() {}, setMotion() {} }; // No canvas (or very old engine): the CSS nebula alone stands in.

  let stars = []; let shooting = null; let nextShot = 0; let raf = 0; let active = false; let width = 0; let height = 0;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const still = () => reduceMotion() || prefOff();

  function resize() {
    width = canvas.clientWidth || globalThis.innerWidth; height = canvas.clientHeight || globalThis.innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const density = width < 760 ? 10000 : 7000; // Fewer stars on phones.
    const count = Math.min(240, Math.round((width * height) / density));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      r: Math.random() * 1.3 + 0.2, base: Math.random() * 0.5 + 0.35,
      tw: Math.random() * Math.PI * 2, tws: Math.random() * 0.9 + 0.3, // Twinkle phase and speed.
      vx: (Math.random() - 0.5) * 0.015, vy: (Math.random() - 0.5) * 0.015, // Very slow drift.
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 210 : 265) : 220, // A few cool blue/violet stars among white ones.
      sat: Math.random() < 0.2 ? 60 : 0,
    }));
  }

  function drawStar(s, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = s.sat ? `hsl(${s.hue} ${s.sat}% 85%)` : '#eaf0ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    if (s.r > 1) { ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.35; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2); ctx.fill(); } // A soft halo on the brighter stars.
  }

  function paintStatic() {
    ctx.clearRect(0, 0, width, height);
    for (const s of stars) drawStar(s, s.base);
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);
    for (const s of stars) {
      s.x += s.vx; s.y += s.vy;
      if (s.x < 0) s.x += width; else if (s.x > width) s.x -= width;
      if (s.y < 0) s.y += height; else if (s.y > height) s.y -= height;
      const alpha = s.base + Math.sin(now / 1000 * s.tws + s.tw) * 0.28;
      drawStar(s, alpha);
    }
    // An occasional shooting star, kept to the upper band so it stays clear of the main headings.
    if (!shooting && now > nextShot) { const fromLeft = Math.random() < 0.5;
      shooting = { x: fromLeft ? -40 : width + 40, y: Math.random() * height * 0.38 + 10, vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 3), vy: 2.2 + Math.random() * 1.6, life: 0, len: 80 + Math.random() * 60 }; }
    if (shooting) { const s = shooting; s.x += s.vx; s.y += s.vy; s.life += 1;
      const tx = s.x - s.vx * (s.len / 8); const ty = s.y - s.vy * (s.len / 8);
      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty); grad.addColorStop(0, 'rgba(230,240,255,.9)'); grad.addColorStop(1, 'rgba(230,240,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = grad; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
      if (s.x < -60 || s.x > width + 60 || s.y > height + 60) { shooting = null; nextShot = now + 30000 + Math.random() * 30000; } }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function run() {
    cancelAnimationFrame(raf); raf = 0;
    if (!active) { ctx.clearRect(0, 0, width, height); return; }
    if (still() || document.hidden) { paintStatic(); return; } // Reduced motion / hidden tab: a beautiful still field, no loop.
    nextShot = performance.now() + 8000 + Math.random() * 20000;
    raf = requestAnimationFrame(frame);
  }

  let resizeTimer = 0;
  globalThis.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); run(); }, 180); });
  document.addEventListener('visibilitychange', run);
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', run);
  resize();

  return {
    setActive(on) { if (on === active) return; active = on; document.body.classList.toggle('space-on', on); run(); },
    setMotion(on) { try { localStorage.setItem('gad-space-motion', on ? 'on' : 'off'); } catch {} run(); },
    motionOn() { return !still(); },
  };
}
