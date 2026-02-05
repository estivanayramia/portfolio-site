/**
 * Luxury Coverflow V5.8 — COMPLETE VISUAL PERFECTION FIX
 * 
 * FIXES:
 * ✅ POSITIONING — Absolute instead of fixed (fixes transform flattening)
 * ✅ CARD CLONING — Deep clone with computed style preservation
 * ✅ RESTORATION — clearProps + updateAllItems() for perfect return
 * ✅ ALIGNMENT — Perfect circular pocket arrangement
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
      savedCardStates: [],
      overlay: null,
      wheelContainer: null,
      pockets: [],
      ball: null,
      ballShadow: null,
      status: null,
      wheelRim: null,
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
    console.log('✨ Luxury Coverflow V5.8 — VISUAL PERFECTION EDITION 🎰');
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
  // V5.8: PERFECT CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 V5.8 Casino wheel ready — VISUAL PERFECTION');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV58();
    });
  }
  
  /**
   * V5.8: Save card states (numeric values only)
   */
  saveCardStates() {
    this.rouletteState.savedCardStates = this.items.map((card, index) => {
      const style = window.getComputedStyle(card);
      const matrix = new DOMMatrix(style.transform);
      
      return {
        index,
        x: matrix.m41 || 0,
        y: matrix.m42 || 0,
        z: matrix.m43 || 0,
        scale: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) || 1,
        rotationY: Math.atan2(matrix.m13, matrix.m33) * (180 / Math.PI) || 0,
        opacity: parseFloat(style.opacity) || 1,
        zIndex: parseInt(style.zIndex) || 0
      };
    });
    console.log('💾 V5.8: Saved card states');
  }
  
  /**
   * V5.8: Deep clone card with style preservation
   */
  cloneCardWithStyles(sourceCard) {
    const clone = sourceCard.cloneNode(true);
    
    const sourceElements = [sourceCard, ...sourceCard.querySelectorAll('*')];
    const cloneElements = [clone, ...clone.querySelectorAll('*')];
    
    sourceElements.forEach((sourceEl, idx) => {
      const cloneEl = cloneElements[idx];
      if (!cloneEl) return;
      
      const cs = window.getComputedStyle(sourceEl);
      
      // Copy key visual properties
      ['color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
       'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign',
       'padding', 'borderRadius', 'display', 'flexDirection', 'alignItems', 'justifyContent'
      ].forEach(prop => {
        const val = cs.getPropertyValue(prop);
        if (val && val !== 'none') cloneEl.style[prop] = val;
      });
      
      // Image sources
      if (sourceEl.tagName === 'IMG') {
        cloneEl.src = sourceEl.src;
        cloneEl.srcset = sourceEl.srcset || '';
      }
    });
    
    // Reset transforms
    clone.style.transform = 'none';
    clone.style.opacity = '1';
    clone.style.filter = 'none';
    clone.style.position = 'relative';
    clone.style.width = '100%';
    clone.style.height = '100%';
    
    return clone;
  }
  
  /**
   * V5.8: Complete 8-phase casino wheel
   */
  async startCasinoWheelV58() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V5.8 CASINO WHEEL — VISUAL PERFECTION!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Pre-select
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.greenPocketIndex = Math.floor(Math.random() * 37);
    
    // Winner pocket (avoid green)
    let winnerPocket = Math.floor((this.rouletteState.originalWinnerIndex / this.items.length) * 37);
    if (winnerPocket === this.rouletteState.greenPocketIndex) {
      winnerPocket = (winnerPocket + 1) % 37;
    }
    this.rouletteState.winnerPocketIndex = winnerPocket;
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: Card ${this.rouletteState.originalWinnerIndex} → Pocket ${winnerPocket}`);
    console.log(`💚 Green pocket: ${this.rouletteState.greenPocketIndex}`);
    
    this.saveCardStates();
    
    try {
      await this.phase1_CreateOverlay();
      await this.phase2_CreateWheel();
      await this.phase3_SpinWheel();
      await this.phase4_BallLanding();
      await this.phase5_WinnerRise();
      await this.phase6_CenterFocus();
      await this.phase7_GravityDrop();
      await this.phase8_RestoreCarousel(winnerTitle);
      
      console.log('🎉 V5.8 Complete!');
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      this.cleanupCasinoWheel();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  /**
   * Phase 1: Create fixed overlay
   */
  async phase1_CreateOverlay() {
    console.log('📦 Phase 1: Create Overlay');
    
    // Fixed overlay (only element that's fixed)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      opacity: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.96) 0%, rgba(0, 15, 0, 0.99) 100%);
      overflow: hidden;
    `;
    document.body.appendChild(overlay);
    this.rouletteState.overlay = overlay;
    
    // Status text
    const status = document.createElement('div');
    status.textContent = 'Preparing...';
    status.style.cssText = `
      position: absolute;
      bottom: 4rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(1.2rem, 3vw, 2rem);
      font-weight: 700;
      color: #FFD700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      z-index: 10010;
      opacity: 0;
      text-shadow: 0 0 30px #FFD700, 0 0 60px rgba(255,215,0,0.5);
    `;
    overlay.appendChild(status);
    this.rouletteState.status = status;
    
    gsap.to(overlay, { opacity: 1, duration: 0.4 });
    gsap.to(status, { opacity: 1, duration: 0.3, delay: 0.2 });
    
    // Hide original cards
    return new Promise(resolve => {
      gsap.to(this.items, {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        stagger: 0.03,
        ease: 'power2.in',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 2: Create wheel with ABSOLUTE positioning (V5.8 FIX)
   */
  async phase2_CreateWheel() {
    console.log('🔄 Phase 2: Create Wheel (V5.8 - ABSOLUTE positioning)');
    this.rouletteState.status.textContent = 'Forming wheel...';
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;
    const wheelRadius = Math.min(vw, vh) * 0.30;
    
    console.log(`🎯 Center: (${centerX}, ${centerY}), Radius: ${wheelRadius}px`);
    
    // Wheel container (ABSOLUTE inside the fixed overlay)
    const wheelContainer = document.createElement('div');
    wheelContainer.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;
    this.rouletteState.overlay.appendChild(wheelContainer);
    this.rouletteState.wheelContainer = wheelContainer;
    
    // Golden rim (ABSOLUTE)
    const rimSize = wheelRadius * 2 + 100;
    const rim = document.createElement('div');
    rim.style.cssText = `
      position: absolute;
      left: ${centerX - rimSize / 2}px;
      top: ${centerY - rimSize / 2}px;
      width: ${rimSize}px;
      height: ${rimSize}px;
      border: 10px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#002200, #002200) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 60px rgba(255,215,0,0.9),
        0 0 120px rgba(255,215,0,0.6),
        inset 0 0 80px rgba(255,215,0,0.3);
      opacity: 0;
      will-change: transform;
      transform-origin: center center;
    `;
    wheelContainer.appendChild(rim);
    this.rouletteState.wheelRim = rim;
    gsap.to(rim, { opacity: 1, duration: 0.5 });
    
    // European sequence
    const europeanSequence = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    
    const pockets = [];
    const pocketWidth = 70;
    const pocketHeight = 95;
    
    for (let i = 0; i < 37; i++) {
      const number = europeanSequence[i];
      const angle = (i * (360 / 37)) - 90; // Start from top
      const angleRad = angle * Math.PI / 180;
      
      const x = centerX + wheelRadius * Math.cos(angleRad);
      const y = centerY + wheelRadius * Math.sin(angleRad);
      
      const isGreen = i === this.rouletteState.greenPocketIndex;
      const isRed = !isGreen && number !== 0 && redNumbers.includes(number);
      
      let borderColor, glowColor;
      if (isGreen) {
        borderColor = '#00FF00';
        glowColor = 'rgba(0, 255, 0, 0.9)';
      } else if (isRed) {
        borderColor = '#FF0000';
        glowColor = 'rgba(255, 0, 0, 0.85)';
      } else {
        borderColor = '#FFFFFF';
        glowColor = 'rgba(255, 255, 255, 0.7)';
      }
      
      // Create pocket (ABSOLUTE position)
      const pocket = document.createElement('div');
      pocket.dataset.pocketIndex = i;
      pocket.dataset.pocketNumber = number;
      
      pocket.style.cssText = `
        position: absolute;
        left: ${x - pocketWidth / 2}px;
        top: ${y - pocketHeight / 2}px;
        width: ${pocketWidth}px;
        height: ${pocketHeight}px;
        border-radius: 8px;
        border: 4px solid ${borderColor};
        overflow: hidden;
        transform: rotate(${angle + 90}deg) scale(0);
        transform-origin: center center;
        opacity: 0;
        background: #111;
        box-shadow:
          0 0 25px ${glowColor},
          0 0 50px ${glowColor},
          inset 0 0 20px ${glowColor};
        will-change: transform;
        pointer-events: auto;
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
            background: linear-gradient(135deg, #003300, #006600);
            color: #00FF00;
            font-family: 'Arial Black', sans-serif;
            font-size: 13px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 15px #00FF00;
            line-height: 1.3;
          ">
            <div style="font-size: 140%;">TRY</div>
            <div style="font-size: 140%; margin-top: -3px;">AGAIN</div>
            <div style="font-size: 65%; opacity: 0.8; margin-top: 6px;">or choose</div>
          </div>
        `;
      } else {
        // Clone card content
        const sourceIndex = Math.floor((i / 37) * this.items.length);
        const sourceCard = this.items[sourceIndex];
        
        if (sourceCard) {
          const cardClone = this.cloneCardWithStyles(sourceCard);
          pocket.appendChild(cardClone);
          
          // Dark overlay
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            pointer-events: none;
            z-index: 5;
          `;
          pocket.appendChild(overlay);
        }
        
        // Number badge
        const badge = document.createElement('div');
        badge.textContent = number;
        badge.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          font-family: 'Arial Black', sans-serif;
          font-size: 13px;
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 10px #FFD700;
          z-index: 10;
          background: rgba(0, 0, 0, 0.7);
          padding: 2px 6px;
          border-radius: 4px;
        `;
        pocket.appendChild(badge);
      }
      
      wheelContainer.appendChild(pocket);
      pockets.push(pocket);
    }
    
    this.rouletteState.pockets = pockets;
    console.log(`✅ Created ${pockets.length} pockets in perfect circle`);
    
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
      setTimeout(resolve, 2000);
    });
  }
  
  /**
   * Phase 3: Spin wheel
   */
  async phase3_SpinWheel() {
    console.log('🎡 Phase 3: Spin Wheel');
    this.rouletteState.status.textContent = 'Spinning...';
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;
    const wheelRadius = Math.min(vw, vh) * 0.30;
    
    // Spin calculation
    const winnerPocket = this.rouletteState.winnerPocketIndex;
    const pocketAngle = (winnerPocket * (360 / 37));
    const spins = 4 + Math.random() * 2;
    const finalRotation = (spins * 360) + (360 - pocketAngle);
    const duration = 5 + Math.random() * 1.5;
    
    // Create ball (ABSOLUTE position)
    const ball = document.createElement('div');
    ball.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0 50%, #a0a0a0);
      box-shadow:
        0 0 50px rgba(255,255,255,1),
        0 0 100px rgba(255,215,0,1),
        0 0 150px rgba(255,215,0,0.8),
        inset -4px -4px 12px rgba(0,0,0,0.3),
        inset 4px 4px 12px rgba(255,255,255,0.9);
      z-index: 10006;
      pointer-events: none;
      filter: brightness(1.5);
      will-change: transform, left, top;
    `;
    this.rouletteState.wheelContainer.appendChild(ball);
    this.rouletteState.ball = ball;
    
    // Ball shadow
    const ballShadow = document.createElement('div');
    ballShadow.style.cssText = `
      position: absolute;
      width: 60px;
      height: 25px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%);
      filter: blur(5px);
      z-index: 10005;
      pointer-events: none;
    `;
    this.rouletteState.wheelContainer.appendChild(ballShadow);
    this.rouletteState.ballShadow = ballShadow;
    
    // Initial ball position
    const outerRadius = wheelRadius * 1.15;
    let ballAngle = Math.random() * 360;
    const startX = centerX + outerRadius * Math.cos(ballAngle * Math.PI / 180);
    const startY = centerY + outerRadius * Math.sin(ballAngle * Math.PI / 180);
    
    gsap.set(ball, { left: startX - 25, top: startY - 25 });
    gsap.set(ballShadow, { left: startX - 30, top: startY + 5 });
    console.log(`⚪ Ball at (${Math.round(startX)}, ${Math.round(startY)})`);
    
    const pockets = this.rouletteState.pockets;
    const rim = this.rouletteState.wheelRim;
    const statusEl = this.rouletteState.status;
    
    return new Promise(resolve => {
      // Rotate all pockets together
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Calculate rotation for each pocket around center
      pockets.forEach((pocket, i) => {
        const originalAngle = (i * (360 / 37)) - 90;
        tl.to(pocket, {
          rotation: originalAngle + 90 + finalRotation,
          duration,
          ease: 'power3.out'
        }, 0);
      });
      
      tl.to(rim, {
        rotation: finalRotation,
        duration,
        ease: 'power3.out'
      }, 0);
      
      // Ball animation
      let frameCount = 0;
      gsap.to({}, {
        duration,
        ease: 'none',
        onUpdate: function() {
          const progress = this.progress();
          frameCount++;
          
          const ballSpeed = 2600 * Math.pow(1 - progress, 1.8);
          ballAngle -= ballSpeed * 0.016 / 60;
          
          let currentRadius = outerRadius;
          if (progress > 0.5) {
            const spiral = (progress - 0.5) / 0.5;
            currentRadius = outerRadius - (outerRadius * 0.25 * Math.pow(spiral, 2));
          }
          
          const angleRad = ballAngle * Math.PI / 180;
          const x = centerX + currentRadius * Math.cos(angleRad);
          const y = centerY + currentRadius * Math.sin(angleRad);
          
          gsap.set(ball, { left: x - 25, top: y - 25 });
          gsap.set(ballShadow, { left: x - 30, top: y + 5 });
          
          if (progress < 0.3) statusEl.textContent = '🎰 Spinning fast!';
          else if (progress < 0.7) statusEl.textContent = '🎰 Round and round...';
          else statusEl.textContent = '🎰 Slowing down...';
          
          if (frameCount % 60 === 0) {
            console.log(`⚪ Ball: ${Math.round(progress * 100)}%`);
          }
        }
      });
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
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const rect = winnerPocket.getBoundingClientRect();
    const overlayRect = this.rouletteState.overlay.getBoundingClientRect();
    
    const targetX = rect.left - overlayRect.left + rect.width / 2;
    const targetY = rect.top - overlayRect.top + rect.height / 2;
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      tl.to(ball, { left: targetX - 25, top: targetY - 25, scale: 1.2, duration: 0.35, ease: 'power2.out' });
      tl.to(ball, { top: targetY - 60, duration: 0.2, ease: 'power1.out' });
      tl.to(ball, { top: targetY - 25, duration: 0.15, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 35, duration: 0.12, ease: 'power1.out' });
      tl.to(ball, { top: targetY - 25, scale: 1, duration: 0.08, ease: 'power2.in' });
      
      tl.to(winnerPocket, {
        boxShadow: '0 0 100px rgba(255,215,0,1), inset 0 0 50px rgba(255,215,0,0.6)',
        duration: 0.15,
        repeat: 3,
        yoyo: true
      }, '-=0.3');
      
      tl.to([ball, ballShadow], { opacity: 0, scale: 0, duration: 0.25 });
      
      if ('vibrate' in navigator) tl.call(() => navigator.vibrate([80, 40, 120]));
    });
  }
  
  /**
   * Phase 5: Winner rises
   */
  async phase5_WinnerRise() {
    console.log('🏆 Phase 5: Winner Rise');
    this.rouletteState.status.textContent = 'Winner!';
    
    const pockets = this.rouletteState.pockets;
    const winnerPocket = pockets[this.rouletteState.winnerPocketIndex];
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      pockets.forEach((p, i) => {
        if (i !== this.rouletteState.winnerPocketIndex) {
          tl.to(p, { opacity: 0, scale: 0.4, duration: 0.5 }, 0);
        }
      });
      
      tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.5 }, 0);
      
      tl.to(winnerPocket, {
        scale: 2.5,
        zIndex: 10010,
        boxShadow: '0 0 150px rgba(255,215,0,1)',
        duration: 1,
        ease: 'back.out(1.3)'
      }, 0.2);
    });
  }
  
  /**
   * Phase 6: Center focus
   */
  async phase6_CenterFocus() {
    console.log('🎯 Phase 6: Center Focus');
    
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    this.rouletteState.status.textContent = `🎉 ${winnerTitle}`;
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = winnerPocket.getBoundingClientRect();
    const overlayRect = this.rouletteState.overlay.getBoundingClientRect();
    
    const currentLeft = parseFloat(winnerPocket.style.left);
    const currentTop = parseFloat(winnerPocket.style.top);
    const targetLeft = vw / 2 - rect.width / 2;
    const targetTop = vh / 2 - rect.height / 2;
    
    return new Promise(resolve => {
      gsap.to(winnerPocket, {
        left: targetLeft,
        top: targetTop,
        rotation: 360,
        scale: 3,
        duration: 1,
        ease: 'power2.inOut',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 7: Natural gravity drop
   */
  async phase7_GravityDrop() {
    console.log('🔄 Phase 7: Gravity Drop');
    this.rouletteState.status.textContent = 'Returning...';
    
    await this.delay(800);
    
    // Fade out overlay
    gsap.to(this.rouletteState.overlay, { opacity: 0, duration: 0.6 });
    
    return this.delay(700);
  }
  
  /**
   * Phase 8: PERFECT carousel restoration (V5.8 FIX)
   */
  async phase8_RestoreCarousel(winnerTitle) {
    console.log('🎬 Phase 8: Perfect Carousel Restoration');
    
    // Check green pocket
    if (this.rouletteState.winnerPocketIndex === this.rouletteState.greenPocketIndex) {
      console.log('💚 Green pocket! Try Again flow');
      
      if (confirm('🎰 Spin again?\n\nOK = Spin\nCancel = Browse')) {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
        await this.delay(300);
        return this.startCasinoWheelV58();
      }
    }
    
    // ✅ V5.8 FIX: Clear ALL GSAP-added inline styles
    this.items.forEach(card => {
      gsap.set(card, { clearProps: 'all' });
    });
    
    await this.delay(100);
    
    // Set winner as current
    this.currentIndex = this.rouletteState.originalWinnerIndex;
    
    // ✅ V5.8 FIX: Re-trigger carousel update (resets all positions correctly)
    this.updateAllItems(this.currentIndex, 0.8);
    
    await this.delay(900);
    
    // Winner celebration
    const winner = this.items[this.currentIndex];
    await this.gsapTo(winner, { scale: 1.4, duration: 0.3, ease: 'back.out(1.8)' });
    await this.gsapTo(winner, { scale: 1.25, duration: 0.2 });
    
    await this.delay(500);
    
    const link = winner.querySelector('.card-link') || winner.querySelector('a[href]');
    if (link && window.confirm(`🎉 ${winnerTitle}!\n\nView project?`)) {
      window.location.href = link.href;
    }
    
    console.log('✅ V5.8: Carousel perfectly restored');
  }
  
  /**
   * Cleanup
   */
  cleanupCasinoWheel() {
    console.log('🧹 V5.8: Cleanup');
    
    gsap.killTweensOf([
      this.rouletteState.ball,
      this.rouletteState.ballShadow,
      this.rouletteState.wheelRim,
      this.rouletteState.wheelContainer,
      this.rouletteState.overlay,
      ...this.rouletteState.pockets
    ].filter(Boolean));
    
    this.rouletteState.overlay?.remove();
    
    this.rouletteState = {
      isActive: false,
      savedCardStates: [],
      overlay: null,
      wheelContainer: null,
      pockets: [],
      ball: null,
      ballShadow: null,
      status: null,
      wheelRim: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null
    };
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
