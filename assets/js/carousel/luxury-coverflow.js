/**
 * Luxury Coverflow Carousel
 *
 * Design notes:
 * - Transform and opacity are the primary animation paths to stay compositor-friendly.
 * - Capability tiers follow progressive enhancement so weaker devices get a lighter but still intentional experience.
 * - Roulette uses an in-UI dialog instead of blocking browser dialogs for accessibility and deterministic focus flow.
 */

import { gsap } from 'gsap';
import { Coverflow3DEngine } from './coverflow-3d-engine.js';
import { CoverflowPhysics } from './coverflow-physics.js';
import { RouletteWheelEngine } from './roulette-wheel-engine.js';

const PERF_PROFILE_GLOBAL_KEY = '__EA_LUXURY_COVERFLOW_PROFILE__';
let liveRegionCounter = 0;
const ROOT_TIER_CLASSES = [
  'cf-tier-premium',
  'cf-tier-enhanced',
  'cf-tier-baseline',
  'cf-tier-reduced'
];

const MOTION_PROFILES = {
  premium: {
    tierClass: 'premium',
    slideMs: 380,
    settleMs: 200,
    introMs: 240,
    spinMs: 4400,
    dialogMs: 260,
    scrollSensitivity: 0.0038,
    scrollThreshold: 28,
    dragPixelsPerSlide: 240,
    staggerDelay: 0.016,
    reflectionOpacity: 0.22,
    glowStrength: 1,
    rouletteMode: 'premium',
    enableSmoothTracking: true,
    blurStrength: 1
  },
  enhanced: {
    tierClass: 'enhanced',
    slideMs: 360,
    settleMs: 180,
    introMs: 200,
    spinMs: 3900,
    dialogMs: 240,
    scrollSensitivity: 0.0034,
    scrollThreshold: 32,
    dragPixelsPerSlide: 245,
    staggerDelay: 0.012,
    reflectionOpacity: 0.16,
    glowStrength: 0.82,
    rouletteMode: 'full',
    enableSmoothTracking: true,
    blurStrength: 0.65
  },
  baseline: {
    tierClass: 'baseline',
    slideMs: 320,
    settleMs: 160,
    introMs: 160,
    spinMs: 2900,
    dialogMs: 200,
    scrollSensitivity: 0.0028,
    scrollThreshold: 28,
    dragPixelsPerSlide: 228,
    staggerDelay: 0.004,
    reflectionOpacity: 0,
    glowStrength: 0.3,
    rouletteMode: 'lite',
    enableSmoothTracking: false,
    blurStrength: 0.2
  },
  reduced: {
    tierClass: 'reduced',
    slideMs: 180,
    settleMs: 120,
    introMs: 140,
    spinMs: 1200,
    dialogMs: 140,
    scrollSensitivity: 0.0024,
    scrollThreshold: 24,
    dragPixelsPerSlide: 210,
    staggerDelay: 0,
    reflectionOpacity: 0,
    glowStrength: 0,
    rouletteMode: 'minimal',
    enableSmoothTracking: false,
    blurStrength: 0
  }
};

const CANONICAL_PREMIUM_POSITIONS = {
  center: {
    rotateY: 0,
    rotateX: 0,
    translateZ: 0,
    translateX: 0,
    translateY: -4,
    scale: 1.24,
    opacity: 1,
    zIndex: 100,
    blur: 0,
    brightness: 1.12,
    saturate: 1.08
  },
  adjacent1: {
    rotateY: 54,
    rotateX: 1.4,
    translateZ: -340,
    translateX: 430,
    translateY: 4,
    scale: 0.82,
    opacity: 0.84,
    zIndex: 90,
    blur: 0.5,
    brightness: 0.9,
    saturate: 0.96
  },
  adjacent2: {
    rotateY: 66,
    rotateX: 2.2,
    translateZ: -640,
    translateX: 700,
    translateY: 12,
    scale: 0.66,
    opacity: 0.62,
    zIndex: 80,
    blur: 1.2,
    brightness: 0.78,
    saturate: 0.9
  },
  adjacent3: {
    rotateY: 72,
    rotateX: 3,
    translateZ: -880,
    translateX: 920,
    translateY: 20,
    scale: 0.52,
    opacity: 0.4,
    zIndex: 70,
    blur: 2,
    brightness: 0.64,
    saturate: 0.84
  },
  far: {
    rotateY: 78,
    rotateX: 3.4,
    translateZ: -1120,
    translateX: 1080,
    translateY: 28,
    scale: 0.4,
    opacity: 0.12,
    zIndex: 60,
    blur: 2.8,
    brightness: 0.5,
    saturate: 0.8
  }
};

const GALLERY_STANDARD_POSITIONS = {
  center: {
    rotateY: 0,
    rotateX: 0,
    translateZ: 46,
    translateX: 0,
    translateY: 0,
    scale: 1.01,
    opacity: 1,
    zIndex: 100,
    blur: 0,
    brightness: 1.08,
    saturate: 1.04
  },
  adjacent1: {
    rotateY: 22,
    rotateX: 0,
    translateZ: -120,
    translateX: 188,
    translateY: 0,
    scale: 0.82,
    opacity: 0.84,
    zIndex: 90,
    blur: 0.35,
    brightness: 0.93,
    saturate: 0.98
  },
  adjacent2: {
    rotateY: 34,
    rotateX: 0,
    translateZ: -280,
    translateX: 300,
    translateY: 0,
    scale: 0.66,
    opacity: 0.62,
    zIndex: 80,
    blur: 0.9,
    brightness: 0.82,
    saturate: 0.92
  },
  adjacent3: {
    rotateY: 44,
    rotateX: 0,
    translateZ: -420,
    translateX: 390,
    translateY: 0,
    scale: 0.52,
    opacity: 0.4,
    zIndex: 70,
    blur: 1.5,
    brightness: 0.68,
    saturate: 0.86
  },
  far: {
    rotateY: 50,
    rotateX: 0,
    translateZ: -560,
    translateX: 660,
    translateY: 0,
    scale: 0.4,
    opacity: 0.16,
    zIndex: 60,
    blur: 2.1,
    brightness: 0.56,
    saturate: 0.82
  }
};

const MOBILE_POSITIONS = {
  center: {
    rotateY: 0,
    rotateX: 0,
    translateZ: 0,
    translateX: 0,
    translateY: -4,
    scale: 1.2,
    opacity: 1,
    zIndex: 100,
    blur: 0,
    brightness: 1.12,
    saturate: 1.08
  },
  adjacent1: {
    rotateY: 48,
    rotateX: 1.4,
    translateZ: -280,
    translateX: 280,
    translateY: 4,
    scale: 0.82,
    opacity: 0.84,
    zIndex: 90,
    blur: 0.5,
    brightness: 0.9,
    saturate: 0.96
  },
  adjacent2: {
    rotateY: 60,
    rotateX: 2.2,
    translateZ: -520,
    translateX: 470,
    translateY: 12,
    scale: 0.64,
    opacity: 0.62,
    zIndex: 80,
    blur: 1.2,
    brightness: 0.78,
    saturate: 0.9
  },
  adjacent3: {
    rotateY: 68,
    rotateX: 3,
    translateZ: -760,
    translateX: 650,
    translateY: 20,
    scale: 0.5,
    opacity: 0.4,
    zIndex: 70,
    blur: 2,
    brightness: 0.64,
    saturate: 0.84
  },
  far: {
    rotateY: 74,
    rotateX: 3.4,
    translateZ: -940,
    translateX: 760,
    translateY: 28,
    scale: 0.4,
    opacity: 0.12,
    zIndex: 60,
    blur: 2.8,
    brightness: 0.5,
    saturate: 0.8
  }
};

