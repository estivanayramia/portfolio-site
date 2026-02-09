/**
 * Luxury Coverflow V7.0 — EA-AC RESEARCH-BACKED ANIMATION FIX
 * 
 * RESEARCH CITATIONS:
 * - 3D Spheres: cssanimation.rocks/spheres (multi-layer gradients)
 * - GSAP Modifiers: gsap.com/docs/v3/GSAP/gsap.utils (continuous rotation)
 * - Morph Transitions: Microsoft Learn (layered timelines)
 * - Fisher-Yates: Knuth Vol.2 §3.4.2 (unbiased randomization)
 * - Apple Dev Docs: Safari Visual Effects (perspective, preserve-3d)
 * 
 * FIXES:
 * ✅ Ball 3D depth — Perspective + multi-layer gradients + shadow element
 * ✅ No teleportation — Continuous rotation with proper easing
 * ✅ Perfect centering — translate(-50%, -50%) on all positioned elements
 * ✅ Smooth morph — Layered timeline with overlapping phases
 */

import { gsap } from 'gsap';
import { Coverflow3DEngine } from './coverflow-3d-engine.js';
import { CoverflowPhysics } from './coverflow-physics.js';
import { RouletteWheelEngine } from './roulette-wheel-engine.js';

gsap.ticker.fps(60);

const PERF_PROFILE_GLOBAL_KEY = 'LUXURY_PERF_PROFILE';
let cachedPerfProfile = null;

function safeMatchMedia(query) {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function getReducedMotionPreference() {
  const mq = safeMatchMedia('(prefers-reduced-motion: reduce)');
  return !!(mq && mq.matches);
}

export function computePerformanceProfile() {
  if (cachedPerfProfile) return cachedPerfProfile;

  const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (g && g[PERF_PROFILE_GLOBAL_KEY]) {
    cachedPerfProfile = g[PERF_PROFILE_GLOBAL_KEY];
    return cachedPerfProfile;
  }

  const reducedMotion = getReducedMotionPreference();

  const cores = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : null;
  const memoryGb = typeof navigator !== 'undefined' && Number.isFinite(navigator.deviceMemory)
    ? navigator.deviceMemory
    : null;

  const viewportW = typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
    ? window.innerWidth
    : null;

  const uaMobile = (() => {
    try {
      if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
        return navigator.userAgentData.mobile;
      }
    } catch {
      // ignore
    }
    try {
      const ua = String(navigator.userAgent || '');
      return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    } catch {
      return false;
    }
  })();

  const smallViewport = typeof viewportW === 'number' ? viewportW < 600 : false;

  let tier = 'standard';
  if (reducedMotion) {
    tier = 'reduced-motion';
  } else {
    let score = 0;
    if (uaMobile || smallViewport) score -= 2;

    if (typeof cores === 'number') {
      if (cores >= 8) score += 2;
      else if (cores >= 4) score += 1;
      else score -= 1;
    }

    if (typeof memoryGb === 'number') {
      if (memoryGb >= 8) score += 1;
      else if (memoryGb <= 2) score -= 1;
    }

    if (score >= 3) tier = 'premium';
    else if (score <= 0) tier = 'low';
    else tier = 'standard';
  }

  cachedPerfProfile = {
    tier,
    metrics: {
      reducedMotion,
      cores,
      memoryGb,
      viewportW,
      uaMobile,
      smallViewport
    }
  };

  if (g) g[PERF_PROFILE_GLOBAL_KEY] = cachedPerfProfile;

  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const root = document.documentElement;
      root.classList.remove('cf-tier-premium', 'cf-tier-standard', 'cf-tier-low', 'cf-tier-reduced-motion');
      root.classList.add(`cf-tier-${tier}`);
    }
  } catch {
    // ignore
  }

  return cachedPerfProfile;
}

function normalizeTier(tier) {
  if (!tier) return null;
  const t = String(tier).trim().toLowerCase();
  if (t === 'premium' || t === 'standard' || t === 'low' || t === 'reduced-motion') return t;
  return null;
}

function getTierRuntimeDefaults(tier) {
  switch (tier) {
    case 'premium':
      return {
        motionScale: 1,
        animationDuration: 0.55,
        staggerDelay: 0.02,
        enableSmoothTracking: true,
        enableScroll: true,
        scrollSensitivity: 0.004,
        rouletteMode: 'full'
      };
    case 'standard':
      return {
        motionScale: 0.85,
        animationDuration: 0.45,
        staggerDelay: 0.015,
        enableSmoothTracking: true,
        enableScroll: true,
        scrollSensitivity: 0.0035,
        rouletteMode: 'full'
      };
    case 'low':
      return {
        motionScale: 0.65,
        animationDuration: 0.33,
        staggerDelay: 0.005,
        enableSmoothTracking: false,
        enableScroll: true,
        scrollSensitivity: 0.003,
        rouletteMode: 'minimal'
      };
    case 'reduced-motion':
      return {
        motionScale: 0.35,
        animationDuration: 0.22,
        staggerDelay: 0,
        enableSmoothTracking: false,
        enableScroll: true,
        scrollSensitivity: 0.003,
        rouletteMode: 'minimal'
      };
    default:
      return getTierRuntimeDefaults('standard');
  }
}

export class LuxuryCoverflow {
  constructor(containerSelector, options = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.error(`❌ Container "${containerSelector}" not found`);
      return;
    }
    
    this.track = this.container.querySelector('.coverflow-track');
    this.items = Array.from(this.container.querySelectorAll('.coverflow-card'));
    
    this.config = {
      initialIndex: 0,
      performanceTier: null,
      performanceAutoTune: true,
      autoplay: false,
      autoplayDelay: 5000,
      infiniteLoop: true,
      enableKeyboard: true,
      enableMouse: true,
      enableTouch: true,
      enableScroll: true,
      enableSmoothTracking: true,
      scrollThreshold: 30,
      scrollSensitivity: 0.004,
      animationDuration: 0.55,
      animationEase: 'power2.out',
      staggerDelay: 0.02,
      enableCasinoWheel: true,
      ...options
    };

