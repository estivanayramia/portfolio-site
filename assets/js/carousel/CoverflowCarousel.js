/**
 * CoverflowCarousel - Luxury 3D carousel with infinite loop
 * @module CoverflowCarousel
 */

import { clamp, debounce, prefersReducedMotion, safeMatchMedia } from './carousel-utils.js';

const DEFAULTS = {
  visibleCards: 5,
  perspective: 1600,
  rotationSpeed: 320,
  settleEase: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  dragThreshold: 10,
};

/**
 * @typedef {Object} CoverflowOptions
 * @property {number} [visibleCards]
 * @property {number} [perspective]
 * @property {number} [rotationSpeed]
 * @property {string} [settleEase]
 * @property {number} [dragThreshold]
 */

export default class CoverflowCarousel {
  /**
   * @param {HTMLElement} element
   * @param {CoverflowOptions} [options]
   */
  constructor(element, options = {}) {
    /** @type {HTMLElement} */
    this.element = element;
    /** @type {CoverflowOptions & typeof DEFAULTS} */
    this.options = { ...DEFAULTS, ...options };

    /** @type {HTMLElement | null} */
    this.viewport = element.querySelector('.coverflow-viewport');
    /** @type {HTMLElement | null} */
    this.track = element.querySelector('.coverflow-track');
    /** @type {HTMLElement[]} */
    this.originalCards = Array.from(element.querySelectorAll('.coverflow-card'));

    /** @type {HTMLButtonElement | null} */
    this.prevBtn = element.querySelector('.coverflow-btn--prev');
    /** @type {HTMLButtonElement | null} */
    this.nextBtn = element.querySelector('.coverflow-btn--next');
    /** @type {HTMLElement | null} */
    this.statusEl = element.querySelector('[role="status"]');

    this.setSize = this.originalCards.length;
    this.totalCards = this.setSize * 3;

    /** @type {number} */
    this.currentIndex = this.setSize; // start at middle set
    /** @type {number} */
    this.virtualIndex = this.currentIndex;

    /** @type {HTMLElement[]} */
    this.cards = [];

    /** @type {boolean} */
    this.isDragging = false;
    /** @type {number} */
    this.dragStartX = 0;
    /** @type {number} */
    this.dragCurrentX = 0;
    /** @type {number} */
    this.dragStartIndex = this.currentIndex;
    /** @type {number | null} */
    this.pointerId = null;
    /** @type {number | null} */
    this.rafId = null;

    /** @type {number} */
    this.cardWidth = 320;
    /** @type {number} */
    this.stepSize = 280;

    this.onResize = debounce(() => {
      this.measure();
      this.render(0);
    }, 150);

    this.init();
  }

  init() {
    if (!this.viewport || !this.track || this.setSize === 0) return;

    if (!this.element.hasAttribute('tabindex')) this.element.tabIndex = 0;

    this.buildTrack();
    this.measure();
    this.bindEvents();

    this.virtualIndex = this.currentIndex;
    this.render(0);

    this.element.classList.add('coverflow-ready');
  }