function buildCanonicalPositions(centerScale, centerTranslateY) {
  if (!Number.isFinite(centerScale) && !Number.isFinite(centerTranslateY)) {
    return CANONICAL_PREMIUM_POSITIONS;
  }

  const resolvedScale = Number.isFinite(centerScale)
    ? centerScale
    : CANONICAL_PREMIUM_POSITIONS.center.scale;
  const resolvedTranslateY = Number.isFinite(centerTranslateY)
    ? centerTranslateY
    : CANONICAL_PREMIUM_POSITIONS.center.translateY;

  return {
    ...CANONICAL_PREMIUM_POSITIONS,
    center: {
      ...CANONICAL_PREMIUM_POSITIONS.center,
      scale: resolvedScale,
      translateY: resolvedTranslateY
    }
  };
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildAboutNoHeaderBalancedPositions(centerScale, centerTranslateY, viewportWidth) {
  const base = buildCanonicalPositions(centerScale, centerTranslateY);
  const widthFactor = clamp((viewportWidth - 360) / 900, 0, 1);
  const wideScreenFactor = clamp((viewportWidth - 1600) / 420, 0, 1);
  const spreadFactor = 0.45 + (0.55 * widthFactor);
  const depthFactor = 0.6 + (0.4 * widthFactor);
  const angleFactor = 0.76 + (0.24 * widthFactor);
  const compactScaleBoost = (1 - widthFactor) * 0.06;
  const wideScaleBoost = 0.02 * wideScreenFactor;
  const wideRotateFactor = 1 - (0.08 * wideScreenFactor);
  const wideSpreadFactor = 1 - (0.06 * wideScreenFactor);
  const wideDepthFactor = 1 - (0.1 * wideScreenFactor);

  const tune = (position, options) => {
    const {
      baseScale,
      scaleWeight = 1,
      wideScaleWeight = 1,
      opacity = position.opacity,
      rotateFactor = 1,
      spreadFactorWeight = 1,
      depthFactorWeight = 1
    } = options;

    return {
      ...position,
      scale: roundTo(baseScale + compactScaleBoost * scaleWeight + wideScaleBoost * wideScaleWeight, 4),
      opacity,
      rotateY: roundTo(position.rotateY * rotateFactor * angleFactor * wideRotateFactor, 2),
      translateX: roundTo(position.translateX * spreadFactorWeight * spreadFactor * wideSpreadFactor, 2),
      translateZ: roundTo(position.translateZ * depthFactorWeight * depthFactor * wideDepthFactor, 2)
    };
  };

  return {
    ...base,
    adjacent1: tune(base.adjacent1, {
      baseScale: 0.94,
      scaleWeight: 1,
      wideScaleWeight: 1,
      opacity: 0.9,
      rotateFactor: 0.88,
      spreadFactorWeight: 0.92,
      depthFactorWeight: 0.88
    }),
    adjacent2: tune(base.adjacent2, {
      baseScale: 0.78,
      scaleWeight: 0.82,
      wideScaleWeight: 0.72,
      opacity: 0.68,
      rotateFactor: 0.88,
      spreadFactorWeight: 0.88,
      depthFactorWeight: 0.82
    }),
    adjacent3: tune(base.adjacent3, {
      baseScale: 0.64,
      scaleWeight: 0.66,
      wideScaleWeight: 0.54,
      opacity: 0.45,
      rotateFactor: 0.88,
      spreadFactorWeight: 0.86,
      depthFactorWeight: 0.79
    }),
    far: tune(base.far, {
      baseScale: 0.5,
      scaleWeight: 0.45,
      wideScaleWeight: 0.28,
      opacity: 0.16,
      rotateFactor: 0.88,
      spreadFactorWeight: 0.84,
      depthFactorWeight: 0.76
    })
  };
}

function safeMatchMedia(query) {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return null;
    }
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function getReducedMotionPreference() {
  const mediaQuery = safeMatchMedia('(prefers-reduced-motion: reduce)');
  return !!(mediaQuery && mediaQuery.matches);
}

function normalizeTier(value) {
  if (!value) return null;

  const tier = String(value).trim().toLowerCase();
  if (tier === 'premium' || tier === 'enhanced' || tier === 'baseline' || tier === 'reduced') {
    return tier;
  }
  if (tier === 'standard') return 'enhanced';
  if (tier === 'low') return 'baseline';
  if (tier === 'reduced-motion') return 'reduced';
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeIndex(index, totalItems, infiniteLoop) {
  if (totalItems <= 0) return 0;
  if (!infiniteLoop) return clamp(index, 0, totalItems - 1);
  return ((index % totalItems) + totalItems) % totalItems;
}

function getDistance(index, centerIndex, totalItems, infiniteLoop) {
  let distance = Math.abs(index - centerIndex);
  if (infiniteLoop && totalItems > 1) {
    distance = distance % totalItems;
    distance = Math.min(distance, totalItems - distance);
  }
  return distance;
}

function createElement(tagName, className, textContent) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (typeof textContent === 'string') node.textContent = textContent;
  return node;
}

function createNoopRouletteController() {
  return {
    isActive: false,
    isSpinning: false,
    async start() {},
    refreshLayout() {},
    destroy() {},
    getStablePocketOrder() {
      return [];
    }
  };
}

function hashString(value) {
  let hash = 2166136261;
  const input = String(value || '');

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildStableMixedOrder(items) {
  return items
    .map((item, index) => ({
      index,
      weight: hashString(`${item.title}|${item.category}|${item.link}|${index}`)
    }))
    .sort((left, right) => left.weight - right.weight || left.index - right.index)
    .map((entry) => entry.index);
}

function buildPreviewBackground(previewImage, fallbackBackground) {
  if (!previewImage) return fallbackBackground;
  const safeUrl = encodeURI(previewImage).replace(/'/g, '%27');
  return `linear-gradient(160deg, rgba(8, 10, 17, 0.14), rgba(8, 10, 17, 0.46)), url('${safeUrl}')`;
}

function resolveLocalPreviewLink(link) {
  const raw = String(link || '').trim();
  if (!raw) return raw;

  try {
    const locationUrl = new URL(window.location.href);
    const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(locationUrl.hostname);
    if (!isLocal || !raw.startsWith('/')) return raw;

    const isEnglishPage = locationUrl.pathname.startsWith('/EN/');
    if (!isEnglishPage) return raw;

    if (raw === '/projects/') return '/EN/projects/index.html';
    if (raw === '/about') return '/EN/about.html';
    if (raw === '/overview') return '/EN/overview.html';
    if (raw === '/deep-dive') return '/EN/deep-dive.html';
    if (raw === '/contact') return '/EN/contact.html';
    if (raw === '/privacy') return '/EN/privacy.html';
    if (raw === '/hobbies-games') return '/EN/hobbies-games.html';

    if (raw.startsWith('/projects/')) return `/EN${raw}.html`;
    if (raw.startsWith('/about/')) return `/EN${raw}.html`;
    if (raw.startsWith('/hobbies/')) return `/EN${raw}.html`;

    return raw;
  } catch {
    return raw;
  }
}

function isCoarsePointerDevice() {
  const coarse = safeMatchMedia('(pointer: coarse)');
  return !!(coarse && coarse.matches);
}

function isGalleryMediaSurface(root) {
  return root?.dataset?.galleryVariant === 'media' || root?.dataset?.miniCarouselMode === 'gallery';
}

export function computePerformanceProfile() {
  if (typeof globalThis !== 'undefined' && globalThis[PERF_PROFILE_GLOBAL_KEY]) {
    return globalThis[PERF_PROFILE_GLOBAL_KEY];
  }

  const reducedMotion = getReducedMotionPreference();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const hardwareConcurrency = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : 4;
  const deviceMemory = typeof navigator !== 'undefined' && Number.isFinite(navigator.deviceMemory)
    ? navigator.deviceMemory
    : 4;
  const coarsePointer = isCoarsePointerDevice();

  let tier = 'enhanced';
  if (reducedMotion) {
    tier = 'reduced';
  } else {
    let score = 0;
    if (hardwareConcurrency >= 8) score += 2;
    else if (hardwareConcurrency >= 4) score += 1;
    else score -= 1;

    if (deviceMemory >= 8) score += 1;
    else if (deviceMemory <= 2) score -= 1;

    if (coarsePointer) score -= 1;
    if (viewportWidth >= 1440 && viewportHeight >= 900) score += 1;
    if (viewportWidth < 768) score -= 1;

    if (score >= 3) tier = 'premium';
    else if (score <= 0) tier = 'baseline';
  }

  const profile = {
    tier,
    metrics: {
      reducedMotion,
      viewportWidth,
      viewportHeight,
      hardwareConcurrency,
      deviceMemory,
      coarsePointer
    }
  };

  if (typeof globalThis !== 'undefined') {
    globalThis[PERF_PROFILE_GLOBAL_KEY] = profile;
  }

  try {
    if (document?.documentElement) {
      document.documentElement.classList.remove(...ROOT_TIER_CLASSES);
      document.documentElement.classList.add(`cf-tier-${profile.tier}`);
    }
  } catch {
    // Ignore document access failures in non-browser environments.
  }

  return profile;
}

class ResourceTracker {
  constructor() {
    this.abortController = new AbortController();
    this.timeouts = new Set();
    this.intervals = new Set();
    this.rafs = new Set();
    this.observers = new Set();
  }

  listen(target, type, handler, options = {}) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, { ...options, signal: this.abortController.signal });
  }

  timeout(callback, delay) {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  clearTimeout(id) {
    if (id == null) return;
    window.clearTimeout(id);
    this.timeouts.delete(id);
  }

  interval(callback, delay) {
    const id = window.setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }

  clearInterval(id) {
    if (id == null) return;
    window.clearInterval(id);
    this.intervals.delete(id);
  }

  raf(callback) {
    const id = window.requestAnimationFrame((timestamp) => {
      this.rafs.delete(id);
      callback(timestamp);
    });
    this.rafs.add(id);
    return id;
  }

  observe(observer) {
    if (observer) this.observers.add(observer);
    return observer;
  }

  destroy() {
    this.abortController.abort();
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.intervals.forEach((id) => window.clearInterval(id));
    this.rafs.forEach((id) => window.cancelAnimationFrame(id));
    this.observers.forEach((observer) => observer.disconnect?.());
    this.timeouts.clear();
    this.intervals.clear();
    this.rafs.clear();
    this.observers.clear();
  }
}

class RouletteOverlayController {
  constructor(carousel) {
    this.carousel = carousel;
    this.resources = new ResourceTracker();
    this.wheelEngine = new RouletteWheelEngine();
    this.overlay = null;
    this.elements = null;
    this.pockets = [];
    this.previewCache = [];
    this.stablePocketOrder = [];
    this.stableGreenPocketIndex = null;
    this.autoNavigateTimer = null;
    this.lastFocusedElement = null;
    this.isActive = false;
    this.isSpinning = false;
    this.spinTween = null;
    this.result = null;
    this.interactionsLocked = false;
    this.interactionsUnlockTimer = null;
    this.lastStatusPhase = '';
  }

  ensureOverlay() {
    if (this.overlay) return;

    const overlay = createElement('div', 'luxury-roulette-overlay');
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'luxury-roulette-title');
    overlay.setAttribute('aria-hidden', 'true');

    const shell = createElement('div', 'luxury-roulette-shell');
    const closeButton = createElement('button', 'luxury-roulette-close');
    closeButton.type = 'button';
    closeButton.dataset.rouletteClose = 'true';
    closeButton.setAttribute('aria-label', 'Close roulette');
    closeButton.textContent = 'Close';

    const stage = createElement('div', 'luxury-roulette-stage');
    const wheel = createElement('div', 'luxury-roulette-wheel');
    const rim = createElement('div', 'luxury-roulette-rim');
    const pocketRing = createElement('div', 'luxury-roulette-pocket-ring');

    wheel.appendChild(rim);
    wheel.appendChild(pocketRing);
    stage.appendChild(wheel);

    const ball = createElement('div', 'luxury-roulette-ball');
    const ballHighlight = createElement('div', 'luxury-roulette-ball-highlight');
    const ballShadow = createElement('div', 'luxury-roulette-ball-shadow');
    stage.appendChild(ballShadow);
    stage.appendChild(ball);
    stage.appendChild(ballHighlight);

    const status = createElement('p', 'luxury-roulette-status', 'Preparing roulette');
    status.setAttribute('aria-live', 'polite');

    const dialog = createElement('div', 'luxury-roulette-dialog');
    dialog.hidden = true;
    dialog.setAttribute('data-roulette-dialog', 'true');

    const title = createElement('h3', 'luxury-roulette-dialog__title');
    title.id = 'luxury-roulette-title';
    const body = createElement('p', 'luxury-roulette-dialog__body');
    const actions = createElement('div', 'luxury-roulette-dialog__actions');
    const primaryButton = createElement('button', 'luxury-roulette-action luxury-roulette-action--primary');
    primaryButton.type = 'button';
    primaryButton.dataset.roulettePrimary = 'true';
    const secondaryButton = createElement('button', 'luxury-roulette-action luxury-roulette-action--secondary');
    secondaryButton.type = 'button';
    secondaryButton.dataset.rouletteSecondary = 'true';

    actions.appendChild(primaryButton);
    actions.appendChild(secondaryButton);
    dialog.appendChild(title);
    dialog.appendChild(body);
    dialog.appendChild(actions);

    shell.appendChild(closeButton);
    shell.appendChild(stage);
    shell.appendChild(status);
    shell.appendChild(dialog);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.elements = {
      shell,
      stage,
      wheel,
      rim,
      pocketRing,
      ball,
      ballHighlight,
      ballShadow,
      status,
      dialog,
      dialogTitle: title,
      dialogBody: body,
      dialogPrimary: primaryButton,
      dialogSecondary: secondaryButton,
      closeButton
    };

    this.createPocketNodes();
    this.bindOverlayEvents();
    this.refreshLayout();
  }

  createPocketNodes() {
    const fragment = document.createDocumentFragment();
    this.pockets = [];

    for (let index = 0; index < this.wheelEngine.pocketCount; index += 1) {
      const pocket = createElement('div', 'luxury-roulette-pocket');
      pocket.dataset.pocketIndex = String(index);

      const preview = createElement('div', 'luxury-roulette-pocket__preview');
      const category = createElement('span', 'luxury-roulette-pocket__category');
      const title = createElement('strong', 'luxury-roulette-pocket__title');
      const badge = createElement('span', 'luxury-roulette-pocket__badge');

      preview.appendChild(category);
      preview.appendChild(title);
      pocket.appendChild(preview);
      pocket.appendChild(badge);
      fragment.appendChild(pocket);

      this.pockets.push({
        root: pocket,
        preview,
        category,
        title,
        badge
      });
    }

    this.elements.pocketRing.appendChild(fragment);
  }

  bindOverlayEvents() {
    this.resources.listen(this.overlay, 'click', (event) => {
      if (this.interactionsLocked) return;
      if (event.target === this.overlay && !this.isSpinning) {
        this.closeOverlay();
      }
    });

    this.resources.listen(this.elements.closeButton, 'click', () => {
      if (this.interactionsLocked) return;
      if (this.isSpinning) {
        this.cancelSpin('Roulette dismissed.');
        return;
      }
      this.closeOverlay();
    });

    this.resources.listen(this.elements.dialogPrimary, 'click', () => {
      if (!this.result) return;
      if (this.result.kind === 'retry') {
        this.start().catch(() => {
          this.cancelSpin('Roulette retry failed.');
        });
        return;
      }

      if (this.result.link) {
        this.navigateToResultLink(this.result.link);
      }
    });

    this.resources.listen(this.elements.dialogSecondary, 'click', () => {
      this.closeOverlay();
    });

    this.resources.listen(document, 'keydown', (event) => {
      if (!this.isActive) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (this.isSpinning) {
          this.cancelSpin('Roulette dismissed.');
        } else {
          this.closeOverlay();
        }
        return;
      }

      if (event.key === 'Tab') {
        this.trapFocus(event);
      }
    });
  }

  trapFocus(event) {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  getFocusableElements() {
    if (!this.overlay) return [];
    return Array.from(
      this.overlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
    ).filter((node) => !node.hidden && !node.closest('[hidden]'));
  }

  refreshLayout() {
    this.ensureOverlay();

    const diameter = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.62);
    const pocketSize = Math.max(76, Math.min(108, Math.round(diameter * 0.14)));
    const wheelRadius = Math.max(150, Math.round(diameter * 0.42));

    this.overlay.style.setProperty('--roulette-diameter', `${diameter}px`);
    this.overlay.style.setProperty('--roulette-pocket-size', `${pocketSize}px`);
    this.overlay.style.setProperty('--roulette-wheel-radius', `${wheelRadius}px`);

    const positions = this.wheelEngine.calculatePocketPositions(0, 0);
    positions.forEach((position, index) => {
      const pocket = this.pockets[index]?.root;
      if (!pocket) return;
      pocket.style.setProperty('--pocket-x', `${Math.round(position.x)}px`);
      pocket.style.setProperty('--pocket-y', `${Math.round(position.y)}px`);
      pocket.style.setProperty('--pocket-rotation', `${position.rotation}deg`);
    });
  }

  readCardPreviewData() {
    if (this.previewCache.length === this.carousel.items.length) {
      return this.previewCache;
    }

    this.previewCache = this.carousel.items.map((item) => {
      const previewImageNode = item.querySelector('.card-bg img.card-image, .card-image-container img.card-image, img.card-image');
      const previewImage = item.dataset.previewImage
        || previewImageNode?.getAttribute('src')
        || '';

      const backgroundNode = item.querySelector('.card-bg');
      const backgroundStyle = backgroundNode ? window.getComputedStyle(backgroundNode) : null;
      const fallbackBackground = backgroundStyle
        ? (backgroundStyle.backgroundImage !== 'none' ? backgroundStyle.backgroundImage : backgroundStyle.background)
        : 'linear-gradient(135deg, #212842, #3d4666)';
      const background = buildPreviewBackground(previewImage, fallbackBackground);
      const title = item.dataset.title || item.querySelector('.card-title')?.textContent?.trim() || 'Project';
      const category = item.querySelector('.card-category')?.textContent?.trim() || 'Selected Work';
      const linkNode = item.querySelector('.card-link, a[href], a[data-prev-href]');
      const link = item.dataset.link
        || linkNode?.getAttribute('href')
        || linkNode?.getAttribute('data-prev-href')
        || '';
      return { background, previewImage, title, category, link };
    });

    return this.previewCache;
  }

  getStablePocketOrder() {
    const previewData = this.readCardPreviewData();

    if (this.stablePocketOrder.length === previewData.length) {
      return this.stablePocketOrder;
    }

    this.stablePocketOrder = buildStableMixedOrder(previewData);
    return this.stablePocketOrder;
  }

  clearAutoNavigateTimer() {
    if (!this.autoNavigateTimer) return;
    this.resources.clearTimeout(this.autoNavigateTimer);
    this.autoNavigateTimer = null;
  }

  navigateToResultLink(link) {
    if (!link) return;
    this.clearAutoNavigateTimer();
    window.location.href = resolveLocalPreviewLink(link);
  }

  prepareSpinResult() {
    const previewData = this.readCardPreviewData();
    const stableOrder = this.getStablePocketOrder();
    const greenPocketIndex = this.stableGreenPocketIndex ?? this.wheelEngine.getRandomGreenPocket();
    this.stableGreenPocketIndex = greenPocketIndex;
    this.wheelEngine.greenPocketIndex = greenPocketIndex;

    const mapping = [];
    let orderCursor = 0;
    for (let index = 0; index < this.wheelEngine.pocketCount; index += 1) {
      if (index === greenPocketIndex) {
        mapping.push(-1);
        continue;
      }

      const mappedCardIndex = stableOrder[orderCursor % stableOrder.length];
      orderCursor += 1;
      mapping.push(mappedCardIndex);
    }

    const selectablePocketIndices = mapping
      .map((mappedCardIndex, index) => (mappedCardIndex === -1 ? null : index))
      .filter((value) => value != null);

    const winnerPocketIndex = selectablePocketIndices[
      Math.floor(Math.random() * selectablePocketIndices.length)
    ];
    const winnerCardIndex = mapping[winnerPocketIndex];

    this.result = {
      winnerCardIndex,
      greenPocketIndex,
      winnerPocketIndex,
      mapping,
      previewData,
      kind: mapping[winnerPocketIndex] === -1 ? 'retry' : 'winner',
      link: previewData[winnerCardIndex]?.link || ''
    };

    this.overlay.dataset.winnerIndex = String(winnerCardIndex);
    this.overlay.dataset.resultKind = 'pending';
  }

  renderPockets() {
    if (!this.result) return;

    this.pockets.forEach((pocket, index) => {
      const mapping = this.result.mapping[index];
      const pocketNumber = this.wheelEngine.wheelSequence[index]?.number ?? index;
      const pocketColor = index === this.result.greenPocketIndex
        ? 'green'
        : this.wheelEngine.wheelSequence[index]?.color || 'black';

      pocket.root.classList.remove('is-red', 'is-black', 'is-green', 'is-winning-pocket');
      pocket.root.classList.add(`is-${pocketColor}`);
      if (index === this.result.winnerPocketIndex) {
        pocket.root.classList.add('is-winning-pocket');
      }

      if (mapping === -1) {
        pocket.preview.style.setProperty('--preview-bg', 'linear-gradient(135deg, #104b29, #0f7a37)');
        pocket.category.textContent = 'House';
        pocket.title.textContent = 'Try Again';
        pocket.badge.textContent = '0';
        return;
      }

      const preview = this.result.previewData[mapping];
      pocket.preview.style.setProperty('--preview-bg', preview.background);
      pocket.category.textContent = preview.category;
      pocket.title.textContent = preview.title;
      pocket.badge.textContent = String(pocketNumber);
    });
  }

  resetWheelVisuals() {
    gsap.killTweensOf([this.elements.stage, this.elements.wheel, this.elements.ball, this.elements.ballShadow, this.elements.ballHighlight, this.elements.dialog]);
    gsap.killTweensOf(this.pockets.map((pocket) => pocket.root));
    if (this._spinFrame) {
      gsap.killTweensOf(this._spinFrame);
      this._spinFrame = null;
    }

    gsap.set(this.elements.wheel, { rotation: 0 });
    gsap.set(this.elements.ball, { x: 0, y: 0, opacity: 1, scale: 1 });
    gsap.set(this.elements.ballHighlight, { x: 0, y: 0, opacity: 0.9 });
    gsap.set(this.elements.ballShadow, { x: 0, y: 0, opacity: 0.5, scale: 1 });
    gsap.set(this.elements.dialog, { autoAlpha: 0, y: 14 });
    this.elements.dialog.hidden = true;
    this.elements.dialog.classList.remove('is-visible');

    const reducedMotion = this.carousel.motion.rouletteMode === 'minimal';
    gsap.set(this.pockets.map((pocket) => pocket.root), {
      opacity: 1,
      scale: reducedMotion ? 1 : 0.92
    });
  }

  setStatus(message, mode = 'polite') {
    this.elements.status.textContent = message;
    this.carousel.announce(message, mode);
  }

  openOverlay() {
    this.ensureOverlay();
    this.clearAutoNavigateTimer();
    this.lastFocusedElement = document.activeElement;
    this.isActive = true;
    this.interactionsLocked = true;
    this.resources.clearTimeout(this.interactionsUnlockTimer);
    this.interactionsUnlockTimer = this.resources.timeout(() => {
      this.interactionsLocked = false;
      this.interactionsUnlockTimer = null;
    }, 320);
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('roulette-overlay-open');
    this.resources.raf(() => {
      this.overlay.classList.add('is-active');
      this.elements.closeButton.focus();
    });
  }

  closeOverlay(options = {}) {
    const { restoreFocus = true } = options;

    this.clearAutoNavigateTimer();
    this.isActive = false;
    this.isSpinning = false;
    this.resources.clearTimeout(this.interactionsUnlockTimer);
    this.interactionsUnlockTimer = null;
    this.interactionsLocked = false;
    this.overlay.classList.remove('is-active');
    this.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('roulette-overlay-open');
    this.overlay.dataset.resultKind = 'closed';

    this.resources.timeout(() => {
      if (!this.overlay.classList.contains('is-active')) {
        this.overlay.hidden = true;
      }
    }, 220);

    if (restoreFocus && this.lastFocusedElement?.focus) {
      this.lastFocusedElement.focus();
    }
  }

  showResultDialog(config) {
    this.clearAutoNavigateTimer();
    this.overlay.dataset.resultKind = config.kind;
    this.elements.dialogTitle.textContent = config.title;
    this.elements.dialogBody.textContent = config.body;
    this.elements.dialogPrimary.textContent = config.primaryLabel;
    this.elements.dialogSecondary.textContent = config.secondaryLabel;
    this.elements.dialog.hidden = false;
    this.elements.dialog.classList.add('is-visible');

    gsap.fromTo(
      this.elements.dialog,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: this.carousel.motion.dialogMs / 1000, ease: 'power2.out' }
    );

    this.resources.raf(() => {
      this.elements.dialogPrimary.focus();
    });
  }

  renderSpinFrame(frame) {
    // --- pocket-bounce radial modulation ---
    // The ball rattles over pocket dividers: a sinusoidal radial
    // perturbation whose amplitude fades as the spin decelerates.
    const bounceOffset = this.wheelEngine.getPocketBounceOffset(
      frame.ballAngle,
      frame.progress,
      frame.bounceAmplitude ?? 6
    );
    const effectiveRadius = frame.radius + bounceOffset;

    const angleInRadians = (frame.ballAngle * Math.PI) / 180;
    const x = Math.cos(angleInRadians) * effectiveRadius;
    // Vertical lift: during bounces the ball lifts slightly above the
    // track plane.  The lift is proportional to the bounce offset.
    const liftY = -bounceOffset * 0.45;
    const y = Math.sin(angleInRadians) * effectiveRadius + liftY;

    const depthRatio = (Math.sin(angleInRadians - Math.PI / 2) + 1) / 2;
    const ballScale = 0.84 + (depthRatio * 0.34);

    gsap.set(this.elements.wheel, { rotation: frame.wheelRotation });
    gsap.set(this.elements.ball, {
      x, y,
      scale: ballScale,
      zIndex: 1000 + Math.round(depthRatio * 100)
    });
    gsap.set(this.elements.ballHighlight, {
      x: x - (5 * ballScale),
      y: y - (5 * ballScale),
      opacity: 0.52 + (depthRatio * 0.34),
      scale: ballScale
    });

    // Shadow stretches away when the ball lifts off the surface
    const shadowStretch = 1 + (bounceOffset / 30);
    gsap.set(this.elements.ballShadow, {
      x,
      y: y + (20 - (depthRatio * 8)) + bounceOffset * 0.6,
      opacity: Math.max(0.12, (0.32 + ((1 - depthRatio) * 0.26)) - bounceOffset * 0.015),
      scale: (0.72 + ((1 - depthRatio) * 0.44)) * shadowStretch
    });

    // Status announcements (accessibility)
    let phase = 'final';
    let message = 'Picking the final pocket';
    if (frame.progress < 0.20) {
      phase = 'fast';
      message = 'Wheel at full speed';
    } else if (frame.progress < 0.55) {
      phase = 'settling';
      message = 'Settling into position';
    } else if (frame.progress < 0.85) {
      phase = 'approaching';
      message = 'Approaching final pocket';
    }

    if (phase !== this.lastStatusPhase) {
      this.lastStatusPhase = phase;
      this.setStatus(message);
    }
  }

  async runWinningCardTransition(preview) {
    await this.waitForCarouselSettle();

    const winningPocket = this.pockets[this.result.winnerPocketIndex]?.root;
    const activeItem = this.carousel.items[this.result.winnerCardIndex];
    if (!winningPocket || !activeItem) return;

    const pocketPreview = winningPocket.querySelector('.luxury-roulette-pocket__preview');
    if (!pocketPreview) return;

    const pocketRect = pocketPreview.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    if (!pocketRect.width || !pocketRect.height || !activeRect.width || !activeRect.height) return;

    const clone = pocketPreview.cloneNode(true);
    clone.classList.add('luxury-roulette-pocket__preview--flying');
    clone.style.setProperty('--preview-bg', preview.background);
    clone.style.position = 'fixed';
    clone.style.left = `${pocketRect.left}px`;
    clone.style.top = `${pocketRect.top}px`;
    clone.style.width = `${pocketRect.width}px`;
    clone.style.height = `${pocketRect.height}px`;
    clone.style.margin = '0';
    clone.style.zIndex = '10002';
    clone.style.pointerEvents = 'none';
    clone.style.transformOrigin = 'center center';
    clone.style.boxShadow = '0 34px 90px rgba(0, 0, 0, 0.42)';
    clone.style.willChange = 'transform, opacity';
    clone.style.borderRadius = getComputedStyle(pocketPreview).borderRadius || '1.25rem';
    document.body.appendChild(clone);

    const overlayBackground = this.overlay;
    const overlayWheelTargets = [
      this.elements.shell,
      this.elements.stage,
      this.elements.status,
      ...this.pockets.map((pocket) => pocket.root),
      this.elements.ball,
      this.elements.ballHighlight,
      this.elements.ballShadow
    ];

    gsap.set(activeItem, { opacity: 0.04, scale: 0.88, filter: 'blur(8px) brightness(0.8)' });

    await new Promise((resolve) => {
      const timeline = gsap.timeline({ onComplete: resolve });
      // Step 2: Card lifts out of roulette track with glow
      timeline.to(clone, {
        y: `-=40`,
        scale: 1.45,
        boxShadow: `0 34px 90px rgba(201, 167, 109, 0.35)`,
        duration: 0.3,
        ease: 'power2.out'
      });
      // Step 3: Card flies to center and expands
      timeline.to(clone, {
        x: window.innerWidth * 0.5 - (pocketRect.left + pocketRect.width * 0.5),
        y: window.innerHeight * 0.44 - (pocketRect.top + pocketRect.height * 0.5),
        scale: 3.35,
        rotate: 0,
        duration: 0.64,
        ease: 'power4.out'
      });
      timeline.to(clone, {
        y: `-=${Math.max(22, window.innerHeight * 0.024)}`,
        scale: 3.56,
        duration: 0.22,
        ease: 'sine.inOut'
      });
      // Step 4: Roulette UI fades out
      timeline.to(overlayWheelTargets, {
        opacity: 0,
        duration: 0.38,
        ease: 'power2.out'
      }, '-=0.28');
      timeline.to(overlayBackground, {
        backgroundColor: 'rgba(2, 4, 10, 0)',
        backdropFilter: 'blur(0px)',
        duration: 0.44,
        ease: 'power2.out'
      }, '-=0.34');
      // Step 5: Card morphs down into carousel position
      timeline.to(clone, {
        x: activeRect.left + activeRect.width * 0.5 - (pocketRect.left + pocketRect.width * 0.5),
        y: activeRect.top + activeRect.height * 0.5 - (pocketRect.top + pocketRect.height * 0.5),
        scaleX: activeRect.width / pocketRect.width,
        scaleY: activeRect.height / pocketRect.height,
        borderRadius: getComputedStyle(activeItem).borderRadius || '1.35rem',
        opacity: 0.06,
        duration: 0.7,
        ease: 'expo.inOut'
      });
      timeline.to(activeItem, {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px) brightness(1.04)',
        duration: 0.48,
        ease: 'power3.out'
      }, '-=0.36');
    });

    clone.remove();
    gsap.set(activeItem, { clearProps: 'opacity,scale,filter' });
    gsap.set(overlayBackground, { clearProps: 'backgroundColor,backdropFilter' });
    gsap.set(overlayWheelTargets, { clearProps: 'opacity' });
    this.closeOverlay({ restoreFocus: false });
  }

  async waitForCarouselSettle() {
    const carousel = this.carousel;
    if (!carousel) return;

    const settleFrame = () => new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    if (!carousel.isAnimating) {
      await settleFrame();
      return;
    }

    const timeoutMs = Math.max(180, carousel.motion.slideMs + carousel.motion.settleMs + 96);
    const start = performance.now();

    await new Promise((resolve) => {
      const check = () => {
        if (!carousel.isAnimating || performance.now() - start >= timeoutMs) {
          resolve();
          return;
        }

        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    });

    await settleFrame();
  }

  async runIntroAnimation() {
    if (this.carousel.motion.rouletteMode === 'minimal') {
      gsap.set(this.pockets.map((pocket) => pocket.root), { opacity: 1, scale: 1 });
      return;
    }

    await new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      const stagger = this.carousel.motion.staggerDelay;
      const fallbackMs = Math.max(220, this.carousel.motion.introMs + (this.pockets.length * stagger * 1000) + 180);
      const fallbackTimeout = this.resources.timeout(() => {
        finish();
      }, fallbackMs);

      gsap.fromTo(
        this.pockets.map((pocket) => pocket.root),
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: this.carousel.motion.introMs / 1000,
          stagger,
          ease: 'power2.out',
          onComplete: () => {
            this.resources.clearTimeout(fallbackTimeout);
            finish();
          }
        }
      );
    });
  }

  async runSpinAnimation() {
    const wheelSpin = this.wheelEngine.calculateWheelSpin(this.result.winnerPocketIndex, {
      landingAngle: -92
    });
    const durationSeconds = this.carousel.motion.spinMs / 1000;
    const wheelRadius = parseFloat(getComputedStyle(this.overlay).getPropertyValue('--roulette-wheel-radius')) || 220;
    const totalBallRotation = wheelSpin.spins * 360 + 280 + Math.random() * 90;
    const initialBallAngle = wheelSpin.landingAngle + totalBallRotation;

    // Bounce amplitude starts high and the frame-renderer fades it with progress
    const frame = {
      wheelRotation: 0,
      ballAngle: initialBallAngle,
      radius: wheelRadius * 1.13,
      progress: 0,
      bounceAmplitude: 7
    };
    // Expose frame so cancelSpin can kill in-flight tweens on it
    this._spinFrame = frame;

    const renderFrame = () => {
      frame.progress = this.spinTween ? this.spinTween.progress() : frame.progress;
      this.renderSpinFrame(frame);
    };

    // --- Phase 1: main spin with exponential deceleration ----------------
    await new Promise((resolve) => {
      this.isSpinning = true;

      // 6-leg timeline for richer momentum feel
      //   Leg 1 – explosive launch (power build)
      //   Leg 2 – sustained high speed on outer rail
      //   Leg 3 – primary exponential deceleration
      //   Leg 4 – ball drops inward, big slowdown
      //   Leg 5 – "hanging" moment — near-stop, tease pocket
      //   Leg 6 – final creep into the winning pocket

      const leg1Dur = durationSeconds * 0.18;
      const leg2Dur = durationSeconds * 0.22;
      const leg3Dur = durationSeconds * 0.22;
      const leg4Dur = durationSeconds * 0.16;
      const leg5Dur = durationSeconds * 0.12;         // hanging tease
      const leg6Dur = Math.max(0.36, durationSeconds - leg1Dur - leg2Dur - leg3Dur - leg4Dur - leg5Dur);

      // Wheel rotation keyframes (cumulative, negative = counter-clockwise)
      const wR1 = wheelSpin.finalRotation * 0.30;
      const wR2 = wheelSpin.finalRotation * 0.58;
      const wR3 = wheelSpin.finalRotation * 0.78;
      const wR4 = wheelSpin.finalRotation * 0.91;
      const wR5 = wheelSpin.finalRotation * 0.975;
      const wRFinal = wheelSpin.finalRotation;

      // Ball angle keyframes
      const bA1 = initialBallAngle - (totalBallRotation * 0.36);
      const bA2 = initialBallAngle - (totalBallRotation * 0.64);
      const bA3 = initialBallAngle - (totalBallRotation * 0.84);
      const bA4 = initialBallAngle - (totalBallRotation * 0.94);
      const bA5 = initialBallAngle - (totalBallRotation * 0.982);
      const bAFinal = wheelSpin.landingAngle;

      this.spinTween = gsap.timeline({
        onComplete: () => {
          this.spinTween = null;
          resolve();
        }
      });

      // Leg 1: explosive launch — ball flings outward
      this.spinTween.to(frame, {
        wheelRotation: wR1,
        ballAngle: bA1,
        radius: wheelRadius * 1.18,
        bounceAmplitude: 8,
        duration: leg1Dur,
        ease: 'power3.in',
        onUpdate: renderFrame
      });

      // Leg 2: sustained full speed on the outer rim
      this.spinTween.to(frame, {
        wheelRotation: wR2,
        ballAngle: bA2,
        radius: wheelRadius * 1.14,
        bounceAmplitude: 7,
        duration: leg2Dur,
        ease: 'none',               // linear at top speed
        onUpdate: renderFrame
      });

      // Leg 3: primary exponential deceleration — visible slowdown
      this.spinTween.to(frame, {
        wheelRotation: wR3,
        ballAngle: bA3,
        radius: wheelRadius * 1.02,
        bounceAmplitude: 5,
        duration: leg3Dur,
        ease: 'expo.out',
        onUpdate: renderFrame
      });

      // Leg 4: ball drops inward toward the pocket ring
      this.spinTween.to(frame, {
        wheelRotation: wR4,
        ballAngle: bA4,
        radius: wheelRadius * 0.88,
        bounceAmplitude: 3,
        duration: leg4Dur,
        ease: 'power3.out',
        onUpdate: renderFrame
      });

      // Leg 5: "hanging" moment — ball almost stops, teasing a pocket
      this.spinTween.to(frame, {
        wheelRotation: wR5,
        ballAngle: bA5,
        radius: wheelRadius * 0.82,
        bounceAmplitude: 1.5,
        duration: leg5Dur,
        ease: 'sine.inOut',          // butter-smooth near-stop
        onUpdate: renderFrame
      });

      // Leg 6: final creep — slow glide into the winning pocket
      this.spinTween.to(frame, {
        wheelRotation: wRFinal,
        ballAngle: bAFinal,
        radius: wheelRadius * 0.78,
        bounceAmplitude: 0,
        duration: leg6Dur,
        ease: 'power4.out',
        onUpdate: renderFrame
      });
    });

    // --- Phase 2: dampened settle bounces --------------------------------
    // The ball has reached the winning pocket's neighbourhood.  Now it
    // bounces 3-4 times with decreasing height before coming to rest —
    // like a real ball rattling between the frets.
    const bounces = this.wheelEngine.getBounceSequence();
    const settleBaseRadius = wheelRadius * 0.78;
    let currentAngle = wheelSpin.landingAngle;
    const currentWheelRotation = wheelSpin.finalRotation;

    for (const bounce of bounces) {
      // Each bounce: lift outward then drop back in, advancing the angle
      // slightly as if the ball skips forward across a pocket or two.
      const peakRadius = settleBaseRadius + bounce.height;
      const halfDur = bounce.duration / 2;
      const angleAdvance = bounce.angularTravel;

      // Upward arc (ball lifts)
      await new Promise((resolve) => {
        gsap.to(frame, {
          radius: peakRadius,
          ballAngle: currentAngle - angleAdvance * 0.6,
          bounceAmplitude: 0,
          duration: halfDur,
          ease: bounce.ease,
          onUpdate: () => {
            frame.wheelRotation = currentWheelRotation;
            this.renderSpinFrame(frame);
          },
          onComplete: resolve
        });
      });

      // Downward arc (ball drops back)
      currentAngle -= angleAdvance;
      await new Promise((resolve) => {
        gsap.to(frame, {
          radius: settleBaseRadius,
          ballAngle: currentAngle,
          bounceAmplitude: 0,
          duration: halfDur,
          ease: bounce.ease.replace('.out', '.in'),
          onUpdate: () => {
            frame.wheelRotation = currentWheelRotation;
            this.renderSpinFrame(frame);
          },
          onComplete: resolve
        });
      });
    }

    this.isSpinning = false;
    this._spinFrame = null;
  }

  async presentResult() {
    const winningPocket = this.pockets[this.result.winnerPocketIndex]?.root;
    if (winningPocket) {
      // Step 1: Winner pocket scales up with a glow
      gsap.fromTo(
        winningPocket,
        { scale: 1, boxShadow: '0 0 0px rgba(201,167,109,0)' },
        {
          scale: 1.15,
          boxShadow: '0 0 28px rgba(201,167,109,0.6)',
          duration: 0.3,
          repeat: 1,
          yoyo: true,
          ease: 'power2.out'
        }
      );
    }

    if (this.result.mapping[this.result.winnerPocketIndex] !== -1) {
      this.overlay.dataset.resultKind = 'winner';
      this.carousel.goToSlide(this.result.winnerCardIndex, {
        durationMs: Math.max(this.carousel.motion.slideMs, this.carousel.motion.settleMs + 420)
      });

      const preview = this.result.previewData[this.result.winnerCardIndex];
      this.setStatus(`${preview.title} selected`);
      await this.runWinningCardTransition(preview);
      this.carousel.pulseCurrentCard();
      this.carousel.items[this.result.winnerCardIndex]?.focus?.({ preventScroll: true });

      if (preview.link && this.carousel.config.rouletteAutoNavigate !== false) {
        const delayMs = 220;
        this.closeOverlay({ restoreFocus: false });
        this.autoNavigateTimer = this.resources.timeout(() => {
          this.navigateToResultLink(preview.link);
        }, delayMs);
      }
      return;
    }

    this.setStatus('Green pocket. Spin again or close.');
    this.showResultDialog({
      kind: 'retry',
      title: 'Green pocket',
      body: 'The house kept this round. Spin again if you want another pick, or close to keep browsing manually.',
      primaryLabel: 'Spin again',
      secondaryLabel: 'Close'
    });
  }

  async start() {
    if (this.isSpinning) return;

    this.ensureOverlay();
    this.prepareSpinResult();
    this.renderPockets();
    this.resetWheelVisuals();
    this.lastStatusPhase = '';
    this.openOverlay();
    this.setStatus('Preparing roulette');

    await this.runIntroAnimation();
    await this.runSpinAnimation();
    await this.presentResult();
  }

  cancelSpin(message) {
    this.clearAutoNavigateTimer();
    gsap.killTweensOf([this.elements.wheel, this.elements.ball, this.elements.ballShadow, this.elements.ballHighlight, this.elements.dialog]);
    gsap.killTweensOf(this.pockets.map((pocket) => pocket.root));
    // Kill settle-bounce tweens that target the frame object directly
    if (this._spinFrame) {
      gsap.killTweensOf(this._spinFrame);
      this._spinFrame = null;
    }
    this.isSpinning = false;
    this.spinTween = null;
    this.setStatus(message, 'assertive');
    this.closeOverlay();
  }

  destroy() {
    if (this.overlay) {
      this.cancelSpin('Roulette destroyed.');
    }
    this.resources.destroy();
    this.overlay?.remove();
    this.overlay = null;
    this.elements = null;
    this.pockets = [];
  }
}

