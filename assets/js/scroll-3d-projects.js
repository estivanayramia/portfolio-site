/* Scroll-Driven 3D Projects Showcase
   Projects page only. CSS 3D transforms + scroll position mapping.
   No WebGL/Three.js.
*/

(function () {
  'use strict';

  // Hard guard: never attach scroll-3d when the Apple Carousel is present on the page.
  // This prevents double-binding and transform conflicts.
  if (document.querySelector('[data-apple-carousel], .apple-carousel')) return;

  const SELECTORS = {
    root: '[data-scroll-3d-projects]',
    stage: '[data-scroll-stage]',
    track: '[data-scroll-track]',
    spacer: '[data-scroll-spacer]',
    hint: '[data-scroll-hint]',
    item: '.scroll-3d-item',
    dot: '[data-progress-dot]',
    progress: '[data-scroll-progress]',
    navPrev: '[data-nav="prev"]',
    navNext: '[data-nav="next"]'
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const lerp = (a, b, t) => a + (b - a) * t;

  const abs = Math.abs;

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

  const applyEdgeDeadzone01 = (p, dz) => {
    const deadzone = Math.max(0, Math.min(0.25, Number(dz) || 0));
    const v = clamp01(p);
    if (!deadzone) return v;
    if (v <= deadzone) return 0;
    if (v >= 1 - deadzone) return 1;
    return (v - deadzone) / (1 - deadzone * 2);
  };

  const invertEdgeDeadzone01 = (p, dz) => {
    const deadzone = Math.max(0, Math.min(0.25, Number(dz) || 0));
    const v = clamp01(p);
    if (!deadzone) return v;
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return deadzone + v * (1 - deadzone * 2);
  };

  function setBodyScrollingFlag() {
    document.body.classList.add('is-scrolling');
    clearTimeout(setBodyScrollingFlag._t);
    setBodyScrollingFlag._t = setTimeout(() => {
      document.body.classList.remove('is-scrolling');
    }, 140);
  }

  function wantsDebug() {
    try {
      return new URLSearchParams(window.location.search).has('scroll3dDebug');
    } catch {
      return false;
    }
  }

  function createFpsOverlay() {
    const el = document.createElement('div');
    el.setAttribute('data-scroll3d-fps', '');
    el.style.position = 'fixed';
    el.style.right = '12px';
    el.style.bottom = '12px';
    el.style.zIndex = '9999';
    el.style.padding = '6px 8px';
    el.style.borderRadius = '10px';
    el.style.font = '12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    el.style.color = '#e1d4c2';
    el.style.background = 'rgba(33, 40, 66, 0.85)';
    el.style.border = '1px solid rgba(225, 212, 194, 0.18)';
    el.style.backdropFilter = 'blur(6px)';
    el.textContent = 'scroll3d: -- fps';
    document.body.appendChild(el);
    return el;
  }

  function createController(root) {
    const stage = root.querySelector(SELECTORS.stage);
    const track = root.querySelector(SELECTORS.track);
    const spacer = root.querySelector(SELECTORS.spacer);
    const hint = root.querySelector(SELECTORS.hint);
    const items = Array.from(root.querySelectorAll(SELECTORS.item));
    const dots = Array.from(root.querySelectorAll(SELECTORS.dot));
    const progressEl = root.querySelector(SELECTORS.progress);
    const navPrev = root.querySelector(SELECTORS.navPrev);
    const navNext = root.querySelector(SELECTORS.navNext);

    if (!stage || !track || !spacer || items.length === 0) return null;

    const reducedMotion = prefersReducedMotion();

    const CONFIG = {
      // Tuned for 60fps: fewer expensive effects.
      radius: 450,
      depth: 360,
      zOffset: -160,
      waveY: 0,
      edgeDeadzone: 0.035,
      centerScale: 1.0,
      sideScale: 0.72,
      centerOpacity: 1.0,
      sideOpacity: 0.50,
      blurPx: 0,
      lerpT: 0.16,
      updateThreshold: 0.0009,
      settleEpsilon: 0.0006,
      cullBackCards: true,
      cullCosThreshold: -0.72,
      snapStepsOnReducedMotion: true,
      mobile: {
        radius: 300,
        depth: 170,
        zOffset: -105,
        waveY: 0,
        edgeDeadzone: 0.05,
        centerScale: 1.0,
        sideScale: 0.82,
        sideOpacity: 0.70,
        blurPx: 0,
        lerpT: 0.22,
        updateThreshold: 0.0018,
        settleEpsilon: 0.0014,
        cullBackCards: false
      }
    };

    let targetProgress = 0;
    let currentProgress = 0;
    let rafId = 0;
    let activeIndex = 0;
    let lastPaintedProgress = -1;
    let bounds = null;
    let fpsEl = null;
    let fpsLastT = 0;
    let fpsAccMs = 0;
    let fpsFrames = 0;

    function getConfig() {
      return isMobile() ? { ...CONFIG, ...CONFIG.mobile } : CONFIG;
    }

    function tuneSpacerHeight() {
      // Make enough scroll distance to land each card in the center.
      const vh = items.length * 85 + 70; // 6 items -> 580vh-ish
      spacer.style.height = `${vh}vh`;
    }

    function updateBounds() {
      const rect = root.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const vh = window.innerHeight || 1;
      const top = rect.top + scrollTop;
      const height = rect.height;

      // Map scroll to 0..1 while the section is in control.
      const start = top - vh * 0.85;
      const end = top + height - vh * 0.15;
      bounds = { start, end };
    }

    function computeProgressFromScrollY() {
      if (!bounds) updateBounds();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const raw = (scrollTop - bounds.start) / (bounds.end - bounds.start || 1);
      return clamp01(raw);
    }

    function progressForIndex(idx) {
      const cfg = getConfig();
      const total = items.length;
      if (total <= 1) return 0;
      const desired = clamp01(idx / (total - 1));
      return invertEdgeDeadzone01(desired, cfg.edgeDeadzone);
    }

    function scrollToProgress(p, behavior) {
      updateBounds();
      const range = bounds.end - bounds.start || 1;
      const y = bounds.start + clamp01(p) * range;

      const wantsSmooth = behavior !== 'auto' && behavior !== 'instant';
      const reduced = prefersReducedMotion();
      const b = reduced ? 'auto' : (wantsSmooth ? 'smooth' : 'auto');

      window.scrollTo({ top: Math.max(0, y), behavior: b });

      // Ensure the transform loop wakes up even if the browser coalesces scroll events.
      targetProgress = clamp01(p);
      if (!rafId) rafId = window.requestAnimationFrame(tick);
    }

    function scrollToIndex(idx, behavior) {
      scrollToProgress(progressForIndex(idx), behavior);
    }

    function stepIndex(delta) {
      const total = items.length;
      const next = Math.max(0, Math.min(total - 1, activeIndex + delta));
      if (next === activeIndex) return;
      scrollToIndex(next, 'smooth');
    }

    function updateUiVisibility() {
      if (!progressEl || !bounds) return;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const inRange = scrollTop >= bounds.start && scrollTop <= bounds.end;

      progressEl.classList.toggle('is-visible', inRange);
      const atStart = activeIndex <= 0;
      const atEnd = activeIndex >= items.length - 1;

      if (navPrev) navPrev.disabled = !inRange || atStart;
      if (navNext) navNext.disabled = !inRange || atEnd;
    }

    function updateDots(idx) {
      if (!dots.length) return;
      dots.forEach((dot, i) => {
        if (String(i) === String(idx)) dot.classList.add('is-active');
        else dot.classList.remove('is-active');
        try {
          dot.setAttribute('aria-current', String(i) === String(idx) ? 'true' : 'false');
        } catch {
          // ignore
        }
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

      const motionProgress = applyEdgeDeadzone01(progress, cfg.edgeDeadzone);

      // Spec: scroll 0% => item 0 centered; scroll 100% => last item centered.
      const baseRotation = motionProgress * (total - 1) * anglePer;

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
      updateUiVisibility();

      for (const info of perItem) {
        const item = items[info.index];

        const aRad = (info.a * Math.PI) / 180;
        const distance01 = clamp01(info.dist / 180);

        const sinA = Math.sin(aRad);
        const cosA = Math.cos(aRad);

        // Optional back-face culling to reduce overdraw.
        const isCulled = cfg.cullBackCards && cosA < cfg.cullCosThreshold;

        const x = sinA * cfg.radius;
        const z = cosA * cfg.depth + cfg.zOffset;
        const y = cfg.waveY ? Math.sin(aRad * 2) * cfg.waveY : 0;

        const scale = lerp(cfg.centerScale, cfg.sideScale, distance01);
        const opacity = lerp(cfg.centerOpacity, cfg.sideOpacity, distance01);
        const blur = 0;

        // Rotate the card so it faces the viewer when centered.
        const rotateY = -info.a;

        if (isCulled) {
          item.style.visibility = 'hidden';
          item.style.pointerEvents = 'none';
          item.style.opacity = '0';
          item.style.zIndex = '0';
          item.style.transform = 'translate(-50%, -50%) translate3d(0px, 0px, -999px) rotateY(0deg) scale(0.7)';
        } else {
          item.style.visibility = 'visible';
          item.style.pointerEvents = '';
          item.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${rotateY.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
          item.style.opacity = opacity.toFixed(3);
          item.style.zIndex = String(Math.round(100 - distance01 * 60));
        }

        item.style.filter = 'none';

        const isCenter = info.index === activeIndex;
        item.setAttribute('data-is-center', isCenter ? 'true' : 'false');
      }

      updateHint(progress);
    }

    function updateFps(now) {
      if (!fpsEl) return;
      if (!fpsLastT) {
        fpsLastT = now;
        return;
      }
      const dt = now - fpsLastT;
      fpsLastT = now;
      fpsAccMs += dt;
      fpsFrames += 1;
      if (fpsAccMs >= 500) {
        const fps = Math.round((fpsFrames * 1000) / fpsAccMs);
        fpsEl.textContent = `scroll3d: ${fps} fps`;
        fpsAccMs = 0;
        fpsFrames = 0;
      }
    }

    function stopRaf() {
      if (!rafId) return;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function tick(now) {
      const cfg = getConfig();

      // Smooth follow unless reduced-motion.
      if (reducedMotion && CONFIG.snapStepsOnReducedMotion) {
        const total = items.length;
        const step = 1 / (total - 1 || 1);
        currentProgress = Math.round(targetProgress / step) * step;
      } else {
        currentProgress = lerp(currentProgress, targetProgress, cfg.lerpT);
      }

      const needsPaint =
        lastPaintedProgress < 0 ||
        abs(currentProgress - lastPaintedProgress) >= cfg.updateThreshold;

      if (needsPaint) {
        applyTransforms(currentProgress);
        lastPaintedProgress = currentProgress;
      }

      updateFps(now);

      const settled = abs(currentProgress - targetProgress) <= cfg.settleEpsilon;
      if (settled && !needsPaint) {
        stopRaf();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function onScroll() {
      targetProgress = computeProgressFromScrollY();
      setBodyScrollingFlag();
      updateUiVisibility();

      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    function onResize() {
      tuneSpacerHeight();
      updateBounds();
      targetProgress = computeProgressFromScrollY();
      currentProgress = targetProgress;
      applyTransforms(currentProgress);
      lastPaintedProgress = currentProgress;
    }

    function onKeyDown(e) {
      // Only when the scroll-3D section is active.
      if (!bounds) return;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const inRange = scrollTop >= bounds.start && scrollTop <= bounds.end;
      if (!inRange) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepIndex(-1);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepIndex(1);
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        scrollToIndex(0, 'smooth');
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        scrollToIndex(items.length - 1, 'smooth');
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        // Snap back to the nearest centered card.
        scrollToIndex(activeIndex, 'smooth');
      }
    }

    function bindInteractions() {
      if (navPrev) {
        navPrev.addEventListener('click', (e) => {
          e.preventDefault();
          if (navPrev.disabled) return;
          stepIndex(-1);
        });
      }

      if (navNext) {
        navNext.addEventListener('click', (e) => {
          e.preventDefault();
          if (navNext.disabled) return;
          stepIndex(1);
        });
      }

      if (dots.length) {
        dots.forEach((dot) => {
          dot.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = Number(dot.getAttribute('data-progress-dot'));
            if (Number.isFinite(idx)) scrollToIndex(idx, 'smooth');
          });
        });
      }

      // Click-to-center on cards. If already centered, allow the inner link.
      items.forEach((item, idx) => {
        item.addEventListener(
          'click',
          (e) => {
            const isCenter = item.getAttribute('data-is-center') === 'true';
            if (isCenter) return;

            // Prevent accidental navigation when clicking the card link.
            const anchor = e.target && e.target.closest ? e.target.closest('a') : null;
            if (anchor) e.preventDefault();

            scrollToIndex(idx, 'smooth');
          },
          true
        );
      });

      document.addEventListener('keydown', onKeyDown);
    }

    function init() {
      tuneSpacerHeight();

      if (wantsDebug()) {
        fpsEl = createFpsOverlay();
      }

      updateBounds();
      targetProgress = computeProgressFromScrollY();
      currentProgress = targetProgress;
      applyTransforms(currentProgress);
      lastPaintedProgress = currentProgress;
      updateUiVisibility();

      bindInteractions();

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });

      // RAF starts lazily on first scroll; avoids burning CPU while idle.
    }

    function destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
      stopRaf();
      items.forEach((item) => {
        item.style.transform = '';
        item.style.opacity = '';
        item.style.filter = '';
        item.style.zIndex = '';
        item.style.visibility = '';
        item.style.pointerEvents = '';
        item.removeAttribute('data-is-center');
      });
      updateDots(0);
      if (hint) hint.classList.remove('is-hidden');

      if (progressEl) progressEl.classList.remove('is-visible');

      if (fpsEl && fpsEl.parentNode) fpsEl.parentNode.removeChild(fpsEl);
      fpsEl = null;
    }

    return { init, destroy };
  }

  function boot() {
    // Conflict guard: if the Apple carousel is present, do not attach the legacy controller.
    if (document.querySelector('[data-apple-carousel]')) return;

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
