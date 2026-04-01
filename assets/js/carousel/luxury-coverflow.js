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
    slideMs: 560,
    settleMs: 320,
    introMs: 340,
    spinMs: 5200,
    dialogMs: 320,
    scrollSensitivity: 0.0035,
    scrollThreshold: 34,
    dragPixelsPerSlide: 255,
    staggerDelay: 0.02,
    reflectionOpacity: 0.22,
    glowStrength: 1,
    rouletteMode: 'premium',
    enableSmoothTracking: true,
    blurStrength: 1
  },
  enhanced: {
    tierClass: 'enhanced',
    slideMs: 500,
    settleMs: 280,
    introMs: 280,
    spinMs: 4600,
    dialogMs: 280,
    scrollSensitivity: 0.0032,
    scrollThreshold: 32,
    dragPixelsPerSlide: 245,
    staggerDelay: 0.015,
    reflectionOpacity: 0.16,
    glowStrength: 0.82,
    rouletteMode: 'full',
    enableSmoothTracking: true,
    blurStrength: 0.65
  },
  baseline: {
    tierClass: 'baseline',
    slideMs: 420,
    settleMs: 220,
    introMs: 220,
    spinMs: 3400,
    dialogMs: 220,
    scrollSensitivity: 0.0028,
    scrollThreshold: 28,
    dragPixelsPerSlide: 228,
    staggerDelay: 0.006,
    reflectionOpacity: 0,
    glowStrength: 0.3,
    rouletteMode: 'lite',
    enableSmoothTracking: false,
    blurStrength: 0.2
  },
  reduced: {
    tierClass: 'reduced',
    slideMs: 200,
    settleMs: 140,
    introMs: 160,
    spinMs: 1400,
    dialogMs: 160,
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

const MOBILE_POSITIONS = {
  center: {
    rotateY: 0,
    translateZ: 0,
    translateX: 0,
    scale: 1,
    opacity: 1,
    zIndex: 100,
    blur: 0,
    brightness: 1.04,
    saturate: 1.04
  },
  adjacent1: {
    rotateY: 14,
    translateZ: -42,
    translateX: 220,
    scale: 0.9,
    opacity: 0.82,
    zIndex: 90,
    blur: 0,
    brightness: 0.92,
    saturate: 1
  },
  adjacent2: {
    rotateY: 34,
    translateZ: -190,
    translateX: 430,
    scale: 0.7,
    opacity: 0.34,
    zIndex: 80,
    blur: 1,
    brightness: 0.84,
    saturate: 0.95
  },
  adjacent3: {
    rotateY: 44,
    translateZ: -300,
    translateX: 560,
    scale: 0.52,
    opacity: 0.1,
    zIndex: 70,
    blur: 2,
    brightness: 0.68,
    saturate: 0.9
  },
  far: {
    rotateY: 50,
    translateZ: -380,
    translateX: 660,
    scale: 0.4,
    opacity: 0,
    zIndex: 60,
    blur: 3,
    brightness: 0.55,
    saturate: 0.82
  }
};

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
      const backgroundNode = item.querySelector('.card-bg');
      const backgroundStyle = backgroundNode ? window.getComputedStyle(backgroundNode) : null;
      const background = backgroundStyle
        ? (backgroundStyle.backgroundImage !== 'none' ? backgroundStyle.backgroundImage : backgroundStyle.background)
        : 'linear-gradient(135deg, #212842, #3d4666)';
      const title = item.dataset.title || item.querySelector('.card-title')?.textContent?.trim() || 'Project';
      const category = item.querySelector('.card-category')?.textContent?.trim() || 'Selected Work';
      const link = item.querySelector('.card-link, a[href]')?.getAttribute('href') || '';
      return { background, title, category, link };
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
    window.location.href = link;
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
    const radius = frame.radius;
    const angleInRadians = (frame.ballAngle * Math.PI) / 180;
    const x = Math.cos(angleInRadians) * radius;
    const y = Math.sin(angleInRadians) * radius;

    gsap.set(this.elements.wheel, { rotation: frame.wheelRotation });
    gsap.set(this.elements.ball, { x, y });
    gsap.set(this.elements.ballHighlight, { x: x - 5, y: y - 5, opacity: 0.75 });
    gsap.set(this.elements.ballShadow, {
      x,
      y: y + 18,
      opacity: 0.45,
      scale: 0.82 + frame.progress * 0.18
    });

    let phase = 'final';
    let message = 'Picking the final pocket';
    if (frame.progress < 0.25) {
      phase = 'fast';
      message = 'Wheel at full speed';
    } else if (frame.progress < 0.65) {
      phase = 'settling';
      message = 'Settling into position';
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
      const stagger = this.carousel.motion.staggerDelay;
      gsap.fromTo(
        this.pockets.map((pocket) => pocket.root),
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: this.carousel.motion.introMs / 1000,
          stagger,
          ease: 'power2.out',
          onComplete: resolve
        }
      );
    });
  }

  async runSpinAnimation() {
    const wheelSpin = this.wheelEngine.calculateWheelSpin(this.result.winnerPocketIndex);
    // Slow the spin down for a more cinematic, premium feel
    const durationSeconds = Math.max(this.carousel.motion.spinMs / 1000, 5.2);
    const wheelRadius = parseFloat(getComputedStyle(this.overlay).getPropertyValue('--roulette-wheel-radius')) || 220;
    const frame = {
      wheelRotation: 0,
      ballAngle: 180,
      radius: wheelRadius * 1.16,
      progress: 0,
      wobble: 0
    };

    const renderFrame = () => {
      frame.progress = this.spinTween ? this.spinTween.progress() : frame.progress;
      // Add realistic ball wobble during deceleration phase
      const wobbleAmount = Math.sin(frame.ballAngle * 0.15) * frame.wobble;
      const adjustedRadius = frame.radius + wobbleAmount;
      this.renderSpinFrame({ ...frame, radius: adjustedRadius });
    };

    await new Promise((resolve) => {
      this.isSpinning = true;
      const totalBallRotation = wheelSpin.spins * 360 + 340;
      const firstLeg = durationSeconds * 0.45;
      const secondLeg = durationSeconds * 0.28;
      const thirdLeg = durationSeconds * 0.15;
      const finalLeg = Math.max(0.5, durationSeconds - firstLeg - secondLeg - thirdLeg);

      this.spinTween = gsap.timeline({
        onComplete: () => {
          this.spinTween = null;
          this.isSpinning = false;
          resolve();
        }
      });

      // Leg 1: Smooth, powerful acceleration — the croupier's launch
      this.spinTween.to(frame, {
        wheelRotation: -(wheelSpin.finalRotation * 0.62),
        ballAngle: frame.ballAngle - (totalBallRotation * 0.68),
        radius: wheelRadius * 1.08,
        wobble: 0,
        duration: firstLeg,
        ease: 'power2.in',
        onUpdate: renderFrame
      });

      // Leg 2: Graceful deceleration — the ball begins to spiral inward
      this.spinTween.to(frame, {
        wheelRotation: -(wheelSpin.finalRotation * 0.88),
        ballAngle: frame.ballAngle - (totalBallRotation * 0.22),
        radius: wheelRadius * 0.92,
        wobble: 4,
        duration: secondLeg,
        ease: 'power3.out',
        onUpdate: renderFrame
      });

      // Leg 3: Tension — the ball skips across pockets (realistic bouncing phase)
      this.spinTween.to(frame, {
        wheelRotation: -wheelSpin.finalRotation + 18,
        ballAngle: frame.ballAngle - (totalBallRotation * 0.07),
        radius: wheelRadius * 0.84,
        wobble: 6,
        duration: thirdLeg,
        ease: 'power2.out',
        onUpdate: renderFrame
      });

      // Leg 4: Final settle — ball drops into pocket with satisfying weight
      this.spinTween.to(frame, {
        wheelRotation: -wheelSpin.finalRotation,
        ballAngle: frame.ballAngle - (totalBallRotation * 0.03),
        radius: wheelRadius * 0.80,
        wobble: 0,
        duration: finalLeg,
        ease: 'elastic.out(1.1, 0.35)',
        onUpdate: renderFrame
      });
    });
  }

  async presentResult() {
    const winningPocket = this.pockets[this.result.winnerPocketIndex]?.root;
    if (winningPocket) {
      // Step 1: Winner pocket scales up with a dramatic golden glow reveal
      gsap.fromTo(
        winningPocket,
        { scale: 1, boxShadow: '0 0 0px rgba(201,167,109,0)' },
        {
          scale: 1.2,
          boxShadow: '0 0 48px rgba(201,167,109,0.75), 0 0 96px rgba(201,167,109,0.3)',
          duration: 0.5,
          repeat: 1,
          yoyo: true,
          ease: 'power2.inOut'
        }
      );

      // Flash highlight on the stage for cinematic reveal feel
      gsap.fromTo(
        this.elements.stage,
        { boxShadow: '0 0 0 0 rgba(201,167,109,0)' },
        {
          boxShadow: '0 0 80px 20px rgba(201,167,109,0.15)',
          duration: 0.6,
          yoyo: true,
          repeat: 1,
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
        const delayMs = Number.isFinite(this.carousel.config.rouletteAutoNavigateDelay)
          ? this.carousel.config.rouletteAutoNavigateDelay
          : 1200;

        this.autoNavigateTimer = this.resources.timeout(() => {
          if (!this.isActive || this.isSpinning) return;
          this.navigateToResultLink(preview.link);
        }, Math.max(400, delayMs));
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
      resolveItemTitle: null,
      ...options.callbacks
    };

    this.track = this.container.querySelector(this.selectors.track);
    this.items = Array.from(this.container.querySelectorAll(this.selectors.items));
    if (!this.track || this.items.length === 0) return;

    const profile = computePerformanceProfile();
    const resolvedTier = getReducedMotionPreference()
      ? 'reduced'
      : normalizeTier(options.performanceTier) || profile.tier;

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
      animationEase: 'power3.inOut',
      surface: 'default',
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

    this.currentIndex = normalizeIndex(this.config.initialIndex, this.items.length, this.config.infiniteLoop);
    this.previewIndex = this.currentIndex;
    this.pendingTarget = null;
    this.isAnimating = false;
    this.animationTimeout = null;
    this.positionTween = null;
    this.autoplayInterval = null;
    this.wheelState = {
      accumulator: 0,
      previewPosition: this.currentIndex,
      settleTimeout: null
    };
    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      axisLocked: null,
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
    this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
    this.dots = [];
    this.dotTargets = [];
    this.dotContainer = this.selectors.dots ? this.container.querySelector(this.selectors.dots) : null;
    const rouletteButton = this.container.querySelector('[data-roulette-trigger], .roulette-trigger-btn');
    this.roulette = rouletteButton ? new RouletteOverlayController(this) : createNoopRouletteController();

    this.liveRegion = this.ensureLiveRegion();
    this.init();
  }

  init() {
    this.container.dataset.coverflowReady = 'true';
    this.container.dataset.coverflowTier = this.profile.tier;
    this.container.dataset.coverflowSurface = this.config.surface;
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
    this.setupKeyboardNavigation();
    this.setupPointerInteractions();
    this.setupTouchInteractions();
    this.setupWheelNavigation();
    this.setupItemInteractions();
    this.setupNavigationButtons();
    this.setupRouletteButton();
    this.setupResizeHandling();

    if (this.config.autoplay && this.profile.tier !== 'reduced') {
      this.startAutoplay();
    }

    this.announceCurrentSlide();
  }

  getEngineConfig() {
    const isMobile = window.innerWidth < 640;
    const config = {
      infiniteLoop: this.config.infiniteLoop
    };

    if (isMobile) {
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

  updatePagination() {
    const current = this.selectors.paginationCurrent ? this.container.querySelector(this.selectors.paginationCurrent) : null;
    const total = this.selectors.paginationTotal ? this.container.querySelector(this.selectors.paginationTotal) : null;
    if (current) current.textContent = String(this.currentIndex + 1);
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

  finishAnimation() {
    this.isAnimating = false;
    this.items.forEach((item) => {
      item.style.willChange = 'auto';
    });
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

    gsap.set(item, { zIndex: transform.zIndex });
  }

  updateAllItems(centerIndex, durationMs = this.motion.slideMs) {
    const durationSeconds = durationMs / 1000;

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
      this.previewIndex = centerIndex;
      this.wheelState.previewPosition = centerIndex;
      applyTransforms(centerIndex);
      this.updatePagination();
      this.finishAnimation();
      return;
    }

    const startPosition = Number.isFinite(this.previewIndex) ? this.previewIndex : this.currentIndex;
    const tweenState = { position: startPosition };
    this.isAnimating = true;
    this.updatePagination();

    this.positionTween = gsap.to(tweenState, {
      position: centerIndex,
      duration: durationSeconds,
      ease: this.config.animationEase,
      onUpdate: () => {
        this.previewIndex = tweenState.position;
        this.wheelState.previewPosition = tweenState.position;
        applyTransforms(tweenState.position);
      },
      onComplete: () => {
        this.positionTween = null;
        this.previewIndex = centerIndex;
        this.wheelState.previewPosition = centerIndex;
        applyTransforms(centerIndex);
        this.finishAnimation();
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
      return;
    }

    this.currentIndex = normalizedTarget;
    this.updateAllItems(continuousTarget, durationMs);
    this.resetAutoplay();
    if (announce) this.announceCurrentSlide();
  }

  getDiscreteNavigationDuration() {
    // Gallery carousels use the full slideMs for smooth cinematic transitions
    if (this.config.surface === 'luxury-coverflow') return this.motion.slideMs;
    return 180;
  }

  next() {
    this.goToSlide(this.currentIndex + 1, { durationMs: this.getDiscreteNavigationDuration() });
  }

  prev() {
    this.goToSlide(this.currentIndex - 1, { durationMs: this.getDiscreteNavigationDuration() });
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

    // Prevent browser back/forward swipe gestures from leaking through the carousel
    this.container.style.overscrollBehaviorX = 'contain';
    this.container.style.touchAction = 'pan-y';

    this.resources.listen(this.container, 'wheel', (event) => {
      if (this.roulette?.isActive) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      // Prevent any horizontal wheel event on the carousel from becoming a browser
      // back/forward navigation gesture. Even small deltaX values can trigger it.
      if (absX > 1 && absX > absY * 0.5) {
        event.preventDefault();
      }

      // Only drive the carousel for significant horizontal intent
      if (absX < 6 || absX <= absY) return;

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
        let targetIndex = this.currentIndex;
        if (Math.abs(this.wheelState.accumulator) >= this.motion.scrollThreshold) {
          targetIndex = this.currentIndex + (this.wheelState.accumulator > 0 ? 1 : -1);
        }

        this.wheelState.accumulator = 0;
        this.previewIndex = normalizeIndex(targetIndex, this.items.length, this.config.infiniteLoop);
        this.goToSlide(targetIndex, { durationMs: this.motion.settleMs });
      }, 110);
    }, { passive: false });
  }

  startDrag(clientX, clientY, target) {
    if (target?.closest('button, a, [data-no-drag]')) return;

    this.dragSequence += 1;

    this.dragState = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      axisLocked: null,
      previewPosition: this.currentIndex,
      sequence: this.dragSequence,
      rafPending: false,
      sourceTarget: target
    };

    this.physics.startDrag(clientX);
    this.stopAutoplay();
    this.container.classList.add('is-dragging');
  }

  updateDrag(clientX, clientY) {
    if (!this.dragState.isDragging) return;

    const absX = Math.abs(clientX - this.dragState.startX);
    const absY = Math.abs(clientY - this.dragState.startY);
    if (this.dragState.axisLocked == null) {
      if (absX < 8 && absY < 8) return;
      this.dragState.axisLocked = absX >= absY ? 'horizontal' : 'vertical';
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

      const delta = (this.dragState.startX - this.dragState.currentX) / this.motion.dragPixelsPerSlide;
      const previewPosition = normalizeIndex(this.currentIndex + delta, this.items.length, this.config.infiniteLoop);
      this.dragState.previewPosition = previewPosition;
      this.previewIndex = previewPosition;
      this.updateContinuousPosition(previewPosition);
      this.dragState.rafPending = false;
    });
  }

  endDrag() {
    const deltaX = this.dragState.currentX - this.dragState.startX;
    const velocity = this.physics.velocity;
    const hasMeaningfulMovement = Math.abs(deltaX) >= 24 || Math.abs(velocity) > 0.2;
    const direction = deltaX < 0 ? 1 : -1;
    const targetIndex = hasMeaningfulMovement
      ? this.currentIndex + direction
      : this.currentIndex;

    this.dragState.isDragging = false;
    this.dragState.axisLocked = null;
  this.dragState.sequence = null;
  this.dragState.rafPending = false;
    this.container.classList.remove('is-dragging');
    if (hasMeaningfulMovement) {
      // Touch browsers may emit a trailing click after a drag; suppress it briefly.
      this.suppressClickUntil = performance.now() + 420;
    }
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
      this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
      this.updateAllItems(this.currentIndex, 0);
      this.roulette.refreshLayout();
    };

    let resizeTimeout = null;
    const handleResize = () => {
      this.resources.clearTimeout(resizeTimeout);
      resizeTimeout = this.resources.timeout(refresh, 120);
    };

    this.resources.listen(window, 'resize', handleResize, { passive: true });
    this.resources.listen(window, 'orientationchange', handleResize, { passive: true });

    if ('ResizeObserver' in window) {
      const observer = this.resources.observe(new ResizeObserver(handleResize));
      observer.observe(this.container);
    }
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
    this.engine3D = new Coverflow3DEngine(this.getEngineConfig());
    this.updateAllItems(this.currentIndex, 0);
    this.roulette.refreshLayout();
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
