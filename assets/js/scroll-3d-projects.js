/* Scroll-Driven 3D Projects Showcase
   Projects page only. CSS 3D transforms + scroll position mapping.
   No WebGL/Three.js.
*/

(function () {
  'use strict';

  const SELECTORS = {
    root: '[data-scroll-3d-projects]',
    stage: '[data-scroll-stage]',
    track: '[data-scroll-track]',
    spacer: '[data-scroll-spacer]',
    hint: '[data-scroll-hint]',
    item: '.scroll-3d-item',
    dot: '[data-progress-dot]'
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const lerp = (a, b, t) => a + (b - a) * t;

  const prefersReducedMotion = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  };

  const isMobile = () => window.innerWidth < 768;

  const normalizeAngleDeg = (deg) => {
    let a = deg % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  };

  function setBodyScrollingFlag() {
    document.body.classList.add('is-scrolling');
    clearTimeout(setBodyScrollingFlag._t);
    setBodyScrollingFlag._t = setTimeout(() => {
      document.body.classList.remove('is-scrolling');
    }, 140);
  }

  function createController(root) {
    const stage = root.querySelector(SELECTORS.stage);
    const track = root.querySelector(SELECTORS.track);
    const spacer = root.querySelector(SELECTORS.spacer);
    const hint = root.querySelector(SELECTORS.hint);
    const items = Array.from(root.querySelectorAll(SELECTORS.item));
    const dots = Array.from(root.querySelectorAll(SELECTORS.dot));

    if (!stage || !track || !spacer || items.length === 0) return null;

    const reducedMotion = prefersReducedMotion();

    const CONFIG = {
      radius: 560,
      depth: 520,
      zOffset: -170,
      waveY: 26,
      centerScale: 1.38,
      sideScale: 0.74,
      centerOpacity: 1.0,
      sideOpacity: 0.32,
      blurPx: 3.0,
      lerpT: 0.12,
      snapStepsOnReducedMotion: true,
      mobile: {
        radius: 320,
        depth: 220,
        zOffset: -110,
        waveY: 12,
        centerScale: 1.16,
        sideScale: 0.90,
        sideOpacity: 0.70,
        blurPx: 0
      }
    };

    let targetProgress = 0;
    let currentProgress = 0;
    let rafId = 0;
    let activeIndex = 0;

    function getConfig() {
      return isMobile() ? { ...CONFIG, ...CONFIG.mobile } : CONFIG;
    }

    function tuneSpacerHeight() {
      // Make enough scroll distance to land each card in the center.
      const vh = items.length * 85 + 70; // 6 items -> 580vh-ish
      spacer.style.height = `${vh}vh`;
    }

    function computeProgress() {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // We want progress=0 when the section starts to "take over".
      const start = rect.top - vh * 0.15;
      // progress=1 when we've scrolled through most of the section.
      const end = rect.bottom - vh * 0.85;
      const raw = (0 - start) / (end - start || 1);
      return clamp01(raw);
    }

    function updateDots(idx) {
      if (!dots.length) return;
      dots.forEach((dot, i) => {
        if (String(i) === String(idx)) dot.classList.add('is-active');
        else dot.classList.remove('is-active');
      });
    }

    function updateHint(p) {
      if (!hint) return;
      if (p > 0.02) hint.classList.add('is-hidden');
      else hint.classList.remove('is-hidden');
    }

    function applyTransforms(progress) {
      const cfg = getConfig();
      const total = items.length;
      const anglePer = 360 / total;

      // Spec: scroll 0% => item 0 centered; scroll 100% => last item centered.
      const baseRotation = progress * (total - 1) * anglePer;

      let bestIdx = 0;
      let bestDist = Infinity;
      const perItem = [];

      for (let i = 0; i < total; i++) {
        const rawAngle = baseRotation - i * anglePer;
        const a = normalizeAngleDeg(rawAngle);
        const dist = Math.abs(a);
        perItem.push({ index: i, a, rawAngle, dist });
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      activeIndex = bestIdx;
      updateDots(activeIndex);

      for (const info of perItem) {
        const item = items[info.index];

        const aRad = (info.a * Math.PI) / 180;
        const distance01 = clamp01(info.dist / 180);

        const x = Math.sin(aRad) * cfg.radius;
        const z = Math.cos(aRad) * cfg.depth + cfg.zOffset;
        const y = Math.sin(aRad * 2) * cfg.waveY;

        const scale = lerp(cfg.centerScale, cfg.sideScale, distance01);
        const opacity = lerp(cfg.centerOpacity, cfg.sideOpacity, distance01);
        const blur = reducedMotion ? 0 : distance01 * cfg.blurPx;

        // Rotate the card so it faces the viewer when centered.
        const rotateY = -info.a;

        item.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        item.style.opacity = opacity.toFixed(3);
        item.style.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : 'none';
        item.style.zIndex = String(Math.round(100 - distance01 * 60));

        const isCenter = info.index === activeIndex;
        item.setAttribute('data-is-center', isCenter ? 'true' : 'false');
      }

      updateHint(progress);
    }

    function tick() {
      // Smooth follow unless reduced-motion.
      if (reducedMotion && CONFIG.snapStepsOnReducedMotion) {
        const total = items.length;
        const step = 1 / (total - 1 || 1);
        currentProgress = Math.round(targetProgress / step) * step;
      } else {
        currentProgress = lerp(currentProgress, targetProgress, CONFIG.lerpT);
      }

      applyTransforms(currentProgress);
      rafId = window.requestAnimationFrame(tick);
    }

    function onScroll() {
      targetProgress = computeProgress();
      setBodyScrollingFlag();
    }

    function onResize() {
      tuneSpacerHeight();
      targetProgress = computeProgress();
      currentProgress = targetProgress;
      applyTransforms(currentProgress);
    }

    function init() {
      tuneSpacerHeight();
      targetProgress = computeProgress();
      currentProgress = targetProgress;
      applyTransforms(currentProgress);

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });

      rafId = window.requestAnimationFrame(tick);
    }

    function destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
      items.forEach((item) => {
        item.style.transform = '';
        item.style.opacity = '';
        item.style.filter = '';
        item.style.zIndex = '';
        item.removeAttribute('data-is-center');
      });
      updateDots(0);
      if (hint) hint.classList.remove('is-hidden');
    }

    return { init, destroy };
  }

  function boot() {
    const root = document.querySelector(SELECTORS.root);
    if (!root) return;

    const controller = createController(root);
    if (!controller) return;

    controller.init();

    // Expose for debugging.
    window.__scroll3dProjects = controller;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