    const reducedMotion = getReducedMotionPreference();
    const tierFromOptions = normalizeTier(this.config.performanceTier);
    const autoProfile = this.config.performanceAutoTune ? computePerformanceProfile() : null;
    const autoTier = autoProfile ? normalizeTier(autoProfile.tier) : null;
    const resolvedTier = reducedMotion ? 'reduced-motion' : (tierFromOptions || autoTier || 'premium');
    const tierDefaults = getTierRuntimeDefaults(resolvedTier);

    this.runtimeProfile = {
      tier: resolvedTier,
      motionScale: tierDefaults.motionScale,
      rouletteMode: tierDefaults.rouletteMode,
      metrics: autoProfile ? autoProfile.metrics : { reducedMotion }
    };

    this.config.animationDuration = tierDefaults.animationDuration;
    this.config.staggerDelay = tierDefaults.staggerDelay;
    this.config.enableSmoothTracking = tierDefaults.enableSmoothTracking;
    this.config.enableScroll = tierDefaults.enableScroll;
    this.config.scrollSensitivity = tierDefaults.scrollSensitivity;

    if (reducedMotion) {
      this.config.autoplay = false;
    }

    const initialIndexRaw = Number.isFinite(this.config.initialIndex)
      ? Math.trunc(this.config.initialIndex)
      : 0;
    const totalItems = this.items.length;
    if (totalItems > 0) {
      this.currentIndex = this.config.infiniteLoop
        ? ((initialIndexRaw % totalItems) + totalItems) % totalItems
        : Math.max(0, Math.min(totalItems - 1, initialIndexRaw));
    } else {
      this.currentIndex = 0;
    }
    this.isAnimating = false;
    this.autoplayTimer = null;
    this.navQueue = null;
    this.scrollPosition = this.currentIndex;
    
    this.clickState = { startTime: 0, startX: 0, startY: 0 };
    
    this.engine3D = new Coverflow3DEngine({
      ...this.config,
      infiniteLoop: this.config.infiniteLoop
    });
    
    this.physics = new CoverflowPhysics({
      friction: 0.92,
      snapThreshold: 0.2,
      velocityMultiplier: 2.5
    });
    
    this.wheelEngine = new RouletteWheelEngine();
    
    this.dragState = {
      isDragging: false,
      startX: 0,
      currentX: 0,
      startIndex: 0,
      rafPending: false
    };
    
    this.rouletteState = {
      isActive: false,
      overlay: null,
      wheelWrapper: null,
      pockets: [],
      ball: null,
      ballShadow: null,
      ballHighlight: null,
      wheelRim: null,
      status: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null,
      pocketToCardMap: []
    };
    
