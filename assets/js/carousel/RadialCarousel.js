/**
 * RadialCarousel - 3D orbital carousel with progressive enhancement.
 *
 * Baseline (no-JS): horizontal scroll-snap track.
 * Enhanced (desktop): 3D orbit using GPU-friendly transforms only.
 *
 * No external dependencies.
 *
 * @module RadialCarousel
 */

import {
  clamp,
  debounce,
  haptic,
  prefersReducedMotion,
  safeMatchMedia,
  scrollChildIntoCenter,
  supports3D
} from './carousel-utils.js';

/**
 * @typedef {Object} RadialCarouselOptions
 * @property {number} [radius]
 * @property {boolean} [autoRotate]
 * @property {number} [autoRotateMs]
 * @property {number} [rotationSpeed] Transition duration (ms)
 * @property {number} [minItems] Do not enable 3D if fewer items
 * @property {boolean} [enableTouch] Enable drag-to-rotate on desktop
 * @property {boolean} [matchPath] Set initial index by matching link href to location.pathname
 * @property {boolean} [clickToCenter] Click item to rotate it to active
 * @property {boolean} [linkAware] If true, non-active link clicks rotate instead of navigate
 * @property {number} [startIndex] Initial index override
 */

const DEFAULTS = Object.freeze(
  /** @type {Required<RadialCarouselOptions>} */ ({
    radius: 450,
    autoRotate: false,
    autoRotateMs: 4500,
    rotationSpeed: 600,
    minItems: 4,
    enableTouch: true,
    matchPath: false,
    clickToCenter: false,
    linkAware: false,
    startIndex: 0
  })
);

const SELECTORS = Object.freeze({
  viewport: '.carousel-radial__viewport',
  track: '.carousel-radial__track',
  item: '.carousel-radial__item',
  controls: '.carousel-radial__controls',
  status: '.carousel-radial__status',
  prev: '.carousel-radial__btn--prev',
  next: '.carousel-radial__btn--next',
  indicators: '.carousel-radial__indicators'
});

const isDesktopEnvironment = () => {
  return (
    safeMatchMedia('(min-width: 1024px)').matches &&
    safeMatchMedia('(hover: hover)').matches &&
    safeMatchMedia('(pointer: fine)').matches
  );
};

/**
 * @param {HTMLElement} root
 * @param {string} name
 */
function readBool(root, name) {
  const v = root.getAttribute(name);
  if (v === null) return null;
  return v === '' || v === '1' || v === 'true';
}

/**
 * @param {HTMLElement} root
 * @param {string} name
 */