export class LuxuryCoverflow {
  constructor(containerSelector, options = {}) {
    this.container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;
    if (!this.container) return;

    this.selectors = {
      track: '.coverflow-track',
      items: '.coverflow-card',
      prevButton: '.coverflow-btn-prev',
      nextButton: '.coverflow-btn-next',
      paginationCurrent: '.pagination-current',
      paginationTotal: '.pagination-total',
      dots: null,
      ...options.selectors
    };

    this.callbacks = {
      onActiveItemSelect: null,
      onSlideChange: null,
      resolveItemTitle: null,
      ...options.callbacks
    };

    this.track = this.container.querySelector(this.selectors.track);
    this.items = Array.from(this.container.querySelectorAll(this.selectors.items));
    if (!this.track || this.items.length === 0) return;

    this.isLuxurySectionSurface = this.container.hasAttribute('data-luxury-coverflow');
    this.isGalleryMiniSurface = options.surface === 'luxury-coverflow'
      || isGalleryMediaSurface(this.container)
      || this.container.dataset?.miniCarousel === 'true';

    const profile = computePerformanceProfile();
    const defaultTier = this.isLuxurySectionSurface
      ? 'premium'
      : (this.isGalleryMiniSurface ? 'enhanced' : profile.tier);
    const resolvedTier = getReducedMotionPreference()
      ? 'reduced'
      : normalizeTier(options.performanceTier) || defaultTier;

    this.motion = MOTION_PROFILES[resolvedTier] || MOTION_PROFILES.enhanced;
    this.profile = {
      tier: resolvedTier,
      metrics: profile.metrics
    };

    this.config = {
      initialIndex: 0,
      infiniteLoop: true,
      autoplay: false,
      autoplayDelay: 5000,
      enableKeyboard: true,
      enableMouse: true,
      enableTouch: true,
      enableScroll: true,
      enableSmoothTracking: this.motion.enableSmoothTracking,
      performanceTier: resolvedTier,
      animationEase: 'power2.inOut',
      surface: 'default',
      geometryProfile: this.isLuxurySectionSurface
        ? 'about-premium'
        : (this.isGalleryMiniSurface ? 'gallery-standard' : 'adaptive'),
      rememberLastCard: this.isGalleryMiniSurface || this.isLuxurySectionSurface,
      memoryKey: null,
      activeStateClass: 'coverflow-card--active',
      maxVisibleDots: 7,
      itemRoleDescription: 'slide',
      rouletteAutoNavigate: true,
      rouletteAutoNavigateDelay: 1200,
      ...options
    };

    if (isGalleryMediaSurface(this.container)) {
      // Gallery surfaces get a slightly longer, smoother travel curve than project carousels.
      this.motion = {
        ...this.motion,
        slideMs: 550
      };
      this.config.animationEase = 'power2.inOut';
    }

    this.memoryKey = this.resolveMemoryKey();
    const restoredIndex = this.restoreRememberedIndex();
    const initialIndex = Number.isFinite(restoredIndex) ? restoredIndex : this.config.initialIndex;

    this.currentIndex = normalizeIndex(initialIndex, this.items.length, this.config.infiniteLoop);
    this.previewIndex = this.currentIndex;
    this.pendingTarget = null;
    this.isAnimating = false;
    this.animationCycle = 0;
    this.animationTimeout = null;
    this.positionTween = null;
    this.autoplayInterval = null;
    this.wheelState = {
      accumulator: 0,
      previewPosition: this.currentIndex,
      settleTimeout: null,
      axisLock: null,
      lastInputAt: 0
    };
    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      axisLocked: null,
      startPosition: this.currentIndex,
      startIndex: this.currentIndex,
      previewPosition: this.currentIndex,
      rafPending: false,
      sourceTarget: null
    };
    this.dragSequence = 0;
    this.activePointerId = null;
    this.lastPointerTouchAt = 0;
    this.suppressClickUntil = 0;