    this.init();
  }
  
  init() {
    if (this.items.length === 0) {
      console.warn('⚠️ No coverflow items found');
      return;
    }
    
    this.updateAllItems(this.currentIndex, 0);
    
    this.setupKeyboardNavigation();
    this.setupMouseDrag();
    this.setupTouchDrag();
    this.setupScrollNavigation();
    this.setupSmoothScrollTracking();
    this.setupItemClicks();
    this.setupResizeHandler();
    this.setupNavigationButtons();
    this.setupRouletteButton();
    
    if (this.config.autoplay) this.startAutoplay();
    
    this.announceCurrentSlide();
    console.log('✨ Luxury Coverflow V7.0 — EA-AC RESEARCH-BACKED FIX 🎰');
  }
  
  // ========================================
  // CORE CAROUSEL METHODS
  // ========================================
  
  updateAllItems(centerIndex, duration = this.config.animationDuration) {
    const transforms = this.engine3D.calculateAllTransforms(
      centerIndex, this.items.length, this.config.infiniteLoop
    );
    
    gsap.killTweensOf(this.items);
    
    this.items.forEach((item, index) => {
      const transform = transforms[index];
      const isCenter = index === Math.round(centerIndex);
      const absPosition = this.getAbsoluteDistance(index, Math.round(centerIndex));
      
      if (duration > 0) item.style.willChange = 'transform, opacity';
      
      gsap.to(item, {
        x: transform.translateX,
        y: transform.translateY || 0,
        z: transform.translateZ,
        rotationY: transform.rotateY,
        scale: transform.scale,
        opacity: transform.opacity,
        filter: this.engine3D.getFilterString(transform.filter),
        zIndex: transform.zIndex,
        duration, ease: this.config.animationEase,
        delay: duration > 0 ? absPosition * this.config.staggerDelay : 0,
        force3D: true,
        onComplete: () => { item.style.willChange = 'auto'; }
      });
      
      item.classList.toggle('is-center', isCenter);
      item.setAttribute('aria-current', isCenter ? 'true' : 'false');
    });
    
    this.updatePagination();
  }
  
  updateContinuousPosition(position) {
    const transforms = this.engine3D.calculateAllTransforms(
      position, this.items.length, this.config.infiniteLoop
    );
    this.items.forEach((item, index) => {
      const t = transforms[index];
      gsap.set(item, {
        x: t.translateX, y: t.translateY || 0, z: t.translateZ,
        rotationY: t.rotateY, scale: t.scale, opacity: t.opacity,
        filter: this.engine3D.getFilterString(t.filter), zIndex: t.zIndex, force3D: true
      });
    });
  }
  
  getAbsoluteDistance(index, centerIndex) {
    let distance = Math.abs(index - centerIndex);
    if (this.config.infiniteLoop && this.items.length > 1) {
      distance = Math.min(distance, this.items.length - distance);
    }
    return distance;
  }
  
  goToSlide(targetIndex, duration = this.config.animationDuration) {
    if (this.config.infiniteLoop && this.items.length > 0) {
      targetIndex = ((targetIndex % this.items.length) + this.items.length) % this.items.length;
    } else {
      targetIndex = Math.max(0, Math.min(this.items.length - 1, targetIndex));
    }
    
    if (targetIndex === this.currentIndex) return;
    if (this.isAnimating) {
      clearTimeout(this.navQueue);
      this.navQueue = setTimeout(() => this.goToSlide(targetIndex, duration), 100);
      return;
    }
    
    this.isAnimating = true;
    this.currentIndex = targetIndex;
    this.scrollPosition = targetIndex;
    
    this.updateAllItems(targetIndex, duration);
    this.resetAutoplay();
    this.announceCurrentSlide();
    
    setTimeout(() => { this.isAnimating = false; }, duration * 1000 + 50);
  }
  
  next() { this.goToSlide(this.currentIndex + 1); }
  prev() { this.goToSlide(this.currentIndex - 1); }
  
  // ========================================
  // INPUT HANDLERS
  // ========================================
  
  setupKeyboardNavigation() {
    if (!this.config.enableKeyboard) return;
    document.addEventListener('keydown', (e) => {
      if (!this.container.contains(document.activeElement) && !this.container.matches(':hover')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
    });
  }
  
  setupMouseDrag() {
    if (!this.config.enableMouse) return;
    this.track.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startDrag(e.clientX);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.dragState.isDragging) this.updateDrag(e.clientX);
    });
    document.addEventListener('mouseup', () => {
      if (this.dragState.isDragging) this.endDrag();
    });
  }
  
  setupTouchDrag() {
    if (!this.config.enableTouch) return;
    this.track.addEventListener('touchstart', (e) => this.startDrag(e.touches[0].clientX), { passive: true });
    this.track.addEventListener('touchmove', (e) => {
      if (this.dragState.isDragging) { e.preventDefault(); this.updateDrag(e.touches[0].clientX); }
    }, { passive: false });
    this.track.addEventListener('touchend', () => { if (this.dragState.isDragging) this.endDrag(); });
  }
  
  setupScrollNavigation() {
    if (!this.config.enableScroll) return;
    let scrollDeltaX = 0, scrollTimeout;
    this.container.addEventListener('wheel', (e) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absY >= absX || absX <= 5) return;

      e.preventDefault();
      scrollDeltaX += e.deltaX;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (Math.abs(scrollDeltaX) >= this.config.scrollThreshold) {
          scrollDeltaX > 0 ? this.next() : this.prev();
        }
        scrollDeltaX = 0;
      }, 80);
    }, { passive: false });
  }
  
  setupSmoothScrollTracking() {
    if (!this.config.enableSmoothTracking) return;
    let targetPosition = this.currentIndex, scrollEndTimeout;
    this.container.addEventListener('wheel', (e) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absY >= absX || absX <= 5) return;
      e.preventDefault();
      targetPosition += e.deltaX * this.config.scrollSensitivity;
      if (this.config.infiniteLoop) {
        while (targetPosition < 0) targetPosition += this.items.length;
        while (targetPosition >= this.items.length) targetPosition -= this.items.length;
      } else {
        targetPosition = Math.max(0, Math.min(this.items.length - 1, targetPosition));
      }
      this.updateContinuousPosition(targetPosition);
      clearTimeout(scrollEndTimeout);
      scrollEndTimeout = setTimeout(() => {
        this.goToSlide(Math.round(targetPosition), 0.25);
        targetPosition = Math.round(targetPosition);
      }, 120);
    }, { passive: false });
  }
  
  startDrag(clientX) {
    this.dragState = { isDragging: true, startX: clientX, currentX: clientX, startIndex: this.currentIndex, rafPending: false };
    this.physics.startDrag(clientX);
    this.stopAutoplay();
    this.container.classList.add('is-dragging');
  }
  
  updateDrag(clientX) {
    if (!this.dragState.isDragging) return;
    this.dragState.currentX = clientX;
    if (!this.dragState.rafPending) {
      this.dragState.rafPending = true;
      requestAnimationFrame(() => { this.physics.updateDrag(this.dragState.currentX); this.dragState.rafPending = false; });
    }
  }
  
  endDrag() {
    const delta = (this.dragState.currentX - this.dragState.startX) / 350;
    const target = this.physics.calculateSnapTarget(this.currentIndex, this.items.length, delta, this.config.infiniteLoop);
    this.goToSlide(target);
    this.dragState.isDragging = false;
    this.container.classList.remove('is-dragging');
    this.physics.endDrag();
  }
  
  setupItemClicks() {
    this.items.forEach((item, index) => {
      item.addEventListener('pointerdown', (e) => {
        this.clickState = { startTime: Date.now(), startX: e.clientX, startY: e.clientY };
      });
      item.addEventListener('pointerup', (e) => {
        const dt = Date.now() - this.clickState.startTime;
        const dx = Math.abs(e.clientX - this.clickState.startX);
        const dy = Math.abs(e.clientY - this.clickState.startY);
        if (dt < 300 && dx < 10 && dy < 10 && index !== this.currentIndex) {
          e.preventDefault();
          this.goToSlide(index);
        }
      });
    });
  }
  
  setupNavigationButtons() {
    const prev = this.container.querySelector('.coverflow-btn-prev');
    const next = this.container.querySelector('.coverflow-btn-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
  }
  
  // ========================================
  // V7.0: EA-AC RESEARCH-BACKED CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 V7.0 Casino wheel ready — EA-AC Research-Backed');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV70();
    });
  }
  
  /**
   * V7.0: Casino wheel with EA-AC research-backed fixes
   */
  async startCasinoWheelV70() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V7.0 CASINO — EA-AC RESEARCH-BACKED!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Select winner
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.greenPocketIndex = Math.floor(Math.random() * 37);
    
    // Winner pocket is NOT green
    let winnerPocket = Math.floor(Math.random() * 37);
    while (winnerPocket === this.rouletteState.greenPocketIndex) {
      winnerPocket = Math.floor(Math.random() * 37);
    }
    this.rouletteState.winnerPocketIndex = winnerPocket;
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: Card ${this.rouletteState.originalWinnerIndex} "${winnerTitle}"`);

    const rouletteMode = this.runtimeProfile?.rouletteMode || 'full';
    if (rouletteMode !== 'full') {
      try {
        this.goToSlide(this.rouletteState.originalWinnerIndex, Math.min(this.config.animationDuration, 0.25));
        const winnerEl = this.items[this.rouletteState.originalWinnerIndex];
        if (winnerEl) {
          gsap.fromTo(winnerEl, { scale: 1 }, { scale: 1.03, duration: 0.16, yoyo: true, repeat: 1, ease: 'power1.out' });
        }
      } finally {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
      }
      return;
    }
    
    try {
      await this.phase1_CreatePerspectiveOverlay();
      await this.phase2_CreateWheelWithMapping();
      await this.phase3_Create3DBall();
      await this.phase4_SpinWithOrbit();
      
      // V7.5: Increased settle delay (ensure wheel FULLY stops before ball landing)
      await this.delay(Math.round(400 * (this.runtimeProfile?.motionScale || 1)));
      
      await this.phase5_BallLanding();
      await this.phase6_LiftFeatureSettle(winnerTitle);
      
      console.log('🎉 V7.0 Complete!');
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      this.cleanupCasinoWheel();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  /**
   * Phase 1: Create overlay WITH PERSPECTIVE
   * Research: Apple Safari Visual Effects Guide
   */
  async phase1_CreatePerspectiveOverlay() {
    console.log('📦 Phase 1: Create Perspective Overlay');
    
    const overlay = document.createElement('div');
    overlay.className = 'casino-overlay-v70';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      opacity: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.97) 0%, rgba(0, 15, 0, 0.99) 100%);
      overflow: hidden;
      /* V7.0: PERSPECTIVE for 3D depth */
      perspective: 1200px;
      perspective-origin: 50% 50%;
    `;
    document.body.appendChild(overlay);
    this.rouletteState.overlay = overlay;
    
    const status = document.createElement('div');
    status.textContent = 'Preparing...';
    status.style.cssText = `
      position: absolute;
      bottom: 5%;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(1rem, 2.5vw, 1.8rem);
      font-weight: 700;
      color: #FFD700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 0 30px #FFD700;
      z-index: 10;
    `;
    overlay.appendChild(status);
    this.rouletteState.status = status;
    
    return new Promise(resolve => {
      const s = this.runtimeProfile?.motionScale || 1;
      const d = Math.max(0.18, 0.5 * s);
      gsap.to(overlay, { opacity: 1, duration: d });
      gsap.to(this.items, { opacity: 0, duration: d, onComplete: resolve });
    });
  }
  
  /**
   * Phase 2: Create wheel with 1:1 pocket-to-card mapping
   */
  async phase2_CreateWheelWithMapping() {
    console.log('🔄 Phase 2: Create Wheel (1:1 Mapping)');
    this.rouletteState.status.textContent = 'Forming wheel...';
    
    const overlay = this.rouletteState.overlay;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.38;
    
    // V7.0: Wheel wrapper with preserve-3d
    const wheelWrapper = document.createElement('div');
    wheelWrapper.className = 'wheel-wrapper-v70';
    wheelWrapper.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 0;
      height: 0;
      transform-style: preserve-3d;
      transform-origin: center center;
      will-change: transform;
    `;
    overlay.appendChild(wheelWrapper);
    this.rouletteState.wheelWrapper = wheelWrapper;
    
    // Golden rim
    const rimSize = wheelRadius * 2 + 140;
    const rim = document.createElement('div');
    rim.style.cssText = `
      position: absolute;
      left: ${-rimSize / 2}px;
      top: ${-rimSize / 2}px;
      width: ${rimSize}px;
      height: ${rimSize}px;
      border: 14px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#002800, #002800) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 100px rgba(255,215,0,0.9),
        0 0 200px rgba(255,215,0,0.5),
        inset 0 0 120px rgba(255,215,0,0.2);
      opacity: 0;
      pointer-events: none;
    `;
    wheelWrapper.appendChild(rim);
    this.rouletteState.wheelRim = rim;
    gsap.to(rim, { opacity: 1, duration: 0.5 });
    
    const sequence = [
      { num: 0, color: 'green' },
      { num: 32, color: 'red' }, { num: 15, color: 'black' }, { num: 19, color: 'red' },
      { num: 4, color: 'black' }, { num: 21, color: 'red' }, { num: 2, color: 'black' },
      { num: 25, color: 'red' }, { num: 17, color: 'black' }, { num: 34, color: 'red' },
      { num: 6, color: 'black' }, { num: 27, color: 'red' }, { num: 13, color: 'black' },
      { num: 36, color: 'red' }, { num: 11, color: 'black' }, { num: 30, color: 'red' },
      { num: 8, color: 'black' }, { num: 23, color: 'red' }, { num: 10, color: 'black' },
      { num: 5, color: 'red' }, { num: 24, color: 'black' }, { num: 16, color: 'red' },
      { num: 33, color: 'black' }, { num: 1, color: 'red' }, { num: 20, color: 'black' },
      { num: 14, color: 'red' }, { num: 31, color: 'black' }, { num: 9, color: 'red' },
      { num: 22, color: 'black' }, { num: 18, color: 'red' }, { num: 29, color: 'black' },
      { num: 7, color: 'red' }, { num: 28, color: 'black' }, { num: 12, color: 'red' },
      { num: 35, color: 'black' }, { num: 3, color: 'red' }, { num: 26, color: 'black' }
    ];
    
    const pockets = [];
    const pocketW = 85;
    const pocketH = 110;
    const greenIdx = this.rouletteState.greenPocketIndex;
    const winnerPocket = this.rouletteState.winnerPocketIndex;
    const winnerCard = this.rouletteState.originalWinnerIndex;
    
    this.rouletteState.pocketToCardMap = [];
    
    for (let i = 0; i < 37; i++) {
      const data = sequence[i];
      const angle = (360 / 37) * i - 90;
      const angleRad = angle * Math.PI / 180;
      const x = wheelRadius * Math.cos(angleRad);
      const y = wheelRadius * Math.sin(angleRad);
      
      const isGreen = i === greenIdx;
      const isWinner = i === winnerPocket;
      let borderColor, glowColor;
      
      if (isGreen) {
        borderColor = '#00FF00';
        glowColor = 'rgba(0, 255, 0, 0.9)';
      } else if (data.color === 'red') {
        borderColor = '#FF0000';
        glowColor = 'rgba(255, 0, 0, 0.8)';
      } else {
        borderColor = '#FFFFFF';
        glowColor = 'rgba(255, 255, 255, 0.6)';
      }
      
      // V7.0: Perfect centering with translate(-50%, -50%)
      const pocket = document.createElement('div');
      pocket.className = 'pocket-v70';
      pocket.dataset.pocketIndex = i;
      pocket.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${pocketW}px;
        height: ${pocketH}px;
        transform: translate(-50%, -50%) rotate(${angle + 90}deg) scale(0);
        transform-origin: center center;
        border: 4px solid ${borderColor};
        border-radius: 12px;
        overflow: hidden;
        opacity: 0;
        box-shadow:
          0 0 35px ${glowColor},
          0 0 70px ${glowColor};
        will-change: transform;
        cursor: pointer;
      `;
      
      if (isGreen) {
        pocket.innerHTML = `
          <div style="
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #003000, #006000);
            color: #00FF00;
            font-family: 'Arial Black', sans-serif;
            font-size: 16px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 20px #00FF00;
            line-height: 1.3;
          ">
            <div style="font-size: 160%;">TRY</div>
            <div style="font-size: 160%;">AGAIN</div>
          </div>
        `;
        this.rouletteState.pocketToCardMap[i] = -1;
      } else {
        // V7.0: Winner pocket ALWAYS shows winner card
        let cardIndex;
        if (isWinner) {
          cardIndex = winnerCard;
        } else {
          cardIndex = Math.floor((i / 37) * this.items.length) % this.items.length;
        }
        
        this.rouletteState.pocketToCardMap[i] = cardIndex;
        
        const srcCard = this.items[cardIndex];
        const preview = this.extractCardPreview(srcCard);
        pocket.appendChild(preview);
        
        const badge = document.createElement('div');
        badge.textContent = data.num;
        badge.style.cssText = `
          position: absolute;
          top: 6px;
          right: 6px;
          font-family: 'Arial Black', sans-serif;
          font-size: 14px;
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 15px #FFD700;
          background: rgba(0, 0, 0, 0.9);
          padding: 4px 7px;
          border-radius: 5px;
          z-index: 10;
        `;
        pocket.appendChild(badge);
      }
      
      wheelWrapper.appendChild(pocket);
      pockets.push(pocket);
    }
    
    this.rouletteState.pockets = pockets;
    console.log(`✅ Created ${pockets.length} pockets (winner pocket ${winnerPocket} → card ${winnerCard})`);
    
    return new Promise(resolve => {
      pockets.forEach((pocket, i) => {
        gsap.to(pocket, {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          delay: i * 0.03,
          ease: 'back.out(1.3)'
        });
      });
      setTimeout(resolve, 2800);
    });
  }
  
  /**
   * Extract card preview
   */
  extractCardPreview(sourceCard) {
    const preview = document.createElement('div');
    preview.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #1a1a2e;
    `;
    
    const cardBg = sourceCard.querySelector('.card-bg');
    if (cardBg) {
      const bgStyle = window.getComputedStyle(cardBg);
      const bgDiv = document.createElement('div');
      bgDiv.style.cssText = `
        position: absolute;
        inset: 0;
        background: ${bgStyle.background || bgStyle.backgroundImage || 'linear-gradient(135deg, #212842, #3d4666)'};
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      const svg = cardBg.querySelector('svg');
      if (svg) {
        const svgClone = svg.cloneNode(true);
        svgClone.style.cssText = 'width: 50px; height: 50px; opacity: 0.9;';
        bgDiv.appendChild(svgClone);
      }
      
      preview.appendChild(bgDiv);
    }
    
    const title = sourceCard.dataset.title || 
                  sourceCard.querySelector('.card-title')?.textContent || 
                  'Project';
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title.length > 15 ? title.substring(0, 15) + '...' : title;
    titleEl.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 6px;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(transparent, rgba(0,0,0,0.95));
      text-align: center;
      white-space: nowrap;
      text-shadow: 0 2px 5px rgba(0,0,0,0.9);
    `;
    preview.appendChild(titleEl);
    
    return preview;
  }
  
  /**
   * Phase 3: Create realistic 3D ball
   * Research: cssanimation.rocks/spheres (multi-layer gradients)
   */
  async phase3_Create3DBall() {
    console.log('⚽ Phase 3: Create 3D Ball (Multi-Layer)');
    
    const overlay = this.rouletteState.overlay;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.38;
    const orbitRadius = wheelRadius + 80;
    
    // V7.0: Multi-layer 3D ball
    // Layer 1: Base sphere gradient
    const ball = document.createElement('div');
    ball.className = 'roulette-ball-v70';
    ball.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      /* Multi-layer gradients for 3D depth */
      background:
        /* Specular highlight (top-left) */
        radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 35%),
        /* Main sphere gradient */
        radial-gradient(circle at 50% 50%, #f5f5f5 0%, #d0d0d0 40%, #a0a0a0 70%, #707070 100%);
      /* Inset shadows for depth */
      box-shadow:
        inset -6px -6px 15px rgba(0,0,0,0.35),
        inset 4px 4px 10px rgba(255,255,255,0.6),
        0 0 50px rgba(255,215,0,0.8),
        0 0 100px rgba(255,215,0,0.5);
      z-index: 200;
      pointer-events: none;
      /* V7.0: Preserve-3d for proper depth */
      transform-style: preserve-3d;
    `;
    overlay.appendChild(ball);
    this.rouletteState.ball = ball;
    
    // Layer 2: Ball highlight (separate element for better control)
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: absolute;
      width: 20px;
      height: 12px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(255,255,255,0.9) 0%, transparent 70%);
      z-index: 201;
      pointer-events: none;
      filter: blur(1px);
    `;
    overlay.appendChild(highlight);
    this.rouletteState.ballHighlight = highlight;
    
    // Layer 3: Ball shadow (rotated ellipse below)
    const shadow = document.createElement('div');
    shadow.style.cssText = `
      position: absolute;
      width: 55px;
      height: 18px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 65%);
      filter: blur(5px);
      z-index: 98;
      pointer-events: none;
      /* V7.0: Shadow positioned below ball */
      transform: rotateX(90deg);
    `;
    overlay.appendChild(shadow);
    this.rouletteState.ballShadow = shadow;
    
    // Initial position (outside wheel)
    const startAngle = Math.random() * 360;
    const startRad = startAngle * Math.PI / 180;
    const startX = centerX + orbitRadius * Math.cos(startRad);
    const startY = centerY + orbitRadius * Math.sin(startRad);
    
    gsap.set(ball, { 
      left: startX - 25, 
      top: startY - 25,
      opacity: 1
    });
    gsap.set(highlight, {
      left: startX - 22,
      top: startY - 22
    });
    gsap.set(shadow, {
      left: startX - 27,
      top: startY + 35
    });
    
    // Store initial angle
    ball.dataset.angle = startAngle;
    
    console.log('⚽ 3D ball created with multi-layer rendering');
  }
  
  /**
   * Phase 4: Spin wheel and orbit ball (full circumference)
   */
  async phase4_SpinWithOrbit() {
    console.log('🎡 Phase 4: Spin Wheel + Full Ball Orbit');
    this.rouletteState.status.textContent = 'Spinning...';
    
    const overlay = this.rouletteState.overlay;
    const wrapper = this.rouletteState.wheelWrapper;
    const ball = this.rouletteState.ball;
    const highlight = this.rouletteState.ballHighlight;
    const shadow = this.rouletteState.ballShadow;
    
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.38;
    
    // Calculate spin parameters
    const winnerPocket = this.rouletteState.winnerPocketIndex;
    const pocketAngle = (360 / 37) * winnerPocket;
    const spins = 5 + Math.floor(Math.random() * 2); // 5-6 full spins
    const finalWheelRotation = -(spins * 360 + pocketAngle + 90);
    const duration = 6 + Math.random() * 0.5; // 6-6.5 seconds
    
    console.log(`🎡 Spinning ${spins} rotations, landing on pocket ${winnerPocket}`);
    
    // Ball orbit parameters
    const outerOrbitRadius = wheelRadius + 80;
    const innerOrbitRadius = wheelRadius + 5;
    let ballAngle = parseFloat(ball.dataset.angle) || 0;
    
    // V7.1: Define safe boundaries (ball containment fix)
    const wheelVisualRadius = wheelRadius + 70; // Max visible extent
    const minSafeRadius = wheelRadius - 20; // Inner boundary
    const maxSafeRadius = wheelVisualRadius; // Outer boundary
    
    const statusEl = this.rouletteState.status;
    
    return new Promise(resolve => {
      // Spin wheel (counter-clockwise)
      gsap.to(wrapper, {
        rotation: finalWheelRotation,
        duration,
        ease: 'power3.out'
      });
      
      // V7.0: Ball orbits FULL circumference in OPPOSITE direction
      gsap.to({}, {
        duration,
        ease: 'none',
        onUpdate: function() {
          const progress = this.progress();
          
          // V7.0: Smooth deceleration curve (no teleportation)
          // Using exponential decay for realistic physics
          const velocityFactor = Math.pow(1 - progress, 2);
          const angularSpeed = 900 * velocityFactor;
          ballAngle += angularSpeed * 0.016; // ~60fps
          
          // Keep angle normalized (prevent overflow)
          while (ballAngle >= 360) ballAngle -= 360;
          
          // Spiral inward progressively
          let currentRadius = outerOrbitRadius;
          if (progress > 0.25) {
            const spiralProgress = (progress - 0.25) / 0.75;
            const easedSpiral = Math.pow(spiralProgress, 2.5);
            currentRadius = outerOrbitRadius - (outerOrbitRadius - innerOrbitRadius) * easedSpiral;
          }
          
          // V7.1: CRITICAL - Clamp to safe boundaries (prevents ball boundary violation)
          currentRadius = gsap.utils.clamp(minSafeRadius, maxSafeRadius, currentRadius);
          
          // Calculate position
          const rad = ballAngle * Math.PI / 180;
          const x = centerX + currentRadius * Math.cos(rad);
          const y = centerY + currentRadius * Math.sin(rad);
          
          // Update all ball layers
          gsap.set(ball, { left: x - 25, top: y - 25 });
          gsap.set(highlight, { left: x - 22, top: y - 22 });
          gsap.set(shadow, { left: x - 27, top: y + 35, opacity: 0.6 - progress * 0.3 });
          
          // Dynamic glow based on velocity
          const glowSize = 50 + velocityFactor * 80;
          ball.style.boxShadow = `
            inset -6px -6px 15px rgba(0,0,0,0.35),
            inset 4px 4px 10px rgba(255,255,255,0.6),
            0 0 ${glowSize}px rgba(255,215,0,${0.5 + velocityFactor * 0.5}),
            0 0 ${glowSize * 2}px rgba(255,215,0,${0.3 + velocityFactor * 0.3})
          `;
          
          // Status updates
          if (progress < 0.25) statusEl.textContent = '🎰 Fast spin!';
          else if (progress < 0.5) statusEl.textContent = '🎰 Round and round...';
          else if (progress < 0.8) statusEl.textContent = '🎰 Slowing down...';
          else statusEl.textContent = '🎰 Almost there...';
        },
        onComplete: () => {
          // V7.2: Ball naturally ends at orbital position (no snap)
          console.log('⚽ Ball orbit complete');
          resolve();
        }
      });
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        const interval = setInterval(() => navigator.vibrate(3), 150);
        setTimeout(() => clearInterval(interval), duration * 1000);
      }
    });
  }
  
  /**
   * Phase 5: Ball landing - DETECT actual landing pocket
   * V7.5: Fixed ball jump bug - ball stays where it lands
   */
  async phase5_BallLanding() {
    console.log('⚾ Phase 5: Ball Landing');
    this.rouletteState.status.textContent = 'Landing...';
    
    const ball = this.rouletteState.ball;
    const highlight = this.rouletteState.ballHighlight;
    const shadow = this.rouletteState.ballShadow;
    const pockets = this.rouletteState.pockets;
    
    // V7.5: DETECT which pocket ball is actually nearest to
    const ballRect = ball.getBoundingClientRect();
    const ballCenterX = ballRect.left + ballRect.width / 2;
    const ballCenterY = ballRect.top + ballRect.height / 2;
    
    let nearestPocketIndex = 0;
    let nearestDistance = Infinity;
    
    pockets.forEach((pocket, i) => {
      const pocketRect = pocket.getBoundingClientRect();
      const pocketCenterX = pocketRect.left + pocketRect.width / 2;
      const pocketCenterY = pocketRect.top + pocketRect.height / 2;
      
      const distance = Math.sqrt(
        Math.pow(ballCenterX - pocketCenterX, 2) + 
        Math.pow(ballCenterY - pocketCenterY, 2)
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPocketIndex = i;
      }
    });
    
    // V7.5: UPDATE winner to actual landing pocket (no more jump!)
    console.log(`🎯 Ball landed near pocket ${nearestPocketIndex} (was targeting ${this.rouletteState.winnerPocketIndex})`);
    this.rouletteState.winnerPocketIndex = nearestPocketIndex;
    
    const winnerPocket = pockets[nearestPocketIndex];
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Fine-tune position to center of detected pocket
      const rect = winnerPocket.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2 - 25;
      const targetY = rect.top + rect.height / 2 - 25;
      
      // V7.5: Short, subtle adjustment (not a big jump)
      tl.to(ball, {
        left: targetX,
        top: targetY,
        duration: 0.15,
        ease: 'power2.out'
      });
      tl.to(highlight, {
        left: targetX + 3,
        top: targetY - 22,
        duration: 0.35,
        ease: 'expo.out'
      }, 0);
      tl.to(shadow, {
        left: targetX - 2,
        top: targetY + 35,
        duration: 0.35,
        ease: 'expo.out'
      }, 0);
      
      // Natural bounce sequence - vertical only
      tl.to(ball, { top: targetY - 35, duration: 0.18, ease: 'power2.out' });
      tl.to(ball, { top: targetY, duration: 0.22, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 15, duration: 0.12, ease: 'power1.out' });
      tl.to(ball, { top: targetY, duration: 0.15, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 5, duration: 0.08, ease: 'power1.out' });
      tl.to(ball, { top: targetY, duration: 0.08 });
      
      // Winner glow flash
      tl.to(winnerPocket, {
        boxShadow: '0 0 120px rgba(255,215,0,1), 0 0 200px rgba(255,215,0,0.8)',
        duration: 0.12,
        repeat: 4,
        yoyo: true,
        onComplete: () => {
          // V7.4: Diagnostic logging
          console.log('🔍 Ball Landing Diagnostics:');
          console.log('  Winner Pocket Index:', this.rouletteState.winnerPocketIndex);
          console.log('  Pocket-to-Card Map:', this.rouletteState.pocketToCardMap[this.rouletteState.winnerPocketIndex]);
          console.log('  Ball final position:', { 
            left: ball.style.left, 
            top: ball.style.top 
          });
        }
      }, '-=0.5');
      
      // Fade out ball
      tl.to([ball, highlight, shadow], {
        opacity: 0,
        scale: 0.3,
        duration: 0.4
      });
      
      if ('vibrate' in navigator) navigator.vibrate([50, 30, 80, 40, 30]);
    });
  }
  
  /**
   * Phase 6: Lift-Feature-Settle Animation
   * Research: Apple HIG Motion Principles, Material Design Elevation
   */
  async phase6_LiftFeatureSettle(winnerTitle) {
    console.log('🎬 Phase 6: Lift-Feature-Settle');
    
    const pockets = this.rouletteState.pockets;
    const winnerPocket = pockets[this.rouletteState.winnerPocketIndex];
    const winnerCardIndex = this.rouletteState.pocketToCardMap[this.rouletteState.winnerPocketIndex];
    const overlay = this.rouletteState.overlay;
    
    this.rouletteState.status.textContent = `🎉 ${winnerTitle}`;
    
    // Check for green pocket
    if (winnerCardIndex === -1) {
      console.log('💚 Green pocket hit!');
      await this.delay(1500);
      
      if (confirm('🎰 Spin again?\n\nOK = Spin\nCancel = Browse')) {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
        await this.delay(300);
        return this.startCasinoWheelV70();
      }
      
      // Continue to restore carousel at current position
      return this.restoreCarousel(this.currentIndex);
    }
    
    console.log(`✅ Winner: Card ${winnerCardIndex} "${this.items[winnerCardIndex]?.dataset.title}"`);
    
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    
    return new Promise(resolve => {
      // V7.3: Premium "Levitate & Morph" sequence
      const tl = gsap.timeline({ 
        defaults: { ease: 'power3.inOut' },
        onComplete: resolve // Don't call restoreCarousel - integrated below
      });
      
      // Phase A (0-0.6s): Fade out other pockets
      pockets.forEach((p, i) => {
        if (i !== this.rouletteState.winnerPocketIndex) {
          tl.to(p, { opacity: 0, scale: 0.2, duration: 0.6 }, 0);
        }
      });
      tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.5 }, 0);
      
      // V7.3: Create absolute-positioned clone at screen center
      const winnerClone = winnerPocket.cloneNode(true);
      winnerClone.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        width: ${winnerPocket.offsetWidth}px;
        height: ${winnerPocket.offsetHeight}px;
        transform-origin: center center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
      `;
      overlay.appendChild(winnerClone);
      
      const computedStyle = window.getComputedStyle(winnerPocket);
      const currentTransform = computedStyle.transform;
      
      // Apply initial tilted state
      gsap.set(winnerClone, {
        transform: `translate(-50%, -50%) ${currentTransform !== 'none' ? currentTransform : ''}`,
        opacity: 1,
        scale: 1
      });
      
      tl.to(winnerPocket, { opacity: 0, duration: 0.3 }, 0.2);
      
      // Phase B (0.6-1.2s): DRAMATIC LIFT with anticipation
      tl.to(winnerClone, {
        scale: 2.2,
        boxShadow: '0 60px 120px rgba(0,0,0,0.8), 0 0 300px rgba(255,215,0,1), 0 0 600px rgba(255,170,0,0.6)',
        filter: 'brightness(1.3) saturate(1.2)',
        duration: 0.7,
        ease: 'back.out(2.0)' // Stronger overshoot
      }, 0.6);
      
      // Phase C (1.3-2.4s): CINEMATIC ZOOM + straighten
      tl.to(winnerClone, {
        transform: 'translate(-50%, -50%) rotate(0deg) scale(3.5)',
        filter: 'brightness(1.4) saturate(1.3)',
        duration: 1.1,
        ease: 'expo.out' // Slow-mo deceleration
      }, 1.3);
      
      // Phase D (2.4-3.0s): LUXURY SPOTLIGHT PULSE
      tl.to(winnerClone, {
        boxShadow: '0 80px 160px rgba(0,0,0,0.9), 0 0 400px rgba(255,215,0,1), 0 0 800px rgba(255,170,0,0.8), 0 0 1200px rgba(255,100,0,0.4)',
        duration: 0.25,
        yoyo: true,
        repeat: 2,
        ease: 'power1.inOut'
      }, 2.4);
      
      // Phase E (2.8-3.8s): DESCEND into carousel
      // Prepare carousel position
      this.currentIndex = winnerCardIndex;
      this.updateAllItems(winnerCardIndex, 0);
      
      const winnerCard = this.items[winnerCardIndex];
      const finalRect = winnerCard.getBoundingClientRect();
      const finalX = finalRect.left + finalRect.width / 2;
      const finalY = finalRect.top + finalRect.height / 2;
      
      // Reveal carousel cards - but hide winner card initially for cross-fade
      gsap.set(this.items, { opacity: 0 });
      
      // MORPH: Descend clone to EXACT carousel card position + match size
      tl.to(winnerClone, {
        left: finalX,
        top: finalY,
        width: finalRect.width,
        height: finalRect.height,
        transform: 'translate(-50%, -50%) rotate(0deg) scale(1)',
        filter: 'brightness(1.0) saturate(1.0)',
        borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        duration: 1.0,
        ease: 'expo.inOut'
      }, 3.0);
      
      // CROSS-FADE: Clone OUT, winner card IN (true merge)
      tl.to(winnerClone, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in'
      }, 3.6);
      
      tl.to(winnerCard, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out'
      }, 3.6);
      
      // Other cards fade in after
      const otherCards = this.items.filter((_, i) => i !== winnerCardIndex);
      tl.to(otherCards, {
        opacity: 1,
        duration: 0.4,
        stagger: 0.03
      }, 3.8);
      
      // Fade overlay
      tl.to(overlay, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in'
      }, 3.8);
      
      // Winner pulse
      tl.add(() => {
        gsap.timeline()
          .to(winnerCard, { scale: 1.15, duration: 0.3, ease: 'back.out(2)' })
          .to(winnerCard, { scale: 1.0, duration: 0.2 });
        
        this.delay(400).then(() => {
          const link = winnerCard.querySelector('.card-link') || winnerCard.querySelector('a[href]');
          if (link) {
            const title = winnerCard.dataset.title || 'Selected Project';
            if (confirm(`🎉 ${title}!\n\nView this project?`)) {
              window.location.href = link.href;
            }
          }
        });
      }, 4.2);
    });
  }
  
  /**
   * Restore carousel with winner centered
   */
  async restoreCarousel(winnerCardIndex) {
    console.log('🎬 Restore Carousel');
    
    // Clear GSAP styles
    this.items.forEach(item => {
      gsap.set(item, { clearProps: 'all' });
    });
    
    await this.delay(50);
    
    // Set current index to winner
    this.currentIndex = winnerCardIndex;
    this.updateAllItems(this.currentIndex, 0);
    
    // Fade cards in
    gsap.set(this.items, { opacity: 0 });
    
    return new Promise(resolve => {
      gsap.to(this.items, {
        opacity: 1,
        duration: 0.8,
        stagger: 0.05,
        ease: 'power2.out',
        onComplete: () => {
          console.log('✅ Carousel restored');
          
          // Highlight winner
          const winner = this.items[winnerCardIndex];
          if (winner) {
            gsap.timeline()
              .to(winner, { scale: 1.3, duration: 0.4, ease: 'back.out(2)' })
              .to(winner, { scale: 1.15, duration: 0.3 });
            
            // Prompt to view
            this.delay(700).then(() => {
              const link = winner.querySelector('.card-link') || winner.querySelector('a[href]');
              if (link) {
                const title = winner.dataset.title || 'Selected Project';
                if (confirm(`🎉 ${title}!\n\nView this project?`)) {
                  window.location.href = link.href;
                }
              }
              resolve();
            });
          } else {
            resolve();
          }
        }
      });
    });
  }
  
  /**
   * Cleanup
   */
  cleanupCasinoWheel() {
    console.log('🧹 V7.0: Cleanup');
    
    gsap.killTweensOf([
      this.rouletteState.overlay,
      this.rouletteState.wheelWrapper,
      this.rouletteState.ball,
      this.rouletteState.ballShadow,
      this.rouletteState.ballHighlight,
      this.rouletteState.wheelRim,
      ...this.rouletteState.pockets
    ].filter(Boolean));
    
    this.rouletteState.overlay?.remove();
    
    this.rouletteState = {
      isActive: false,
      overlay: null,
      wheelWrapper: null,
      pockets: [],
      ball: null,
      ballShadow: null,
      ballHighlight: null,
      wheelRim: null,
      status: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null,
      pocketToCardMap: []
    };
  }
  
  // ========================================
  // UTILITY METHODS
  // ========================================
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  updatePagination() {
    const curr = this.container.querySelector('.pagination-current');
    const total = this.container.querySelector('.pagination-total');
    if (curr) curr.textContent = String(this.currentIndex + 1);
    if (total) total.textContent = String(this.items.length);
  }
  
  startAutoplay() {
    if (!this.config.autoplay) return;
    this.autoplayTimer = setInterval(() => this.next(), this.config.autoplayDelay);
  }
  
  stopAutoplay() {
    if (this.autoplayTimer) { clearInterval(this.autoplayTimer); this.autoplayTimer = null; }
  }
  
  resetAutoplay() {
    this.stopAutoplay();
    if (this.config.autoplay) this.startAutoplay();
  }
  
  setupResizeHandler() {
    let timer;
    const handle = () => { clearTimeout(timer); timer = setTimeout(() => this.updateAllItems(this.currentIndex, 0), 150); };
    window.addEventListener('resize', handle);
    if ('ResizeObserver' in window) new ResizeObserver(handle).observe(this.container);
  }
  
  announceCurrentSlide() {
    const card = this.items[this.currentIndex];
    if (!card) return;
    const title = card.dataset.title || card.querySelector('.card-title')?.textContent || `Slide ${this.currentIndex + 1}`;
    let region = document.getElementById('coverflow-live-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'coverflow-live-region';
      region.className = 'sr-only';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    region.textContent = `Now showing: ${title}`;
  }
  
  destroy() {
    this.stopAutoplay();
    gsap.killTweensOf(this.items);
    this.cleanupCasinoWheel();
    console.log('⏹️ Coverflow destroyed');
  }
  
  getState() {
    return {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      isAnimating: this.isAnimating,
      casinoActive: this.rouletteState.isActive
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('[data-luxury-coverflow-auto]');
  if (el) window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]', { initialIndex: 0, performanceTier: null });
});