  buildTrack() {
    if (!this.track) return;

    this.track.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < this.originalCards.length; j++) {
        const source = this.originalCards[j];
        const clone = /** @type {HTMLElement} */ (source.cloneNode(true));
        const index = i * this.originalCards.length + j;
        clone.dataset.index = String(index);
        this.track.appendChild(clone);
      }
    }

    this.cards = Array.from(this.track.querySelectorAll('.coverflow-card'));
  }

  bindEvents() {
    if (!this.viewport) return;

    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prev());
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.next());

    this.element.addEventListener('keydown', (e) => this.handleKeyboard(e));

    this.viewport.addEventListener('pointerdown', (e) => this.handleDragStart(e));
    this.viewport.addEventListener('pointermove', (e) => this.handleDragMove(e));
    this.viewport.addEventListener('pointerup', (e) => this.handleDragEnd(e));
    this.viewport.addEventListener('pointercancel', (e) => this.handleDragEnd(e));

    this.viewport.addEventListener('click', (e) => this.handleClick(e));

    window.addEventListener('resize', this.onResize);
  }

  measure() {
    if (!this.track) return;

    const first = this.track.querySelector('.coverflow-card');
    if (!first) return;

    const r = first.getBoundingClientRect();
    if (r && Number.isFinite(r.width) && r.width > 0) {
      this.cardWidth = r.width;
      this.stepSize = Math.max(220, Math.min(420, r.width * 0.72));
    }

    if (this.viewport) {
      this.viewport.style.perspective = `${Math.max(600, Number(this.options.perspective) || DEFAULTS.perspective)}px`;
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  handleKeyboard(e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.prev();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      this.goTo(this.setSize, true);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      this.goTo(this.setSize + this.setSize - 1, true);
    }
  }

  /**
   * @param {PointerEvent} e
   */
  handleDragStart(e) {
    if (!this.viewport) return;

    // Left click only for mouse; all contacts for touch/pen.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    this.pointerId = e.pointerId;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragCurrentX = e.clientX;
    this.dragStartIndex = this.currentIndex;
    this.virtualIndex = this.currentIndex;

    try {
      this.viewport.setPointerCapture(e.pointerId);
    } catch {}

    this.viewport.style.cursor = 'grabbing';
    this.render(0);
  }

  /**
   * @param {PointerEvent} e
   */
  handleDragMove(e) {
    if (!this.isDragging) return;
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;

    this.dragCurrentX = e.clientX;
    this.scheduleDragRender();
  }

  scheduleDragRender() {
    if (this.rafId !== null) return;

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      if (!this.isDragging) return;

      const deltaPx = this.dragCurrentX - this.dragStartX;
      const deltaCards = deltaPx / this.stepSize;

      this.virtualIndex = this.dragStartIndex - deltaCards;
      this.render(0, { dragging: true });
    });
  }

  /**
   * @param {PointerEvent} e
   */
  handleDragEnd(e) {
    if (!this.isDragging) return;
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;

    this.isDragging = false;
    this.pointerId = null;

    if (this.viewport) this.viewport.style.cursor = '';

    const deltaPx = this.dragCurrentX - this.dragStartX;
    const thresholdPx = Math.max(Number(this.options.dragThreshold) || 0, this.stepSize * 0.12);

    if (Math.abs(deltaPx) <= thresholdPx) {
      this.goTo(this.dragStartIndex, true);
      return;
    }

    const deltaSteps = Math.round(deltaPx / this.stepSize);
    this.goTo(this.dragStartIndex - deltaSteps, true);
  }

  /**
   * Click non-active card => center it. Click active card link => navigate naturally.
   * @param {MouseEvent} e
   */
  handleClick(e) {
    const target = /** @type {HTMLElement | null} */ (e.target instanceof HTMLElement ? e.target : null);
    if (!target) return;

    const card = target.closest('.coverflow-card');
    if (!card) return;

    const index = Number(card.dataset.index);
    if (!Number.isFinite(index)) return;

    const activeIndex = this.getActiveIndex();
    const isActive = index === activeIndex;

    const clickedLink = target.closest('a');
    if (!isActive) {
      if (clickedLink) e.preventDefault();
      this.goTo(index, true);
      return;
    }
  }

  /**
   * @param {number} offset
   */
  calculatePosition(offset) {
    const sign = offset === 0 ? 0 : offset > 0 ? 1 : -1;
    const abs = Math.abs(offset);

    const center = {
      rotateY: 0,
      translateZ: 110,
      scale: 1.15,
      opacity: 1,
      blur: 0,
      brightness: 1.1,
    };

    const adjacent = {
      rotateY: 70,
      translateZ: -150,
      scale: 0.82,
      opacity: 0.55,
      blur: 1.2,
      brightness: 0.78,
    };

    const far = {
      rotateY: 80,
      translateZ: -300,
      scale: 0.65,
      opacity: 0.32,
      blur: 2,
      brightness: 0.75,
    };

    /**
     * @param {number} a
     * @param {number} b
     * @param {number} t
     */
    const lerp = (a, b, t) => a + (b - a) * t;

    if (abs <= 1) {
      const t = abs;
      return {
        rotateY: sign * lerp(center.rotateY, adjacent.rotateY, t),
        translateZ: lerp(center.translateZ, adjacent.translateZ, t),
        scale: lerp(center.scale, adjacent.scale, t),
        opacity: lerp(center.opacity, adjacent.opacity, t),
        blur: lerp(center.blur, adjacent.blur, t),
        brightness: lerp(center.brightness, adjacent.brightness, t),
        zIndex: Math.round(100 - abs * 45),
      };
    }

    if (abs <= 2) {
      const t = abs - 1;
      return {
        rotateY: sign * lerp(adjacent.rotateY, far.rotateY, t),
        translateZ: lerp(adjacent.translateZ, far.translateZ, t),
        scale: lerp(adjacent.scale, far.scale, t),
        opacity: lerp(adjacent.opacity, far.opacity, t),
        blur: lerp(adjacent.blur, far.blur, t),
        brightness: lerp(adjacent.brightness, far.brightness, t),
        zIndex: Math.round(55 - abs * 20),
      };
    }

    return { opacity: 0, zIndex: 0, blur: 4, brightness: 0.65, scale: 0.6, translateZ: -350, rotateY: sign * 85 };
  }

  /**
   * @param {number} [duration]
   * @param {{dragging?: boolean}} [ctx]
   */
  render(duration = 0, ctx = {}) {
    if (!this.track) return;

    const reduced = prefersReducedMotion();
    const finalDuration = reduced || ctx.dragging ? 0 : Math.max(0, Number(duration) || 0);

    const center = clamp(this.virtualIndex, 0, Math.max(0, this.totalCards - 1));
    const activeIndex = Math.round(center);

    const visibleRadius = Math.max(1, Math.floor((Number(this.options.visibleCards) || DEFAULTS.visibleCards) / 2));
    const ease = String(this.options.settleEase || DEFAULTS.settleEase);

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const offset = i - center;
      const abs = Math.abs(offset);

      const within = abs <= visibleRadius + 0.75;
      if (!within) {
        card.style.opacity = '0';
        card.style.transform = 'translate3d(0,0,0) scale(0.6)';
        card.style.filter = 'blur(4px) brightness(0.65)';
        card.style.zIndex = '0';
        card.style.pointerEvents = 'none';
        card.setAttribute('aria-hidden', 'true');
        this.setFocusable(card, false);
        continue;
      }

      const pos = this.calculatePosition(offset);
      const translateX = offset * this.stepSize;

      const transform = `translate3d(${translateX}px, 0, 0) rotateY(${pos.rotateY || 0}deg) translateZ(${pos.translateZ || 0}px) scale(${pos.scale || 1})`;

      card.style.transform = transform;
      card.style.opacity = String(pos.opacity ?? 1);
      card.style.filter = `blur(${pos.blur || 0}px) brightness(${pos.brightness || 1})`;
      card.style.zIndex = String(pos.zIndex || 0);
      card.style.pointerEvents = 'auto';
      card.style.transition =
        finalDuration > 0
          ? `transform ${finalDuration}ms ${ease}, opacity ${finalDuration}ms ${ease}, filter ${finalDuration}ms ${ease}`
          : 'none';

      const isActive = i === activeIndex;
      card.classList.toggle('coverflow-card--active', isActive);
      card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      this.setFocusable(card, isActive);

      card.style.willChange = ctx.dragging || finalDuration > 0 ? 'transform, opacity, filter' : 'auto';
    }

    this.announce(activeIndex);
  }

  /**
   * @returns {number}
   */
  getActiveIndex() {
    return Math.round(this.virtualIndex);
  }

  /**
   * @param {HTMLElement} root
   * @param {boolean} enabled
   */
  setFocusable(root, enabled) {
    const focusables = root.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]'
    );
    focusables.forEach((el) => {
      const node = /** @type {HTMLElement} */ (el);
      if (enabled) {
        if (node.dataset.coverflowTabindex) {
          node.setAttribute('tabindex', node.dataset.coverflowTabindex);
          delete node.dataset.coverflowTabindex;
        } else if (node.getAttribute('tabindex') === '-1') {
          node.removeAttribute('tabindex');
        }
      } else {
        const cur = node.getAttribute('tabindex');
        if (cur !== null) node.dataset.coverflowTabindex = cur;
        node.setAttribute('tabindex', '-1');
      }
    });
  }

  /**
   * @param {number} activeIndex
   */
  announce(activeIndex) {
    if (!this.statusEl) return;
    if (!this.cards.length) return;

    const card = this.cards[activeIndex];
    const title =
      card?.querySelector('h3')?.textContent?.trim() ||
      card?.querySelector('h2')?.textContent?.trim() ||
      '';

    const actualIndex = ((activeIndex - this.setSize) % this.setSize + this.setSize) % this.setSize;
    this.statusEl.textContent = `Project ${actualIndex + 1} of ${this.setSize}: ${title}`;
  }

  /**
   * @param {number} index
   * @param {boolean} smooth
   */
  goTo(index, smooth = true) {
    const reduced = prefersReducedMotion();
    const target = this.wrapIndex(Math.round(index));
    this.currentIndex = target;
    this.virtualIndex = target;

    this.render(reduced ? 0 : smooth ? this.options.rotationSpeed : 0);

    if (reduced || !smooth) return;
    window.clearTimeout(this._normalizeTimer);
    this._normalizeTimer = window.setTimeout(() => {
      this.normalizeToMiddle();
    }, Math.max(0, Number(this.options.rotationSpeed) || DEFAULTS.rotationSpeed) + 20);
  }

  normalizeToMiddle() {
    const normalized = this.wrapIndex(this.currentIndex);
    if (normalized !== this.currentIndex) {
      this.currentIndex = normalized;
      this.virtualIndex = normalized;
      this.render(0);
    }
  }

  /**
   * @param {number} index
   */
  wrapIndex(index) {
    const setSize = this.setSize;
    const total = this.totalCards;
    if (setSize === 0) return 0;

    let i = index;
    if (i < setSize / 2) i += setSize;
    if (i >= total - setSize / 2) i -= setSize;
    return clamp(i, 0, total - 1);
  }

  next() {
    this.goTo(this.currentIndex + 1, true);
  }

  prev() {
    this.goTo(this.currentIndex - 1, true);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.element.classList.remove('coverflow-ready');
    if (this.viewport) {
      this.viewport.style.cursor = '';
      this.viewport.replaceWith(this.viewport.cloneNode(true));
    }
    this.cards = [];
  }
}

function boot() {
  const carousels = document.querySelectorAll('[data-coverflow-luxury]');
  carousels.forEach((el) => {
    try {
      const element = /** @type {HTMLElement} */ (el);
      // Optional: disable enhancement on very small viewports if user prefers reduced motion.
      if (prefersReducedMotion() && safeMatchMedia('(max-width: 480px)').matches) {
        return;
      }
      new CoverflowCarousel(element);
    } catch (err) {
      console.error('Coverflow init failed:', err);
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