function readNumber(root, name) {
  const v = root.getAttribute(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {HTMLElement} el
 */
function getText(el) {
  try {
    return (el.textContent || '').trim();
  } catch {
    return '';
  }
}

/**
 * @param {HTMLElement} item
 */
function findPrimaryLabel(item) {
  const title =
    item.querySelector('.carousel-radial__title') ||
    item.querySelector('h3') ||
    item.querySelector('h2');
  return title ? getText(title) : '';
}

/**
 * @param {HTMLElement} item
 */
function findFocusable(item) {
  const selector =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return /** @type {HTMLElement | null} */ (item.querySelector(selector));
}

/**
 * @param {HTMLElement} el
 * @param {boolean} inert
 */
function setInert(el, inert) {
  // eslint-disable-next-line no-prototype-builtins
  if ('inert' in el) {
    try {
      // @ts-expect-error - inert is not in TS lib for all versions
      el.inert = inert;
    } catch {}
  }
}

export default class RadialCarousel {
  /**
   * @param {HTMLElement} element Container with [data-carousel-radial]
   * @param {RadialCarouselOptions} [options]
   */
  constructor(element, options = {}) {
    /** @type {HTMLElement} */
    this.element = element;
    /** @type {RadialCarouselOptions & Required<RadialCarouselOptions>} */
    this.options = { ...DEFAULTS, ...options };

    /** @type {HTMLElement | null} */
    this.viewport = element.querySelector(SELECTORS.viewport);
    /** @type {HTMLElement | null} */
    this.track = element.querySelector(SELECTORS.track);
    /** @type {HTMLElement[]} */
    this.items = Array.from(element.querySelectorAll(SELECTORS.item));

    /** @type {HTMLElement | null} */
    this.controls = element.querySelector(SELECTORS.controls);
    /** @type {HTMLElement | null} */
    this.statusEl = element.querySelector(SELECTORS.status);
    /** @type {HTMLButtonElement | null} */
    this.prevBtn = element.querySelector(SELECTORS.prev);
    /** @type {HTMLButtonElement | null} */
    this.nextBtn = element.querySelector(SELECTORS.next);
    /** @type {HTMLElement | null} */
    this.indicators = element.querySelector(SELECTORS.indicators);

    /** @type {HTMLButtonElement[]} */
    this._indicatorButtons = [];

    /** @type {number} */
    this.currentIndex = 0;
    /** @type {boolean} */
    this.isAnimating = false;
    /** @type {boolean} */
    this.isEnhanced3D = false;
    /** @type {number} */
    this._angleStep = 0;

    /** @type {number | null} */
    this._willChangeT = null;
    /** @type {number | null} */
    this._autoRotateT = null;

    /** @type {IntersectionObserver | null} */
    this._observer = null;

    /** @type {IntersectionObserver | null} */
    this._visibilityObserver = null;

    /** @type {() => void} */
    this._onResize = debounce(() => this.refresh(), 150);

    /** @type {(e: KeyboardEvent) => void} */
    this._onKeyDown = (e) => this._handleKeyDown(e);

    /** @type {(e: MouseEvent) => void} */
    this._onClick = (e) => this._handleClick(e);

    /** @type {(e: PointerEvent) => void} */
    this._onPointerDown = (e) => this._handlePointerDown(e);

    if (!this.viewport || !this.track || !this.items.length) return;

    // Prevent double init
    if (this.element.getAttribute('data-carousel-init') === '1') return;

    this._readOptionsFromDataset();
    this._angleStep = (Math.PI * 2) / this.items.length;

    // Base wiring (works even if we never enable 3D)
    this._buildIndicators();
    this._showControls();
    this._bindEvents();

    // Initial index selection
    this.currentIndex = this._resolveStartIndex();
    this._setActiveState({ announce: true, apply3D: false });

    // Enhance if eligible
    this.isEnhanced3D = this._canEnhance3D();
    if (this.isEnhanced3D) {
      this.element.classList.add('carousel-radial--enhanced');
      this._apply3D({ animate: false });
    }

    this.element.setAttribute('data-carousel-init', '1');
    this.element.classList.add('carousel-radial--ready');

    // Auto-rotate (optional)
    if (this.options.autoRotate) {
      this._setupVisibilityObserver();
    }

    try {
      window.addEventListener('resize', this._onResize, { passive: true });
    } catch {
      window.addEventListener('resize', this._onResize);
    }
  }

  _readOptionsFromDataset() {
    const r = readNumber(this.element, 'data-carousel-radius');
    if (r !== null) this.options.radius = r;

    const speed = readNumber(this.element, 'data-carousel-rotation-speed');
    if (speed !== null) this.options.rotationSpeed = speed;

    const minItems = readNumber(this.element, 'data-carousel-min-items');
    if (minItems !== null) this.options.minItems = minItems;

    const autoRotate = readBool(this.element, 'data-carousel-autorotate');
    if (autoRotate !== null) this.options.autoRotate = autoRotate;

    const autoRotateMs = readNumber(this.element, 'data-carousel-autorotate-ms');
    if (autoRotateMs !== null) this.options.autoRotateMs = autoRotateMs;

    const enableTouch = readBool(this.element, 'data-carousel-enable-touch');
    if (enableTouch !== null) this.options.enableTouch = enableTouch;

    const matchPath = readBool(this.element, 'data-carousel-match-path');
    if (matchPath !== null) this.options.matchPath = matchPath;

    const clickToCenter = readBool(this.element, 'data-carousel-click-to-center');
    if (clickToCenter !== null) this.options.clickToCenter = clickToCenter;

    const linkAware = readBool(this.element, 'data-carousel-link-aware');
    if (linkAware !== null) this.options.linkAware = linkAware;

    const startIndex = readNumber(this.element, 'data-carousel-start-index');
    if (startIndex !== null) this.options.startIndex = startIndex;
  }

  _resolveStartIndex() {
    const max = this.items.length - 1;
    const explicit = clamp(this.options.startIndex, 0, max);
    if (!this.options.matchPath) return explicit;

    try {
      const current = new URL(window.location.href);
      const path = current.pathname.replace(/\/+$/, '');
      const items = this.items;
      for (let i = 0; i < items.length; i++) {
        const a = items[i].querySelector('a[href]');
        if (!a) continue;
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('/')) continue;
        const hrefPath = href.replace(/\/+$/, '');
        if (hrefPath === path) return i;
      }
    } catch {}

    return explicit;
  }

  _canEnhance3D() {
    if (prefersReducedMotion()) return false;
    if (!supports3D()) return false;
    if (!isDesktopEnvironment()) return false;
    return this.items.length >= this.options.minItems;
  }

  _showControls() {
    if (!this.controls) return;
    try {
      this.controls.style.display = 'flex';
    } catch {}
  }

  _buildIndicators() {
    if (!this.indicators) return;

    // Clear any existing
    try {
      this.indicators.innerHTML = '';
    } catch {
      while (this.indicators.firstChild) this.indicators.removeChild(this.indicators.firstChild);
    }

    this._indicatorButtons = this.items.map((_, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', `Go to item ${idx + 1}`);
      btn.className = 'carousel-radial__indicator';

      btn.addEventListener('click', () => {
        this.goTo(idx, { behavior: 'smooth', focus: false });
      });

      this.indicators.appendChild(btn);
      return btn;
    });

    this._syncIndicators();
  }

  _syncIndicators() {
    if (!this._indicatorButtons.length) return;

    this._indicatorButtons.forEach((btn, idx) => {
      const on = idx === this.currentIndex;
      btn.classList.toggle('is-active', on);
      try {
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      } catch {}
    });
  }

  _bindEvents() {
    // Controls
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.prev({ behavior: 'smooth' });
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.next({ behavior: 'smooth' });
      });
    }

    // Keyboard
    this.element.addEventListener('keydown', this._onKeyDown);

    // Click-to-center / link-aware (optional)
    if (this.options.clickToCenter || this.options.linkAware) {
      this.element.addEventListener('click', this._onClick);
    }

    // Touch/drag (desktop enhancement)
    if (this.options.enableTouch) {
      this.viewport.addEventListener('pointerdown', this._onPointerDown);
    }

    // Scroll observer (for baseline mode)
    this._setupScrollObserver();
  }

  _setupScrollObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (!this.track) return;

    // If we later enable 3D, we'll still keep this observer. We guard in callback.
    try {
      this._observer = new IntersectionObserver(
        (entries) => {
          if (this.isEnhanced3D) return;

          let best = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
          }

          if (!best) return;
          const idx = this.items.indexOf(/** @type {HTMLElement} */ (best.target));
          if (idx < 0 || idx === this.currentIndex) return;

          this.currentIndex = idx;
          this._setActiveState({ announce: true, apply3D: false });
        },
        { root: this.track, threshold: [0.5, 0.6, 0.7, 0.8] }
      );

      this.items.forEach((item) => {
        try {
          this._observer && this._observer.observe(item);
        } catch {}
      });
    } catch {
      this._observer = null;
    }
  }

  _setupVisibilityObserver() {
    if (!('IntersectionObserver' in window)) {
      this.startAutoRotate();
      return;
    }

    try {
      this._visibilityObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries && entries[0];
          if (!entry) return;
          if (entry.isIntersecting) this.startAutoRotate();
          else this.stopAutoRotate();
        },
        { threshold: 0.5 }
      );
      this._visibilityObserver.observe(this.element);
    } catch {
      this._visibilityObserver = null;
      this.startAutoRotate();
    }
  }

  _handleKeyDown(e) {
    if (!e) return;

    const target = /** @type {HTMLElement | null} */ (e.target instanceof HTMLElement ? e.target : null);
    if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;

    const key = e.key;
    if (key === 'ArrowLeft') {
      e.preventDefault();
      this.prev({ behavior: 'smooth', focus: true });
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      this.next({ behavior: 'smooth', focus: true });
      return;
    }
    if (key === 'Home') {
      e.preventDefault();
      this.goTo(0, { behavior: 'smooth', focus: true });
      return;
    }
    if (key === 'End') {
      e.preventDefault();
      this.goTo(this.items.length - 1, { behavior: 'smooth', focus: true });
    }
  }

  _handleClick(e) {
    const item = /** @type {HTMLElement | null} */ (
      e.target instanceof Element ? e.target.closest(SELECTORS.item) : null
    );
    if (!item) return;

    const idx = this.items.indexOf(item);
    if (idx < 0) return;

    const isActive = idx === this.currentIndex;
    const clickedLink = e.target instanceof Element ? e.target.closest('a[href]') : null;

    if (this.options.linkAware && clickedLink && !isActive) {
      // Link-aware behavior: rotate to the clicked item instead of navigating.
      e.preventDefault();
      this.goTo(idx, { behavior: 'smooth', focus: false });
      return;
    }

    if (this.options.clickToCenter && !isActive) {
      // Rotate without preventing other clicks unless it is a link in linkAware mode.
      this.goTo(idx, { behavior: 'smooth', focus: false });
    }
  }

  _handlePointerDown(e) {
    if (!e || e.button !== 0) return;
    if (!this.isEnhanced3D) return;

    // Prevent text selection / scroll interference on desktop.
    try {
      e.preventDefault();
    } catch {}

    const startX = e.clientX;
    let moved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      if (moved) return;
      if (Math.abs(dx) < 42) return;
      moved = true;
      if (dx > 0) this.prev({ behavior: 'smooth' });
      else this.next({ behavior: 'smooth' });
      cleanup();
    };

    const onUp = () => cleanup();

    const cleanup = () => {
      try {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      } catch {}
    };

    try {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onUp, { passive: true });
    } catch {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  }

  /**
   * Re-measure and re-apply transforms if enhanced.
   */
  refresh() {
    const shouldEnhance = this._canEnhance3D();
    if (shouldEnhance && !this.isEnhanced3D) {
      this.isEnhanced3D = true;
      this.element.classList.add('carousel-radial--enhanced');
      this._apply3D({ animate: false });
      return;
    }

    if (!shouldEnhance && this.isEnhanced3D) {
      // Drop back to scroll-snap mode
      this.isEnhanced3D = false;
      this.element.classList.remove('carousel-radial--enhanced');
      this._clear3DStyles();
      this._setActiveState({ announce: false, apply3D: false });
      return;
    }

    if (this.isEnhanced3D) this._apply3D({ animate: false });
  }

  _clear3DStyles() {
    this.items.forEach((item) => {
      try {
        item.style.transform = '';
        item.style.transition = '';
        item.style.willChange = '';
        item.style.filter = '';
        item.style.opacity = '';
      } catch {}
      try {
        item.removeAttribute('aria-hidden');
        item.removeAttribute('tabindex');
      } catch {}
      setInert(item, false);
      item.classList.remove('carousel-radial__item--active');
    });

    if (this.viewport) {
      try {
        this.viewport.style.height = '';
      } catch {}
    }
  }

  /**
   * @param {{ animate: boolean }} opts
   */
  _apply3D({ animate }) {
    if (!this.viewport) return;
    if (!this.track) return;

    const duration = prefersReducedMotion() ? 0 : (animate ? this.options.rotationSpeed : 0);
    const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';

    // Height stabilization: match the tallest item.
    try {
      const maxH = Math.max(
        0,
        ...this.items.map((it) => {
          try {
            return Math.ceil(it.getBoundingClientRect().height);
          } catch {
            return 0;
          }
        })
      );
      if (maxH) this.viewport.style.height = `${maxH}px`;
    } catch {}

    this.items.forEach((item, idx) => {
      const rel = (idx - this.currentIndex) * this._angleStep;
      const x = Math.sin(rel) * this.options.radius;
      const z = Math.cos(rel) * this.options.radius;
      const rotY = (-rel * 180) / Math.PI;

      const transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, 0px, ${z.toFixed(
        2
      )}px) rotateY(${rotY.toFixed(2)}deg)`;

      try {
        if (duration > 0) {
          item.style.transition = `transform ${duration}ms ${ease}, opacity ${duration}ms ease, filter ${duration}ms ease`;
          item.style.willChange = 'transform, opacity, filter';
        } else {
          item.style.transition = 'none';
        }
        item.style.transform = transform;
      } catch {}

      const active = idx === this.currentIndex;
      item.classList.toggle('carousel-radial__item--active', active);

      // Accessibility: in 3D mode, treat only the active item as interactive.
      try {
        item.setAttribute('aria-hidden', active ? 'false' : 'true');
        item.tabIndex = active ? 0 : -1;
      } catch {}
      setInert(item, !active);
    });

    this._setActiveState({ announce: true, apply3D: false });

    if (this._willChangeT) window.clearTimeout(this._willChangeT);
    if (duration > 0) {
      this._willChangeT = window.setTimeout(() => {
        this.items.forEach((it) => {
          try {
            it.style.willChange = '';
          } catch {}
        });
        this._willChangeT = null;
      }, duration + 40);
    }
  }

  /**
   * @param {{ announce: boolean, apply3D: boolean }} opts
   */
  _setActiveState({ announce, apply3D }) {
    // Non-3D mode: keep all items interactive.
    if (!this.isEnhanced3D) {
      this.items.forEach((it, idx) => {
        it.classList.toggle('carousel-radial__item--active', idx === this.currentIndex);
        setInert(it, false);
        try {
          it.removeAttribute('aria-hidden');
          it.removeAttribute('tabindex');
        } catch {}
      });
    }

    this._syncIndicators();
    if (announce) this._announce();

    if (apply3D && this.isEnhanced3D) this._apply3D({ animate: true });
  }

  _announce() {
    if (!this.statusEl) return;
    const active = this.items[this.currentIndex];
    const label = active ? findPrimaryLabel(active) : '';
    const text = label
      ? `Item ${this.currentIndex + 1} of ${this.items.length}: ${label}`
      : `Item ${this.currentIndex + 1} of ${this.items.length}`;
    try {
      this.statusEl.textContent = text;
    } catch {}
  }

  /**
   * @param {number} index
   * @param {{ behavior?: "auto" | "smooth", focus?: boolean }} [opts]
   */
  goTo(index, opts = {}) {
    const next = clamp(index, 0, this.items.length - 1);
    const behavior = opts.behavior || 'auto';
    const focus = !!opts.focus;

    if (next === this.currentIndex) {
      if (focus) {
        const item = this.items[this.currentIndex];
        const focusTarget = findFocusable(item) || item;
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {}
      }
      return;
    }

    this.currentIndex = next;

    if (this.isEnhanced3D) {
      this._apply3D({ animate: true });
    } else if (this.track) {
      // Scroll-snap baseline mode: center active item.
      const item = this.items[this.currentIndex];
      scrollChildIntoCenter(this.track, item, behavior);
      this._setActiveState({ announce: true, apply3D: false });
    }

    if (focus) {
      const item = this.items[this.currentIndex];
      const focusTarget = findFocusable(item) || item;
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {}
    }

    // Emit event
    try {
      this.element.dispatchEvent(
        new CustomEvent('carouselrotate', {
          detail: { index: this.currentIndex, item: this.items[this.currentIndex] }
        })
      );
    } catch {}
  }

  /**
   * @param {{ behavior?: "auto" | "smooth", focus?: boolean }} [opts]
   */
  next(opts = {}) {
    haptic(10);
    const nextIndex = (this.currentIndex + 1) % this.items.length;
    this.goTo(nextIndex, opts);
  }

  /**
   * @param {{ behavior?: "auto" | "smooth", focus?: boolean }} [opts]
   */
  prev(opts = {}) {
    haptic(10);
    const prevIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
    this.goTo(prevIndex, opts);
  }

  startAutoRotate() {
    if (!this.options.autoRotate) return;
    if (this._autoRotateT) return;

    const tick = () => {
      this._autoRotateT = window.setTimeout(() => {
        this._autoRotateT = null;
        this.next({ behavior: 'smooth' });
        tick();
      }, Math.max(1200, Number(this.options.autoRotateMs) || 0));
    };
    tick();
  }

  stopAutoRotate() {
    if (!this._autoRotateT) return;
    window.clearTimeout(this._autoRotateT);
    this._autoRotateT = null;
  }

  destroy() {
    try {
      window.removeEventListener('resize', this._onResize);
    } catch {}

    try {
      this.element.removeEventListener('keydown', this._onKeyDown);
      this.element.removeEventListener('click', this._onClick);
    } catch {}

    try {
      this.viewport && this.viewport.removeEventListener('pointerdown', this._onPointerDown);
    } catch {}

    try {
      this._observer && this._observer.disconnect();
    } catch {}
    this._observer = null;

    try {
      this._visibilityObserver && this._visibilityObserver.disconnect();
    } catch {}
    this._visibilityObserver = null;

    this.stopAutoRotate();
    this._clear3DStyles();

    try {
      this.element.classList.remove('carousel-radial--enhanced', 'carousel-radial--ready');
      this.element.removeAttribute('data-carousel-init');
    } catch {}
  }
}

function boot() {
  const roots = Array.from(document.querySelectorAll('[data-carousel-radial]'));
  if (!roots.length) return;
  roots.forEach((el) => {
    try {
      new RadialCarousel(/** @type {HTMLElement} */ (el));
    } catch {}
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

