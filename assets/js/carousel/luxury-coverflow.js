/**
 * Luxury Coverflow V5.9 — ULTIMATE VISUAL FIX
 * 
 * FIXES:
 * ✅ Card previews — Captures GRADIENT + SVG from source cards
 * ✅ Ball animation — GSAP timeline with spin/bounce/glow
 * ✅ Perfect positioning — Absolute within fixed overlay
 * ✅ Smooth restoration — clearProps + updateAllItems
 */

import { gsap } from 'gsap';
import { Coverflow3DEngine } from './coverflow-3d-engine.js';
import { CoverflowPhysics } from './coverflow-physics.js';
import { RouletteWheelEngine } from './roulette-wheel-engine.js';

gsap.ticker.fps(60);

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
    
    this.currentIndex = Math.floor(this.items.length / 2);
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
      ballTimeline: null,
      wheelRim: null,
      status: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null
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
    console.log('✨ Luxury Coverflow V5.9 — ULTIMATE VISUAL FIX 🎰');
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
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 && Math.abs(e.deltaX) > 5) {
        e.preventDefault();
        scrollDeltaX += e.deltaX;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (Math.abs(scrollDeltaX) >= this.config.scrollThreshold) {
            scrollDeltaX > 0 ? this.next() : this.prev();
          }
          scrollDeltaX = 0;
        }, 80);
      }
    }, { passive: false });
  }
  
  setupSmoothScrollTracking() {
    if (!this.config.enableSmoothTracking) return;
    let targetPosition = this.currentIndex, scrollEndTimeout;
    this.container.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.5 || Math.abs(e.deltaX) < 5) return;
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
  // V5.9: ULTIMATE CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 V5.9 Casino wheel ready — ULTIMATE VISUAL FIX');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV59();
    });
  }
  
  /**
   * V5.9: Complete casino wheel with WORKING previews and ball animation
   */
  async startCasinoWheelV59() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V5.9 CASINO — ULTIMATE VISUAL FIX!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Pre-select winner
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.greenPocketIndex = Math.floor(Math.random() * 37);
    this.rouletteState.winnerPocketIndex = this.wheelEngine.getWinnerPocketIndex(
      this.rouletteState.originalWinnerIndex, this.items.length
    );
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: Card ${this.rouletteState.originalWinnerIndex} "${winnerTitle}"`);
    console.log(`💚 Green pocket: ${this.rouletteState.greenPocketIndex}`);
    
    try {
      await this.phase1_CreateOverlay();
      await this.phase2_CreateWheelWithPreviews();
      await this.phase3_SpinWithAnimatedBall();
      await this.phase4_BallLanding();
      await this.phase5_WinnerRise();
      await this.phase6_CenterFocus();
      await this.phase7_GravityDrop();
      await this.phase8_RestoreCarousel(winnerTitle);
      
      console.log('🎉 V5.9 Complete!');
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      this.cleanupCasinoWheel();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  /**
   * Phase 1: Create overlay
   */
  async phase1_CreateOverlay() {
    console.log('📦 Phase 1: Create Overlay');
    
    const overlay = document.createElement('div');
    overlay.className = 'casino-overlay-v59';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      opacity: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.97) 0%, rgba(0, 15, 0, 0.99) 100%);
      overflow: hidden;
    `;
    document.body.appendChild(overlay);
    this.rouletteState.overlay = overlay;
    
    // Status text
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
      gsap.to(overlay, { opacity: 1, duration: 0.5 });
      gsap.to(this.items, { opacity: 0, duration: 0.5, onComplete: resolve });
    });
  }
  
  /**
   * Phase 2: Create wheel with ACTUAL card previews (gradient + SVG)
   */
  async phase2_CreateWheelWithPreviews() {
    console.log('🔄 Phase 2: Create Wheel with REAL Previews');
    this.rouletteState.status.textContent = 'Forming wheel...';
    
    const overlay = this.rouletteState.overlay;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.32;
    
    // Wheel wrapper
    const wheelWrapper = document.createElement('div');
    wheelWrapper.className = 'wheel-wrapper-v59';
    wheelWrapper.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 0;
      height: 0;
      transform-origin: center center;
      will-change: transform;
    `;
    overlay.appendChild(wheelWrapper);
    this.rouletteState.wheelWrapper = wheelWrapper;
    
    // Golden rim
    const rimSize = wheelRadius * 2 + 100;
    const rim = document.createElement('div');
    rim.className = 'wheel-rim-v59';
    rim.style.cssText = `
      position: absolute;
      left: ${-rimSize / 2}px;
      top: ${-rimSize / 2}px;
      width: ${rimSize}px;
      height: ${rimSize}px;
      border: 10px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#002800, #002800) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 60px rgba(255,215,0,0.9),
        0 0 120px rgba(255,215,0,0.5),
        inset 0 0 80px rgba(255,215,0,0.2);
      opacity: 0;
      pointer-events: none;
    `;
    wheelWrapper.appendChild(rim);
    this.rouletteState.wheelRim = rim;
    gsap.to(rim, { opacity: 1, duration: 0.5 });
    
    // European roulette sequence
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
    const pocketW = 75;
    const pocketH = 100;
    const greenIdx = this.rouletteState.greenPocketIndex;
    
    for (let i = 0; i < 37; i++) {
      const data = sequence[i];
      const angle = (360 / 37) * i - 90;
      const angleRad = angle * Math.PI / 180;
      const x = wheelRadius * Math.cos(angleRad);
      const y = wheelRadius * Math.sin(angleRad);
      
      const isGreen = i === greenIdx;
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
      
      const pocket = document.createElement('div');
      pocket.className = 'pocket-v59';
      pocket.dataset.index = i;
      pocket.style.cssText = `
        position: absolute;
        left: ${x - pocketW / 2}px;
        top: ${y - pocketH / 2}px;
        width: ${pocketW}px;
        height: ${pocketH}px;
        border: 4px solid ${borderColor};
        border-radius: 8px;
        overflow: hidden;
        transform: rotate(${angle + 90}deg) scale(0);
        transform-origin: center center;
        opacity: 0;
        box-shadow:
          0 0 25px ${glowColor},
          0 0 50px ${glowColor},
          inset 0 0 15px ${glowColor};
        will-change: transform;
        cursor: pointer;
      `;
      
      if (isGreen) {
        // Green "Try Again" pocket
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
            font-family: Arial Black, sans-serif;
            font-size: 14px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 15px #00FF00;
            line-height: 1.2;
          ">
            <div style="font-size: 140%;">TRY</div>
            <div style="font-size: 140%;">AGAIN</div>
            <div style="font-size: 60%; opacity: 0.8; margin-top: 6px;">or choose</div>
          </div>
        `;
      } else {
        // ✅ V5.9 FIX: Extract ACTUAL card preview (gradient + SVG + title)
        const srcIdx = Math.floor((i / 37) * this.items.length);
        const srcCard = this.items[srcIdx];
        const preview = this.extractCardPreview(srcCard);
        pocket.appendChild(preview);
        
        // Number badge
        const badge = document.createElement('div');
        badge.textContent = data.num;
        badge.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          font-family: Arial Black, sans-serif;
          font-size: 12px;
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 10px #FFD700;
          background: rgba(0, 0, 0, 0.8);
          padding: 2px 5px;
          border-radius: 3px;
          z-index: 10;
        `;
        pocket.appendChild(badge);
      }
      
      wheelWrapper.appendChild(pocket);
      pockets.push(pocket);
    }
    
    this.rouletteState.pockets = pockets;
    console.log(`✅ Created ${pockets.length} pockets with REAL previews`);
    
    // Animate pockets appearing
    return new Promise(resolve => {
      pockets.forEach((pocket, i) => {
        gsap.to(pocket, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          delay: i * 0.02,
          ease: 'back.out(1.5)'
        });
      });
      setTimeout(resolve, 2200);
    });
  }
  
  /**
   * V5.9: Extract REAL preview from card (gradient background + SVG + title)
   */
  extractCardPreview(sourceCard) {
    const preview = document.createElement('div');
    preview.className = 'card-preview-v59';
    preview.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #1a1a2e;
    `;
    
    // Find the .card-bg element and copy its background
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
      
      // Copy SVG icon
      const svg = cardBg.querySelector('svg');
      if (svg) {
        const svgClone = svg.cloneNode(true);
        svgClone.style.cssText = 'width: 40px; height: 40px; opacity: 0.9;';
        bgDiv.appendChild(svgClone);
      }
      
      preview.appendChild(bgDiv);
    } else {
      // Fallback gradient
      const fallback = document.createElement('div');
      fallback.style.cssText = `
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #212842, #3d4666);
      `;
      preview.appendChild(fallback);
    }
    
    // Get title
    const title = sourceCard.dataset.title || 
                  sourceCard.querySelector('.card-title')?.textContent || 
                  'Project';
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title.length > 12 ? title.substring(0, 12) + '...' : title;
    titleEl.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 6px 4px;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(transparent, rgba(0,0,0,0.9));
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    `;
    preview.appendChild(titleEl);
    
    console.log(`🎴 Preview extracted: "${title}"`);
    return preview;
  }
  
  /**
   * Phase 3: Spin wheel with ANIMATED ball (spinning, bouncing, glowing)
   */
  async phase3_SpinWithAnimatedBall() {
    console.log('🎡 Phase 3: Spin with ANIMATED Ball');
    this.rouletteState.status.textContent = 'Spinning...';
    
    const spinParams = this.wheelEngine.calculateWheelSpin(this.rouletteState.winnerPocketIndex);
    const overlay = this.rouletteState.overlay;
    const wrapper = this.rouletteState.wheelWrapper;
    const wheelRadius = Math.min(window.innerWidth, window.innerHeight) * 0.32;
    const duration = spinParams.duration;
    
    // ✅ V5.9: Create ANIMATED ball
    const ball = document.createElement('div');
    ball.className = 'roulette-ball-v59';
    ball.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #fff, #f0f0f0 40%, #ccc 80%, #999);
      z-index: 100;
      pointer-events: none;
      transform-style: preserve-3d;
    `;
    overlay.appendChild(ball);
    this.rouletteState.ball = ball;
    
    // Ball shadow
    const ballShadow = document.createElement('div');
    ballShadow.style.cssText = `
      position: absolute;
      width: 55px;
      height: 20px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%);
      filter: blur(4px);
      z-index: 99;
      pointer-events: none;
    `;
    overlay.appendChild(ballShadow);
    this.rouletteState.ballShadow = ballShadow;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const outerRadius = wheelRadius * 1.18;
    let ballAngle = Math.random() * 360;
    
    // Initial position
    gsap.set(ball, {
      left: centerX + outerRadius * Math.cos(ballAngle * Math.PI / 180) - 25,
      top: centerY + outerRadius * Math.sin(ballAngle * Math.PI / 180) - 25
    });
    gsap.set(ballShadow, {
      left: centerX + outerRadius * Math.cos(ballAngle * Math.PI / 180) - 27,
      top: centerY + outerRadius * Math.sin(ballAngle * Math.PI / 180) + 10
    });
    
    // ✅ V5.9: Create ball animation timeline (spin + bounce + glow)
    const ballTimeline = gsap.timeline({ repeat: -1 });
    
    // Continuous 3D spin
    ballTimeline.to(ball, {
      rotationY: 360,
      rotationX: 30,
      duration: 0.5,
      ease: 'none',
      repeat: -1
    }, 0);
    
    // Bounce effect
    ballTimeline.to(ball, {
      y: -15,
      duration: 0.3,
      yoyo: true,
      repeat: -1,
      ease: 'power1.inOut'
    }, 0);
    
    // Golden glow pulse
    ballTimeline.to(ball, {
      boxShadow: '0 0 60px rgba(255,215,0,1), 0 0 120px rgba(255,215,0,0.8), inset -4px -4px 12px rgba(0,0,0,0.3), inset 4px 4px 12px rgba(255,255,255,0.8)',
      duration: 0.8,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    }, 0);
    
    this.rouletteState.ballTimeline = ballTimeline;
    console.log('⚪ Ball animation timeline STARTED');
    
    const statusEl = this.rouletteState.status;
    
    return new Promise(resolve => {
      // Spin wheel
      gsap.to(wrapper, {
        rotation: spinParams.finalRotation,
        duration,
        ease: 'power3.out'
      });
      
      // Ball orbit animation
      let frames = 0;
      gsap.to({}, {
        duration,
        ease: 'none',
        onUpdate: function() {
          const p = this.progress();
          frames++;
          
          const speed = 3000 * Math.pow(1 - p, 2);
          ballAngle -= speed * 0.016 / 60;
          
          let radius = outerRadius;
          if (p > 0.4) {
            radius = outerRadius - (outerRadius * 0.28 * Math.pow((p - 0.4) / 0.6, 2));
          }
          
          const x = centerX + radius * Math.cos(ballAngle * Math.PI / 180);
          const y = centerY + radius * Math.sin(ballAngle * Math.PI / 180);
          
          gsap.set(ball, { left: x - 25, top: y - 25 });
          gsap.set(ballShadow, { left: x - 27, top: y + 10 });
          
          if (p < 0.3) statusEl.textContent = '🎰 Spinning!';
          else if (p < 0.7) statusEl.textContent = '🎰 Round and round...';
          else statusEl.textContent = '🎰 Slowing...';
        },
        onComplete: () => {
          // Stop ball timeline
          if (ballTimeline) ballTimeline.pause();
          console.log(`⚪ Ball orbit complete (${frames} frames)`);
          resolve();
        }
      });
      
      // Haptic
      if ('vibrate' in navigator) {
        gsap.to({}, {
          duration,
          onUpdate: function() {
            if (Math.random() < 0.05) navigator.vibrate(3);
          }
        });
      }
    });
  }
  
  /**
   * Phase 4: Ball landing
   */
  async phase4_BallLanding() {
    console.log('⚾ Phase 4: Ball Landing');
    this.rouletteState.status.textContent = 'Landing...';
    
    const ball = this.rouletteState.ball;
    const ballShadow = this.rouletteState.ballShadow;
    const winner = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const rect = winner.getBoundingClientRect();
    const tx = rect.left + rect.width / 2 - 25;
    const ty = rect.top + rect.height / 2 - 25;
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      tl.to(ball, { left: tx, top: ty, scale: 1.2, duration: 0.35, ease: 'power2.out' });
      tl.to(ball, { top: ty - 35, duration: 0.2, ease: 'power1.out' });
      tl.to(ball, { top: ty, scale: 1, duration: 0.15, ease: 'bounce.out' });
      tl.to(ball, { top: ty - 15, duration: 0.12, ease: 'power1.out' });
      tl.to(ball, { top: ty, duration: 0.08 });
      
      tl.to(winner, {
        boxShadow: '0 0 100px rgba(255,215,0,1)',
        duration: 0.15,
        repeat: 3,
        yoyo: true
      }, '-=0.4');
      
      tl.to([ball, ballShadow], { opacity: 0, scale: 0, duration: 0.3 });
      
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 150]);
    });
  }
  
  /**
   * Phase 5: Winner rises
   */
  async phase5_WinnerRise() {
    console.log('🏆 Phase 5: Winner Rise');
    this.rouletteState.status.textContent = 'Winner!';
    
    const pockets = this.rouletteState.pockets;
    const winner = pockets[this.rouletteState.winnerPocketIndex];
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      pockets.forEach((p, i) => {
        if (i !== this.rouletteState.winnerPocketIndex) {
          tl.to(p, { opacity: 0, scale: 0.4, duration: 0.5 }, 0);
        }
      });
      
      tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.5 }, 0);
      
      tl.to(winner, {
        scale: 2.5,
        zIndex: 200,
        boxShadow: '0 0 150px rgba(255,215,0,1)',
        duration: 0.8,
        ease: 'back.out(1.3)'
      }, 0.2);
    });
  }
  
  /**
   * Phase 6: Center focus
   */
  async phase6_CenterFocus() {
    console.log('🎯 Phase 6: Center Focus');
    
    const winner = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const title = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    this.rouletteState.status.textContent = `🎉 ${title}`;
    
    const rect = winner.getBoundingClientRect();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = cx - (rect.left + rect.width / 2);
    const dy = cy - (rect.top + rect.height / 2);
    
    return new Promise(resolve => {
      gsap.to(winner, {
        x: `+=${dx}`,
        y: `+=${dy}`,
        rotation: 360,
        scale: 3,
        duration: 1,
        ease: 'power2.inOut',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 7: Gravity drop
   */
  async phase7_GravityDrop() {
    console.log('🔄 Phase 7: Gravity Drop');
    this.rouletteState.status.textContent = 'Returning...';
    
    await this.delay(800);
    
    return new Promise(resolve => {
      gsap.to(this.rouletteState.overlay, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.in',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 8: Restore carousel
   */
  async phase8_RestoreCarousel(winnerTitle) {
    console.log('🎬 Phase 8: Restore Carousel');
    
    // Check green pocket
    if (this.rouletteState.winnerPocketIndex === this.rouletteState.greenPocketIndex) {
      console.log('💚 Green pocket!');
      
      if (confirm('🎰 Spin again?\n\nOK = Spin\nCancel = Browse')) {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
        await this.delay(300);
        return this.startCasinoWheelV59();
      }
    }
    
    // Clear GSAP styles
    this.items.forEach(item => {
      gsap.set(item, { clearProps: 'all' });
    });
    
    await this.delay(50);
    
    // Set winner as current
    this.currentIndex = this.rouletteState.originalWinnerIndex;
    this.updateAllItems(this.currentIndex, 0);
    
    gsap.set(this.items, { opacity: 0 });
    
    return new Promise(resolve => {
      gsap.to(this.items, {
        opacity: 1,
        duration: 0.8,
        stagger: 0.06,
        ease: 'power2.out',
        onComplete: () => {
          console.log('✅ Carousel restored');
          
          const winner = this.items[this.rouletteState.originalWinnerIndex];
          gsap.timeline()
            .to(winner, { scale: 1.3, duration: 0.3, ease: 'back.out(1.8)' })
            .to(winner, { scale: 1.15, duration: 0.2 });
          
          this.delay(600).then(() => {
            const link = winner.querySelector('.card-link') || winner.querySelector('a[href]');
            if (link && confirm(`🎉 ${winnerTitle}!\n\nView project?`)) {
              window.location.href = link.href;
            }
            resolve();
          });
        }
      });
    });
  }
  
  /**
   * Cleanup
   */
  cleanupCasinoWheel() {
    console.log('🧹 V5.9: Cleanup');
    
    // Kill ball timeline
    if (this.rouletteState.ballTimeline) {
      this.rouletteState.ballTimeline.kill();
    }
    
    gsap.killTweensOf([
      this.rouletteState.overlay,
      this.rouletteState.wheelWrapper,
      this.rouletteState.ball,
      this.rouletteState.ballShadow,
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
      ballTimeline: null,
      wheelRim: null,
      status: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null
    };
    
    console.log('✅ Cleanup done');
  }
  
  // ========================================
  // UTILITY METHODS
  // ========================================
  
  gsapTo(target, vars) {
    return new Promise(resolve => gsap.to(target, { ...vars, onComplete: resolve }));
  }
  
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
  if (el) window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]');
});