    this.resources = new ResourceTracker();
    this.physics = new CoverflowPhysics({
      friction: 0.92,
      snapThreshold: 0.25,
      velocityMultiplier: 2.2
    });
    this.viewportTuning = null;
    this.applyViewportTuning();
    this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
    this.dots = [];
    this.dotTargets = [];
    this.dotContainer = this.selectors.dots ? this.container.querySelector(this.selectors.dots) : null;
    const rouletteButton = this.container.querySelector('[data-roulette-trigger], .roulette-trigger-btn');
    this.roulette = rouletteButton ? new RouletteOverlayController(this) : createNoopRouletteController();

    this.liveRegion = this.ensureLiveRegion();
    this.init();
  }

  sanitizeMemoryFragment(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9:_\/-]/g, '')
      .slice(0, 80);
  }

  buildFallbackMemoryId() {
    const candidates = Array.from(document.querySelectorAll('.gallery-carousel[data-mini-carousel="true"], .gallery-carousel'));
    const index = candidates.indexOf(this.container);
    return index >= 0 ? `gallery-${index + 1}` : 'gallery-unknown';
  }

  resolveMemoryKey() {
    if (!this.config.rememberLastCard) return null;

    const explicit = this.config.memoryKey || this.container.dataset?.coverflowMemoryKey;
    if (explicit) {
      return `ea.gallery.coverflow:${this.sanitizeMemoryFragment(explicit)}`;
    }

    const route = this.sanitizeMemoryFragment(window.location.pathname || '/');
    const identity = this.sanitizeMemoryFragment(
      this.container.id
      || this.container.dataset?.galleryId
      || this.container.getAttribute('aria-label')
      || this.buildFallbackMemoryId()
    );

    return `ea.gallery.coverflow:${route}:${identity}`;
  }

  restoreRememberedIndex() {
    if (!this.memoryKey) return null;

    try {
      const raw = window.localStorage.getItem(this.memoryKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const rawIndex = typeof parsed === 'number' ? parsed : parsed?.index;
      if (!Number.isFinite(rawIndex)) return null;

      return normalizeIndex(Math.trunc(rawIndex), this.items.length, this.config.infiniteLoop);
    } catch {
      return null;
    }
  }

  persistRememberedIndex(index = this.currentIndex) {
    if (!this.memoryKey) return;

    try {
      const payload = JSON.stringify({
        index: normalizeIndex(index, this.items.length, this.config.infiniteLoop),
        totalItems: this.items.length,
        savedAt: Date.now()
      });
      window.localStorage.setItem(this.memoryKey, payload);
    } catch {
      // Ignore storage failures in private browsing or restricted environments.
    }
  }

  init() {
    this.container.dataset.coverflowReady = 'true';
    this.container.dataset.coverflowTier = this.profile.tier;
    this.container.dataset.coverflowSurface = this.config.surface;
    this.container.dataset.coverflowGeometry = this.config.geometryProfile;
    this.container.style.setProperty('--luxury-glow-strength', String(this.motion.glowStrength));
    this.container.style.setProperty('--luxury-reflection-opacity', String(this.motion.reflectionOpacity));

    this.items.forEach((item, index) => {
      item.dataset.index = item.dataset.index || String(index);
      item.tabIndex = index === this.currentIndex ? 0 : -1;
      item.setAttribute('aria-roledescription', this.config.itemRoleDescription);
    });

    const rouletteButton = this.container.querySelector('[data-roulette-trigger], .roulette-trigger-btn');
    if (rouletteButton) {
      rouletteButton.dataset.rouletteTrigger = 'true';
      rouletteButton.setAttribute('aria-haspopup', 'dialog');
      rouletteButton.setAttribute('aria-controls', 'luxury-roulette-title');
    }

    this.buildDots();
    this.updateAllItems(this.currentIndex, 0);
    this.resources.raf(() => this.syncStageBounds());
    this.setupKeyboardNavigation();
    this.setupPointerInteractions();
    this.setupTouchInteractions();
    this.setupWheelNavigation();
    this.setupItemInteractions();
    this.setupNavigationButtons();
    this.setupRouletteButton();
    this.setupResizeHandling();

    this.persistRememberedIndex(this.currentIndex);

    if (this.config.autoplay && this.profile.tier !== 'reduced') {
      this.startAutoplay();
    }

    this.announceCurrentSlide();
  }

  resolveViewportTuning() {
    const isNoHeaderSurface = this.container.classList.contains('coverflow-section--no-header');
    if (!isNoHeaderSurface) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let activeScale = CANONICAL_PREMIUM_POSITIONS.center.scale;

    if (viewportHeight <= 940) activeScale = 1.23;
    if (viewportHeight <= 860 || (viewportWidth <= 1200 && viewportHeight <= 920)) activeScale = 1.2;
    if (viewportHeight <= 780 || (viewportWidth <= 1100 && viewportHeight <= 900)) activeScale = 1.16;
    if (viewportHeight <= 760 || (viewportWidth <= 1180 && viewportHeight <= 820)) {
      activeScale = Math.min(activeScale, 1.13);
    }
    if (viewportWidth <= 640) activeScale = viewportHeight <= 720 ? 1.11 : 1.14;
    if (viewportWidth <= 430 && viewportHeight <= 700) {
      activeScale = Math.min(activeScale, 1.1);
    }

    const clampedScale = clamp(activeScale, 1.1, CANONICAL_PREMIUM_POSITIONS.center.scale);
    const scaleDelta = CANONICAL_PREMIUM_POSITIONS.center.scale - clampedScale;
    let centerTranslateY = CANONICAL_PREMIUM_POSITIONS.center.translateY - Math.round(scaleDelta * 68);
    if (viewportHeight <= 760) centerTranslateY += 4;
    if (viewportWidth <= 430 && viewportHeight <= 700) centerTranslateY += 8;
    centerTranslateY = clamp(centerTranslateY, -16, 8);

    return {
      activeScale: clampedScale,
      centerTranslateY
    };
  }

  applyViewportTuning() {
    this.viewportTuning = this.resolveViewportTuning();

    if (!this.viewportTuning) {
      this.container.style.removeProperty('--coverflow-active-scale');
      return;
    }

    const roundedScale = Math.round(this.viewportTuning.activeScale * 1000) / 1000;
    this.container.style.setProperty('--coverflow-active-scale', String(roundedScale));
  }

  getEngineConfig() {
    const isCompactViewport = window.innerWidth < 960;
    const isCanonicalGeometry = this.config.geometryProfile === 'about-premium'
      || this.config.geometryProfile === 'canonical-premium';
    const isGalleryStandardGeometry = this.config.geometryProfile === 'gallery-standard';
    const config = {
      infiniteLoop: this.config.infiniteLoop
    };

    if (isCanonicalGeometry) {
      const tuning = this.viewportTuning || this.resolveViewportTuning();
      const isNoHeaderSurface = this.container.classList.contains('coverflow-section--no-header');
      if (isNoHeaderSurface) {
        const resolvedScale = tuning?.activeScale ?? CANONICAL_PREMIUM_POSITIONS.center.scale;
        const resolvedTranslateY = tuning?.centerTranslateY ?? CANONICAL_PREMIUM_POSITIONS.center.translateY;
        config.positions = buildAboutNoHeaderBalancedPositions(
          resolvedScale,
          resolvedTranslateY,
          window.innerWidth
        );
      } else {
        config.positions = tuning
          ? buildCanonicalPositions(tuning.activeScale, tuning.centerTranslateY)
          : CANONICAL_PREMIUM_POSITIONS;
      }
      return config;
    }

    if (isGalleryStandardGeometry) {
      config.positions = GALLERY_STANDARD_POSITIONS;
      return config;
    }

    if (isCompactViewport) {
      config.positions = MOBILE_POSITIONS;
    }

    return config;
  }

  ensureLiveRegion() {
    const existing = this.container.querySelector('.sr-live-region');
    if (existing) return existing;

    const region = createElement('div', 'sr-only sr-live-region');
    liveRegionCounter += 1;
    region.id = `coverflow-live-region-${liveRegionCounter}`;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    this.container.appendChild(region);
    return region;
  }

  resolveItemTitle(item, fallbackIndex = this.currentIndex) {
    if (!item) return `Slide ${fallbackIndex + 1}`;
    if (typeof this.callbacks.resolveItemTitle === 'function') {
      const resolvedTitle = this.callbacks.resolveItemTitle(item, fallbackIndex, this);
      if (resolvedTitle) return String(resolvedTitle);
    }

    return item.dataset.title
      || item.getAttribute('aria-label')
      || item.querySelector('.card-title')?.textContent?.trim()
      || item.querySelector('img')?.alt?.trim()
      || `Slide ${fallbackIndex + 1}`;
  }

  announce(message, mode = 'polite') {
    if (!this.liveRegion) return;
    this.liveRegion.setAttribute('aria-live', mode);
    this.liveRegion.textContent = '';
    this.resources.raf(() => {
      this.liveRegion.textContent = message;
    });
  }

  announceCurrentSlide() {
    const card = this.items[this.currentIndex];
    if (!card) return;
    const title = this.resolveItemTitle(card, this.currentIndex);
    this.announce(`Now showing ${title}`);
  }

  emitSlideChange(index = this.currentIndex) {
    if (typeof this.callbacks.onSlideChange !== 'function') return;
    this.callbacks.onSlideChange(index, this);
  }

  updatePagination(position = this.currentIndex) {
    const current = this.selectors.paginationCurrent ? this.container.querySelector(this.selectors.paginationCurrent) : null;
    const total = this.selectors.paginationTotal ? this.container.querySelector(this.selectors.paginationTotal) : null;
    const activeIndex = this.getNearestIndex(position);
    if (current) current.textContent = String(activeIndex + 1);
    if (total) total.textContent = String(this.items.length);
  }

  getNearestIndex(position = this.previewIndex) {
    const fallbackPosition = Number.isFinite(position) ? position : this.currentIndex;
    return normalizeIndex(Math.round(fallbackPosition), this.items.length, this.config.infiniteLoop);
  }

  getContinuousTargetPosition(targetIndex) {
    if (!this.config.infiniteLoop || this.items.length <= 1) {
      return normalizeIndex(targetIndex, this.items.length, false);
    }

    const currentPosition = Number.isFinite(this.previewIndex) ? this.previewIndex : this.currentIndex;
    const loopSize = this.items.length;
    const normalizedTarget = normalizeIndex(targetIndex, loopSize, true);
    const loopBase = Math.round(currentPosition / loopSize);
    const candidates = [
      normalizedTarget + (loopBase - 1) * loopSize,
      normalizedTarget + loopBase * loopSize,
      normalizedTarget + (loopBase + 1) * loopSize
    ];

    return candidates.reduce((best, candidate) => (
      Math.abs(candidate - currentPosition) < Math.abs(best - currentPosition) ? candidate : best
    ));
  }

  clearPositionTween() {
    if (!this.positionTween) return;
    this.positionTween.kill();
    this.positionTween = null;
  }

  beginAnimation(durationMs) {
    this.animationCycle += 1;
    const cycleId = this.animationCycle;

    this.resources.clearTimeout(this.animationTimeout);
    this.animationTimeout = null;
    this.isAnimating = durationMs > 0;

    if (durationMs > 0) {
      const timeoutMs = Math.max(180, durationMs + this.motion.settleMs + 96);
      this.animationTimeout = this.resources.timeout(() => {
        this.finishAnimation(cycleId);
      }, timeoutMs);
    }

    return cycleId;
  }

  finishAnimation(cycleId = this.animationCycle) {
    if (cycleId !== this.animationCycle) return;

    this.resources.clearTimeout(this.animationTimeout);
    this.animationTimeout = null;
    this.positionTween = null;
    this.isAnimating = false;
    this.items.forEach((item) => {
      item.style.willChange = 'auto';
    });

    if (typeof this.pendingTarget === 'number') {
      const queuedTarget = this.pendingTarget;
      this.pendingTarget = null;
      this.resources.raf(() => {
        this.goToSlide(queuedTarget, { durationMs: this.getDiscreteNavigationDuration() });
      });
    }
  }

  buildDots() {
    if (!this.dotContainer) return;

    const dotCount = Math.min(this.items.length, Math.max(0, this.config.maxVisibleDots || this.items.length));
    if (dotCount <= 0) return;

    this.dotContainer.innerHTML = '';
    this.dots = Array.from({ length: dotCount }, (_, slotIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.dataset.dotSlot = String(slotIndex);
      this.resources.listen(dot, 'click', () => {
        const targetIndex = this.dotTargets[slotIndex];
        if (Number.isInteger(targetIndex)) {
          this.goToSlide(targetIndex);
        }
      });
      this.dotContainer.appendChild(dot);
      return dot;
    });
  }

  updateDots() {
    if (!this.dots.length) return;

    const dotCount = this.dots.length;
    const activeIndex = this.getNearestIndex();
    const maxStart = Math.max(0, this.items.length - dotCount);
    const windowStart = this.items.length <= dotCount
      ? 0
      : clamp(activeIndex - Math.floor(dotCount / 2), 0, maxStart);

    this.dotTargets = this.dots.map((_, slotIndex) => windowStart + slotIndex);
    this.dots.forEach((dot, slotIndex) => {
      const targetIndex = this.dotTargets[slotIndex];
      const targetItem = this.items[targetIndex];
      const isActive = targetIndex === activeIndex;
      const label = this.resolveItemTitle(targetItem, targetIndex);

      dot.classList.toggle('active', isActive);
      dot.textContent = targetItem ? String(targetIndex + 1) : '';
      dot.setAttribute('aria-label', `Go to ${label}`);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      dot.dataset.index = String(targetIndex);
      dot.hidden = !targetItem;
    });
  }

  syncItemDescendantInteractivity(item, enabled) {
    const interactiveNodes = item.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]');

    interactiveNodes.forEach((node) => {
      if (!node.hasAttribute('data-prev-tabindex')) {
        node.setAttribute('data-prev-tabindex', node.hasAttribute('tabindex') ? node.getAttribute('tabindex') : '__none__');
      }

      if (enabled) {
        const previousTabIndex = node.getAttribute('data-prev-tabindex');
        if (previousTabIndex === '__none__') {
          node.removeAttribute('tabindex');
        } else {
          node.setAttribute('tabindex', previousTabIndex);
        }
        if (node.tagName === 'A' && !node.hasAttribute('href') && node.hasAttribute('data-prev-href')) {
          node.setAttribute('href', node.getAttribute('data-prev-href'));
        }
        node.style.removeProperty('pointer-events');
        return;
      }

      if (node.tagName === 'A' && node.hasAttribute('href')) {
        if (!node.hasAttribute('data-prev-href')) {
          node.setAttribute('data-prev-href', node.getAttribute('href'));
        }
        node.removeAttribute('href');
      }
      node.setAttribute('tabindex', '-1');
      node.style.setProperty('pointer-events', 'none');
    });
  }

  applyItemState(item, index, centerIndex, transform) {
    const roundedCenter = normalizeIndex(Math.round(centerIndex), this.items.length, this.config.infiniteLoop);
    const distance = getDistance(index, centerIndex, this.items.length, this.config.infiniteLoop);
    const isCenter = index === roundedCenter;
    const isAdjacent = !isCenter && distance < 1.6;
    const hidden = distance > 4.1;

    item.classList.toggle('is-center', isCenter);
    item.classList.toggle('is-adjacent', isAdjacent);
    item.classList.toggle(this.config.activeStateClass, isCenter);
    item.setAttribute('aria-current', isCenter ? 'true' : 'false');
    item.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    item.setAttribute('aria-label', `${this.resolveItemTitle(item, index)} (${index + 1} of ${this.items.length})`);
    item.tabIndex = isCenter ? 0 : -1;
    this.syncItemDescendantInteractivity(item, isCenter);

    gsap.set(item, { zIndex: transform.zIndex });
  }

  updateAllItems(centerIndex, durationMs = this.motion.slideMs) {
    const durationSeconds = durationMs / 1000;
    const cycleId = this.beginAnimation(durationMs);

    this.clearPositionTween();
    gsap.killTweensOf(this.items);
    this.items.forEach((item) => {
      item.style.willChange = durationMs > 0 ? 'transform, opacity, filter' : 'auto';
    });

    const applyTransforms = (position) => {
      const transforms = this.engine3D.calculateAllTransforms(position, this.items.length, this.config.infiniteLoop);
      this.items.forEach((item, index) => {
        const transform = transforms[index];
        this.applyItemState(item, index, position, transform);
        gsap.set(item, {
          x: transform.translateX,
          y: transform.translateY || 0,
          z: transform.translateZ,
          rotationY: transform.rotateY,
          scale: transform.scale,
          opacity: transform.opacity,
          filter: this.engine3D.getFilterString(transform.filter),
          force3D: true
        });
      });
      this.updateDots();
    };

    if (durationMs === 0) {
      const settledPosition = this.currentIndex;
      this.previewIndex = settledPosition;
      this.wheelState.previewPosition = settledPosition;
      applyTransforms(settledPosition);
      this.updatePagination(settledPosition);
      this.emitSlideChange(this.getNearestIndex(settledPosition));
      this.syncStageBounds();
      this.finishAnimation(cycleId);
      return;
    }

    const startPosition = Number.isFinite(this.previewIndex) ? this.previewIndex : this.currentIndex;
    const tweenState = { position: startPosition };
    this.isAnimating = true;
    this.updatePagination(centerIndex);

    this.positionTween = gsap.to(tweenState, {
      position: centerIndex,
      duration: durationSeconds,
      ease: this.config.animationEase,
      onUpdate: () => {
        this.previewIndex = tweenState.position;
        this.wheelState.previewPosition = tweenState.position;
        applyTransforms(tweenState.position);
        this.updatePagination(tweenState.position);
      },
      onComplete: () => {
        const settledPosition = this.currentIndex;
        this.previewIndex = settledPosition;
        this.wheelState.previewPosition = settledPosition;
        applyTransforms(settledPosition);
        this.updatePagination(settledPosition);
        this.emitSlideChange(this.currentIndex);
        this.syncStageBounds();
        this.finishAnimation(cycleId);
      },
      onInterrupt: () => {
        this.syncStageBounds();
        this.finishAnimation(cycleId);
      }
    });
  }

  updateContinuousPosition(position) {
    this.previewIndex = position;
    this.wheelState.previewPosition = position;
    const transforms = this.engine3D.calculateAllTransforms(position, this.items.length, this.config.infiniteLoop);
    this.items.forEach((item, index) => {
      const transform = transforms[index];
      this.applyItemState(item, index, position, transform);
      gsap.set(item, {
        x: transform.translateX,
        y: transform.translateY || 0,
        z: transform.translateZ,
        rotationY: transform.rotateY,
        scale: transform.scale,
        opacity: transform.opacity,
        filter: this.engine3D.getFilterString(transform.filter),
        force3D: true
      });
    });
    this.updateDots();
    this.updatePagination(position);
  }

  setAnimating(durationMs) {
    this.isAnimating = true;
    this.resources.clearTimeout(this.animationTimeout);
    this.animationTimeout = this.resources.timeout(() => {
      this.isAnimating = false;
      this.items.forEach((item) => {
        item.style.willChange = 'auto';
      });
      if (typeof this.pendingTarget === 'number') {
        const queuedTarget = this.pendingTarget;
        this.pendingTarget = null;
        this.goToSlide(queuedTarget);
      }
    }, durationMs + 48);
  }

  goToSlide(targetIndex, options = {}) {
    const durationMs = typeof options.durationMs === 'number' ? options.durationMs : this.motion.slideMs;
    const announce = options.announce !== false;
    const normalizedTarget = normalizeIndex(targetIndex, this.items.length, this.config.infiniteLoop);
    const continuousTarget = this.getContinuousTargetPosition(normalizedTarget);
    const currentNearest = this.getNearestIndex();

    if (normalizedTarget === currentNearest && durationMs !== 0 && Math.abs(continuousTarget - (this.previewIndex ?? this.currentIndex)) < 0.001) {
      this.previewIndex = normalizedTarget;
      this.wheelState.previewPosition = normalizedTarget;
      return;
    }

    this.pendingTarget = null;
    this.currentIndex = normalizedTarget;
    this.persistRememberedIndex(this.currentIndex);
    this.updateAllItems(continuousTarget, durationMs);
    this.resetAutoplay();
    if (announce) this.announceCurrentSlide();
  }

  getDiscreteNavigationDuration() {
    // Gallery carousels use the full slideMs for smooth cinematic transitions
    if (this.config.surface === 'luxury-coverflow') return this.motion.slideMs;
    return Math.min(220, this.motion.slideMs || 220);
  }

  next() {
    const baseIndex = typeof this.pendingTarget === 'number' ? this.pendingTarget : this.currentIndex;
    this.pendingTarget = null;
    this.goToSlide(baseIndex + 1, { durationMs: this.getDiscreteNavigationDuration() });
  }

  prev() {
    const baseIndex = typeof this.pendingTarget === 'number' ? this.pendingTarget : this.currentIndex;
    this.pendingTarget = null;
    this.goToSlide(baseIndex - 1, { durationMs: this.getDiscreteNavigationDuration() });
  }

  pulseCurrentCard() {
    const current = this.items[this.currentIndex];
    if (!current) return;

    gsap.fromTo(
      current,
      { scale: 1 },
      { scale: 1.025, duration: this.motion.settleMs / 1000, repeat: 1, yoyo: true, ease: 'power1.out' }
    );
  }

  getGestureSurfaceNodes() {
    return Array.from(new Set([
      this.container,
      this.track,
      this.container.querySelector('.coverflow-perspective'),
      this.container.closest('.coverflow-section')
    ].filter(Boolean)));
  }

  resetInteractionState() {
    this.clearPositionTween();
    this.resources.clearTimeout(this.wheelState.settleTimeout);
    this.wheelState.accumulator = 0;
    this.wheelState.previewPosition = this.currentIndex;
    this.wheelState.axisLock = null;
    this.wheelState.lastInputAt = 0;
    this.previewIndex = this.currentIndex;
    this.pendingTarget = null;
    this.isAnimating = false;
    this.dragState.isDragging = false;
    this.dragState.axisLocked = null;
    this.dragState.sequence = null;
    this.dragState.rafPending = false;
    this.activePointerId = null;
    this.container.classList.remove('is-dragging');
  }

  setupKeyboardNavigation() {
    if (!this.config.enableKeyboard) return;

    this.resources.listen(document, 'keydown', (event) => {
      if (this.roulette?.isActive) return;
      if (event.defaultPrevented) return;

      const activeElement = document.activeElement;
      const isTypingContext = activeElement && (
        activeElement.matches?.('input, textarea, select, [contenteditable="true"]')
        || activeElement.closest?.('[contenteditable="true"]')
      );
      if (isTypingContext) return;

      const containerHasFocus = this.container.contains(activeElement);
      const containerHasHover = !isCoarsePointerDevice() && this.container.matches(':hover');
      const premiumCarousels = document.querySelectorAll('[data-luxury-coverflow]');
      const allowSoleCarouselKeyboard = premiumCarousels.length === 1;
      if (!containerHasFocus && !containerHasHover && !allowSoleCarouselKeyboard) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.prev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.next();
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.goToSlide(0, { durationMs: this.getDiscreteNavigationDuration() });
      } else if (event.key === 'End') {
        event.preventDefault();
        this.goToSlide(this.items.length - 1, { durationMs: this.getDiscreteNavigationDuration() });
      }
    });
  }

  setupPointerInteractions() {
    if (!this.config.enableMouse) return;

    if (typeof window !== 'undefined' && 'PointerEvent' in window) {
      this.resources.listen(this.track, 'pointerdown', (event) => {
        const isMousePointer = event.pointerType === 'mouse';
        const isTouchPointer = event.pointerType === 'touch' || event.pointerType === 'pen';

        if (isMousePointer && event.button !== 0) return;
        if (isMousePointer && !this.config.enableMouse) return;
        if (isTouchPointer && !this.config.enableTouch) return;
        if (event.target.closest('button, a, [data-no-drag]')) return;

        this.activePointerId = event.pointerId;
        try {
          event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch (error) {}
        if (isTouchPointer) {
          this.lastPointerTouchAt = performance.now();
          event.preventDefault();
        }

        this.startDrag(event.clientX, event.clientY, event.target);
      }, { passive: false });

      this.resources.listen(document, 'pointermove', (event) => {
        if (!this.dragState.isDragging) return;
        if (this.activePointerId != null && event.pointerId !== this.activePointerId) return;

        this.updateDrag(event.clientX, event.clientY);
        if (this.dragState.axisLocked === 'horizontal' && event.cancelable) {
          event.preventDefault();
        }
      }, { passive: false });

      const finishPointerDrag = (event) => {
        if (this.activePointerId != null && event.pointerId !== this.activePointerId) return;
        try {
          this.track.releasePointerCapture?.(event.pointerId);
        } catch (error) {}
        this.activePointerId = null;
        if (this.dragState.isDragging) this.endDrag();
      };

      this.resources.listen(document, 'pointerup', finishPointerDrag, { passive: true });
      this.resources.listen(document, 'pointercancel', finishPointerDrag, { passive: true });
      return;
    }

    this.resources.listen(this.track, 'mousedown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button, a, [data-no-drag]')) return;
      event.preventDefault();
      this.startDrag(event.clientX, event.clientY, event.target);
    });

    this.resources.listen(document, 'mousemove', (event) => {
      if (!this.dragState.isDragging) return;
      this.updateDrag(event.clientX, event.clientY);
    });

    this.resources.listen(document, 'mouseup', () => {
      if (this.dragState.isDragging) this.endDrag();
    });
  }

  setupTouchInteractions() {
    if (!this.config.enableTouch) return;

    this.resources.listen(this.track, 'touchstart', (event) => {
      if (performance.now() - this.lastPointerTouchAt < 500) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      this.startDrag(touch.clientX, touch.clientY, event.target);
    }, { passive: true });

    this.resources.listen(this.track, 'touchmove', (event) => {
      const touch = event.touches?.[0];
      if (!touch || !this.dragState.isDragging) return;
      this.updateDrag(touch.clientX, touch.clientY);
      if (this.dragState.axisLocked === 'horizontal') {
        event.preventDefault();
      }
    }, { passive: false });

    const endTouch = () => {
      if (this.dragState.isDragging) this.endDrag();
    };

    this.resources.listen(this.track, 'touchend', endTouch, { passive: true });
    this.resources.listen(this.track, 'touchcancel', endTouch, { passive: true });
  }

  setupWheelNavigation() {
    if (!this.config.enableScroll) return;

    const WHEEL_SEQUENCE_GAP_MS = 160;
    const HORIZONTAL_INTENT_MIN_DELTA = 1;
    const HORIZONTAL_INTENT_RATIO = 0.65;
    const STRONG_HORIZONTAL_MIN_DELTA = 6;
    const VERTICAL_RELEASE_MIN_DELTA = 10;
    const VERTICAL_RELEASE_RATIO = 1.8;

    const handleWheel = (event) => {
      if (this.roulette?.isActive) return;
      if (event.ctrlKey) return;

      const now = performance.now();
      if (now - this.wheelState.lastInputAt > WHEEL_SEQUENCE_GAP_MS) {
        this.wheelState.axisLock = null;
      }
      this.wheelState.lastInputAt = now;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      if (this.wheelState.axisLock !== 'horizontal') {
        const hasHorizontalDelta = absX >= HORIZONTAL_INTENT_MIN_DELTA;
        const horizontalBias = hasHorizontalDelta && absX >= absY * HORIZONTAL_INTENT_RATIO;
        const strongHorizontalIntent = absX >= STRONG_HORIZONTAL_MIN_DELTA && absX >= absY * 1.05;

        if (!(strongHorizontalIntent || horizontalBias) || !event.cancelable) {
          return;
        }

        this.wheelState.axisLock = 'horizontal';
      }

      if (absY >= VERTICAL_RELEASE_MIN_DELTA && absY > absX * VERTICAL_RELEASE_RATIO) {
        this.wheelState.axisLock = null;
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
      this.stopAutoplay();
      this.wheelState.accumulator += event.deltaX;

      if (this.motion.enableSmoothTracking) {
        let previewPosition = this.previewIndex + event.deltaX * this.motion.scrollSensitivity;
        previewPosition = normalizeIndex(previewPosition, this.items.length, this.config.infiniteLoop);
        this.previewIndex = previewPosition;
        this.wheelState.previewPosition = previewPosition;
        this.updateContinuousPosition(previewPosition);
      }

      this.resources.clearTimeout(this.wheelState.settleTimeout);
      this.wheelState.settleTimeout = this.resources.timeout(() => {
        let targetIndex = this.motion.enableSmoothTracking
          ? this.getNearestIndex(this.previewIndex)
          : this.currentIndex;

        if (!this.motion.enableSmoothTracking && Math.abs(this.wheelState.accumulator) >= this.motion.scrollThreshold) {
          targetIndex += this.wheelState.accumulator > 0 ? 1 : -1;
        }

        this.wheelState.accumulator = 0;
        this.wheelState.axisLock = null;
        this.wheelState.lastInputAt = 0;
        this.goToSlide(targetIndex, { durationMs: this.motion.settleMs });
      }, 110);
    };

    this.getGestureSurfaceNodes().forEach((node) => {
      this.resources.listen(node, 'wheel', handleWheel, { passive: false, capture: true });
    });
  }

  startDrag(clientX, clientY, target) {
    if (target?.closest('button, a, [data-no-drag]')) return;

    this.dragSequence += 1;
    const startPosition = this.currentIndex;
    const startIndex = this.getNearestIndex(startPosition);

    this.pendingTarget = null;
    this.clearPositionTween();
    this.resources.clearTimeout(this.animationTimeout);
    this.animationTimeout = null;
    this.isAnimating = false;
    this.positionTween = null;
    this.previewIndex = startPosition;
    this.wheelState.previewPosition = startPosition;
    this.updateContinuousPosition(startPosition);

    this.dragState = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      axisLocked: null,
      startPosition,
      startIndex,
      previewPosition: startPosition,
      sequence: this.dragSequence,
      rafPending: false,
      sourceTarget: target
    };

    this.physics.startDrag(clientX);
    this.stopAutoplay();
    this.container.classList.add('is-dragging');
  }

  resolveDragPreviewPosition(currentX = this.dragState.currentX) {
    const startPosition = Number.isFinite(this.dragState.startPosition)
      ? this.dragState.startPosition
      : (Number.isFinite(this.previewIndex) ? this.previewIndex : this.currentIndex);
    const deltaSlides = (this.dragState.startX - currentX) / this.motion.dragPixelsPerSlide;
    const previewPosition = startPosition + deltaSlides;
    if (this.config.infiniteLoop) return previewPosition;
    return clamp(previewPosition, 0, this.items.length - 1);
  }

  resolveDragReleaseTarget() {
    const DEAD_ZONE_DISTANCE = 0.24;
    const DEAD_ZONE_VELOCITY = 0.0018;
    const COMMIT_DISTANCE = 0.45;
    const COMMIT_VELOCITY = 0.003;
    const VELOCITY_PROJECTION_MS = 120;
    const STRONG_DISTANCE_MULTI_SKIP = 2.8;
    const MAX_SKIP_STEPS = 2;

    const startPosition = Number.isFinite(this.dragState.startPosition)
      ? this.dragState.startPosition
      : this.currentIndex;
    const startIndex = Number.isFinite(this.dragState.startIndex)
      ? this.dragState.startIndex
      : this.getNearestIndex(startPosition);
    const releasePreview = this.resolveDragPreviewPosition(this.dragState.currentX);
    const dragDeltaSlides = releasePreview - startPosition;
    const velocitySlides = -(this.physics.velocity / this.motion.dragPixelsPerSlide);
    const projectedPosition = releasePreview + velocitySlides * VELOCITY_PROJECTION_MS;
    const projectedDeltaSlides = projectedPosition - startPosition;

    let direction = Math.sign(projectedDeltaSlides);
    if (direction === 0) direction = Math.sign(dragDeltaSlides);
    if (direction === 0) direction = Math.sign(velocitySlides);

    if (direction === 0) {
      return startIndex;
    }

    const dragDistance = Math.abs(dragDeltaSlides);
    const dragVelocity = Math.abs(velocitySlides);

    if (dragDistance < DEAD_ZONE_DISTANCE && dragVelocity < DEAD_ZONE_VELOCITY) {
      return startIndex;
    }

    const projectedDistance = Math.abs(projectedDeltaSlides);
    if (projectedDistance < COMMIT_DISTANCE && dragVelocity < COMMIT_VELOCITY) {
      return startIndex;
    }

    let stepCount = 1;
    const allowMultiSkip = dragDistance >= STRONG_DISTANCE_MULTI_SKIP;
    if (allowMultiSkip) {
      stepCount = MAX_SKIP_STEPS;
    }

    const rawTargetIndex = startIndex + direction * stepCount;
    if (this.config.infiniteLoop) {
      return normalizeIndex(rawTargetIndex, this.items.length, true);
    }
    return clamp(rawTargetIndex, 0, this.items.length - 1);
  }

  updateDrag(clientX, clientY) {
    if (!this.dragState.isDragging) return;

    const AXIS_DECISION_THRESHOLD = 10;
    const AXIS_LOCK_RATIO = 1.18;

    const absX = Math.abs(clientX - this.dragState.startX);
    const absY = Math.abs(clientY - this.dragState.startY);
    if (this.dragState.axisLocked == null) {
      if (absX < AXIS_DECISION_THRESHOLD && absY < AXIS_DECISION_THRESHOLD) return;

      const horizontalIntent = absX >= AXIS_DECISION_THRESHOLD && absX > absY * AXIS_LOCK_RATIO;
      const verticalIntent = absY >= AXIS_DECISION_THRESHOLD && absY > absX * AXIS_LOCK_RATIO;
      if (!horizontalIntent && !verticalIntent) return;

      this.dragState.axisLocked = horizontalIntent ? 'horizontal' : 'vertical';
      if (this.dragState.axisLocked === 'vertical') {
        this.dragState.isDragging = false;
        this.container.classList.remove('is-dragging');
        return;
      }
    }

    if (this.dragState.axisLocked !== 'horizontal') return;

    this.dragState.currentX = clientX;
    this.dragState.currentY = clientY;
    this.physics.updateDrag(clientX);

    if (this.dragState.rafPending) return;
    this.dragState.rafPending = true;
    const dragSequence = this.dragState.sequence;
    this.resources.raf(() => {
      if (!this.dragState.isDragging || this.dragState.sequence !== dragSequence) {
        this.dragState.rafPending = false;
        return;
      }

      const previewPosition = this.resolveDragPreviewPosition(this.dragState.currentX);
      this.dragState.previewPosition = previewPosition;
      this.previewIndex = previewPosition;
      this.updateContinuousPosition(previewPosition);
      this.dragState.rafPending = false;
    });
  }

  endDrag() {
    const dragDistancePx = Math.abs(this.dragState.currentX - this.dragState.startX);
    const startIndex = Number.isFinite(this.dragState.startIndex)
      ? this.dragState.startIndex
      : this.currentIndex;
    const releasePreview = this.resolveDragPreviewPosition(this.dragState.currentX);
    this.dragState.previewPosition = releasePreview;
    this.previewIndex = releasePreview;

    const targetIndex = this.resolveDragReleaseTarget();
    const didChangeCard = targetIndex !== startIndex;

    if (didChangeCard || dragDistancePx >= 10) {
      // Touch browsers may emit a trailing click after a drag; suppress it briefly.
      this.suppressClickUntil = performance.now() + 420;
    }

    this.dragState.isDragging = false;
    this.dragState.axisLocked = null;
    this.dragState.sequence = null;
    this.dragState.rafPending = false;
    this.dragState.startPosition = this.currentIndex;
    this.dragState.startIndex = this.currentIndex;
    this.dragState.previewPosition = this.currentIndex;
    this.container.classList.remove('is-dragging');
    this.goToSlide(targetIndex, { durationMs: this.motion.settleMs });
  }

  setupItemInteractions() {
    this.items.forEach((item, index) => {
      this.resources.listen(item, 'click', (event) => {
        if (performance.now() < this.suppressClickUntil) {
          event.preventDefault();
          return;
        }
        if (index === this.currentIndex) {
          if (typeof this.callbacks.onActiveItemSelect === 'function') {
            event.preventDefault();
            this.callbacks.onActiveItemSelect(item, index, this, event);
          }
          return;
        }
        event.preventDefault();
        this.goToSlide(index);
      });

      this.resources.listen(item, 'keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.prev();
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.next();
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          this.goToSlide(0, { durationMs: this.getDiscreteNavigationDuration() });
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          this.goToSlide(this.items.length - 1, { durationMs: this.getDiscreteNavigationDuration() });
          return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (index === this.currentIndex) {
          if (typeof this.callbacks.onActiveItemSelect === 'function') {
            event.preventDefault();
            this.callbacks.onActiveItemSelect(item, index, this, event);
          }
          return;
        }
        event.preventDefault();
        this.goToSlide(index);
      });
    });
  }

  setupNavigationButtons() {
    const previousButton = this.container.querySelector(this.selectors.prevButton);
    const nextButton = this.container.querySelector(this.selectors.nextButton);

    if (previousButton) {
      this.resources.listen(previousButton, 'click', (event) => {
        event.stopPropagation();
        this.prev();
      });
    }

    if (nextButton) {
      this.resources.listen(nextButton, 'click', (event) => {
        event.stopPropagation();
        this.next();
      });
    }
  }

  setupRouletteButton() {
    const button = this.container.querySelector('[data-roulette-trigger], .roulette-trigger-btn');
    if (!button) return;

    this.resources.listen(button, 'click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.startRoulette();
    });
  }

  setupResizeHandling() {
    const refresh = () => {
      this.applyViewportTuning();
      this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
      this.updateAllItems(this.currentIndex, 0);
      this.roulette.refreshLayout();
      this.syncStageBounds();
    };

    let resizeTimeout = null;
    const handleResize = () => {
      this.resources.clearTimeout(resizeTimeout);
      resizeTimeout = this.resources.timeout(refresh, 120);
    };

    this.resources.listen(window, 'resize', handleResize, { passive: true });
    this.resources.listen(window, 'orientationchange', handleResize, { passive: true });
    this.resources.listen(window, 'pageshow', (event) => {
      if (!event.persisted) return;
      this.resetInteractionState();
      gsap.killTweensOf(this.items);
      this.resources.raf(() => refresh());
    }, { passive: true });
    this.resources.listen(document, 'visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.resources.raf(() => refresh());
    });

    if ('ResizeObserver' in window) {
      const observer = this.resources.observe(new ResizeObserver(handleResize));
      observer.observe(this.container);
    }
  }

  syncStageBounds() {
    const stage = this.container.querySelector('.coverflow-container');
    const active = this.items[this.currentIndex];
    if (!stage || !active) return;

    const safePadding = this.viewportTuning ? 10 : 16;
    stage.style.setProperty('--coverflow-dynamic-height', '0px');
    stage.style.setProperty('--coverflow-dynamic-top', '0px');
    stage.style.setProperty('--coverflow-dynamic-bottom', '0px');

    const stageRect = stage.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const topOverflow = Math.max(0, stageRect.top + safePadding - activeRect.top);
    const bottomOverflow = Math.max(0, activeRect.bottom - (stageRect.bottom - safePadding));
    const neededHeight = Math.ceil(stageRect.height + topOverflow + bottomOverflow);

    stage.style.setProperty('--coverflow-dynamic-top', `${Math.ceil(topOverflow)}px`);
    stage.style.setProperty('--coverflow-dynamic-bottom', `${Math.ceil(bottomOverflow)}px`);
    stage.style.setProperty('--coverflow-dynamic-height', `${neededHeight}px`);
  }

  startAutoplay() {
    if (!this.config.autoplay || this.autoplayInterval) return;
    this.autoplayInterval = this.resources.interval(() => this.next(), this.config.autoplayDelay);
  }

  stopAutoplay() {
    if (!this.autoplayInterval) return;
    this.resources.clearInterval(this.autoplayInterval);
    this.autoplayInterval = null;
  }

  resetAutoplay() {
    this.stopAutoplay();
    this.startAutoplay();
  }

  async startRoulette() {
    if (this.roulette.isSpinning) return;
    await this.roulette.start();
  }

  refreshLayout() {
    this.applyViewportTuning();
    this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
    this.updateAllItems(this.currentIndex, 0);
    this.roulette.refreshLayout();
    this.syncStageBounds();
  }

  destroy() {
    this.stopAutoplay();
    this.resources.destroy();
    this.physics.destroy();
    this.roulette.destroy();
    gsap.killTweensOf(this.items);
    this.container.dataset.coverflowReady = 'false';
  }

  getState() {
    return {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      isAnimating: this.isAnimating,
      rouletteActive: this.roulette?.isActive || false,
      rouletteSpinning: this.roulette?.isSpinning || false,
      tier: this.profile.tier
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const autoMount = document.querySelector('[data-luxury-coverflow-auto]');
  if (!autoMount) return;
  window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]');
});
