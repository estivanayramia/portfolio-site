/**
 * Apple Carousel (scroll-snap baseline + desktop depth enhancement)
 *
 * Baseline:
 * - Native horizontal scroll + CSS scroll-snap (all devices)
 *
 * Enhancement (desktop only):
 * - Uses Web Animations API (when available) for subtle depth transforms
 * - Buttons/dots/keyboard navigation scroll slides to center
 */

(function () {
  'use strict';

  const SELECTORS = {
    root: '[data-apple-carousel]',
    viewport: '[data-apple-carousel-viewport]',
    track: '[data-apple-carousel-track]',
    slide: '[data-apple-carousel-slide]',
    dots: '[data-apple-carousel-dots]',
    prev: '[data-apple-carousel-prev]',
    next: '[data-apple-carousel-next]'
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const prefersReducedMotion = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  };

  const toMs = (seconds) => Math.max(0, Math.round((Number(seconds) || 0) * 1000));

  const toCubicBezier = (ease) => {
    if (!Array.isArray(ease) || ease.length !== 4) return null;
    const parts = ease.map((n) => Number(n));
    if (parts.some((n) => !Number.isFinite(n))) return null;
    return `cubic-bezier(${parts.join(',')})`;
  };

  const animateTransform = (el, transform, { duration = 0.3, ease = [0.22, 1, 0.36, 1] } = {}) => {
    if (!el) return { stop() {} };

    try {
      if (typeof el.animate !== 'function') {
        el.style.transform = transform;
        return { stop() {} };
      }

      const easing = toCubicBezier(ease) || 'ease';

      const anim = el.animate(
        [{ transform: el.style.transform || 'translateZ(0px) rotateY(0deg) scale(1)' }, { transform }],
        { duration: toMs(duration), easing, fill: 'forwards' }
      );

      try {
        anim.addEventListener(
          'finish',
          () => {
            try {
              el.style.transform = transform;
            } catch {}
          },
          { once: true }
        );
      } catch {}

      return {
        stop() {
          try {
            anim.cancel();
          } catch {}
        }
      };
    } catch {
      try {
        el.style.transform = transform;
      } catch {}
      return { stop() {} };
    }
  };

  const isDesktopEnhanced = () => {
    try {
      return (
        window.matchMedia('(min-width: 1024px)').matches &&
        window.matchMedia('(hover: hover)').matches &&
        window.matchMedia('(pointer: fine)').matches
      );
    } catch {
      return window.innerWidth >= 1024;
    }
  };

  function scrollIntoCenter(el, behavior) {
    try {
      el.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    } catch {
      // Best-effort fallback.
      try {
        const parent = el && el.parentElement;
        if (parent) parent.scrollLeft = el.offsetLeft;
      } catch {}
    }
  }

  class AppleCarousel {
    constructor(root) {
      this.root = root;
      this.viewport = root.querySelector(SELECTORS.viewport) || root;
      this.track = root.querySelector(SELECTORS.track) || this.viewport;
      this.slides = Array.from(root.querySelectorAll(SELECTORS.slide));
      this.dotsEl = root.querySelector(SELECTORS.dots);
      this.prevBtn = root.querySelector(SELECTORS.prev);
      this.nextBtn = root.querySelector(SELECTORS.next);

      this.activeIndex = 0;
      this.reducedMotion = prefersReducedMotion();
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onScroll = this._onScroll.bind(this);

      this._observer = null;
      this._dots = [];
      this._depthAnims = new Map();

      this.init();
    }

    init() {
      if (!this.slides.length) return;

      if (this.root && this.root.dataset) {
        if (this.root.dataset.appleCarouselInit === '1') return;
        this.root.dataset.appleCarouselInit = '1';
      }

      this._buildDots();
      this._bindNav();
      this._bindKeys();
      this._bindObserver();

      try {
        this.viewport.addEventListener('scroll', this._onScroll, { passive: true });
      } catch {
        this.viewport.addEventListener('scroll', this._onScroll);
      }

      try {
        window.addEventListener('resize', this._onResize, { passive: true });
      } catch {
        window.addEventListener('resize', this._onResize);
      }

      this._setActive(0, { applyDepth: true });
    }

    destroy() {
      try {
        this.viewport.removeEventListener('scroll', this._onScroll);
      } catch {}
      try {
        window.removeEventListener('resize', this._onResize);
      } catch {}
      try {
        this.root.removeEventListener('keydown', this._onKeyDown);
      } catch {}
      if (this._observer) {
        try {
          this._observer.disconnect();
        } catch {}
        this._observer = null;
      }
      this._depthAnims.forEach((controls) => {
        try {
          controls.stop();
        } catch {}
      });
      this._depthAnims.clear();
    }

    _buildDots() {
      if (!this.dotsEl) return;
      try {
        this.dotsEl.innerHTML = '';
      } catch {
        while (this.dotsEl.firstChild) this.dotsEl.removeChild(this.dotsEl.firstChild);
      }

      this._dots = this.slides.map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'apple-carousel__dot';
        b.setAttribute('aria-label', `Go to project ${i + 1}`);
        b.addEventListener('click', () => this.goTo(i, { behavior: 'smooth' }));
        this.dotsEl.appendChild(b);
        return b;
      });
    }

    _bindNav() {
      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.goTo(this.activeIndex - 1, { behavior: 'smooth' });
        });
      }
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.goTo(this.activeIndex + 1, { behavior: 'smooth' });
        });
      }
    }

    _bindKeys() {
      if (!this.viewport.hasAttribute('tabindex')) this.viewport.setAttribute('tabindex', '0');
      this.root.addEventListener('keydown', this._onKeyDown);
    }

    _bindObserver() {
      if (!('IntersectionObserver' in window)) return;

      this._observer = new IntersectionObserver(
        (entries) => {
          let best = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
          }
          if (!best) return;

          const idx = this.slides.indexOf(best.target);
          if (idx >= 0 && idx !== this.activeIndex) this._setActive(idx, { applyDepth: true });
        },
        {
          root: this.viewport,
          threshold: [0.5, 0.6, 0.7, 0.8]
        }
      );

      this.slides.forEach((slide) => {
        try {
          this._observer.observe(slide);
        } catch {}
      });
    }

    _onScroll() {
      // Hint/controls can key off "in motion" state if needed.
      // We keep this lightweight to avoid scroll jank.
    }

    _onResize() {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => {
        this._applyDepth();
      }, 120);
    }

    _onKeyDown(e) {
      if (!e) return;

      const key = e.key;
      if (key === 'ArrowLeft') {
        e.preventDefault();
        this.goTo(this.activeIndex - 1, { behavior: 'smooth' });
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        this.goTo(this.activeIndex + 1, { behavior: 'smooth' });
      } else if (key === 'Home') {
        e.preventDefault();
        this.goTo(0, { behavior: 'smooth' });
      } else if (key === 'End') {
        e.preventDefault();
        this.goTo(this.slides.length - 1, { behavior: 'smooth' });
      }
    }

    goTo(index, { behavior } = {}) {
      const i = clamp(Number(index) || 0, 0, this.slides.length - 1);
      const slide = this.slides[i];
      if (!slide) return;

      const reduced = this.reducedMotion;
      const b = reduced ? 'auto' : (behavior || 'smooth');

      scrollIntoCenter(slide, b);
      this._setActive(i, { applyDepth: true });
    }

    _setActive(index, { applyDepth } = {}) {
      this.activeIndex = clamp(Number(index) || 0, 0, this.slides.length - 1);

      this.slides.forEach((s, i) => {
        try {
          s.dataset.appleCarouselActive = i === this.activeIndex ? '1' : '0';
        } catch {}
      });

      if (this._dots.length) {
        this._dots.forEach((d, i) => {
          const on = i === this.activeIndex;
          d.classList.toggle('is-active', on);
          try {
            d.setAttribute('aria-current', on ? 'true' : 'false');
            d.setAttribute('aria-selected', on ? 'true' : 'false');
          } catch {}
        });
      }

      if (this.prevBtn) this.prevBtn.disabled = this.activeIndex <= 0;
      if (this.nextBtn) this.nextBtn.disabled = this.activeIndex >= this.slides.length - 1;

      if (applyDepth) this._applyDepth();
    }

    _applyDepth() {
      // Desktop-only depth enhancement.
      const enhanced = !this.reducedMotion && isDesktopEnhanced();
      this.root.classList.toggle('is-depth', enhanced);

      this.slides.forEach((slide, i) => {
        const delta = i - this.activeIndex;
        const abs = Math.abs(delta);

        const target = enhanced
          ? {
              transform: `translateZ(${Math.max(0, 90 - abs * 55)}px) rotateY(${clamp(delta * -14, -28, 28)}deg) scale(${clamp(1 - abs * 0.06, 0.84, 1)})`
            }
          : {
              transform: 'translateZ(0px) rotateY(0deg) scale(1)'
            };

        // Stop any previous animation on this node.
        const prev = this._depthAnims.get(slide);
        if (prev) {
          try {
            prev.stop();
          } catch {}
        }

        if (this.reducedMotion) {
          try {
            slide.style.transform = target.transform;
          } catch {}
          return;
        }

        const controls = animateTransform(slide, target.transform, {
          duration: enhanced ? 0.45 : 0.2,
          ease: [0.22, 1, 0.36, 1]
        });
        this._depthAnims.set(slide, controls);
      });
    }
  }

  function boot() {
    const roots = Array.from(document.querySelectorAll(SELECTORS.root));
    if (!roots.length) return;

    roots.forEach((root) => {
      try {
        new AppleCarousel(root);
      } catch {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
