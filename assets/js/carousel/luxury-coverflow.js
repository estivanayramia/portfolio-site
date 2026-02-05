/**
 * Luxury Coverflow V5.7 — CRITICAL EMERGENCY FIX
 * 
 * FIXES:
 * ✅ GSAP "Invalid property rect" — No DOMRect in saved states
 * ✅ Card content visible — Proper cloning with innerHTML preservation
 * ✅ Ball spinning — Massive glow + correct positioning + logging
 * ✅ Performance — GPU acceleration, no backdrop-filter
 * ✅ Positioning — Correct transform calculations
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
      wheelContainer: null,
      pockets: [],
      pocketContainer: null,
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
    console.log('✨ Luxury Coverflow V5.7 — CRITICAL FIX EDITION 🎰');
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
  // V5.7: FIXED CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 V5.7 Casino wheel ready — ALL FIXES APPLIED');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV57();
    });
  }
  
  /**
   * V5.7: FIXED - Save card states WITHOUT DOMRect objects
   */
  saveCardStates() {
    this.rouletteState.savedCardStates = this.items.map((card, index) => {
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      const matrix = new DOMMatrix(style.transform);
      
      // ✅ ONLY numeric/string values - NO DOMRect!
      return {
        index,
        x: matrix.m41 || 0,
        y: matrix.m42 || 0,
        z: matrix.m43 || 0,
        scale: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) || 1,
        rotation: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI) || 0,
        rotationX: 0,
        rotationY: 0,
        opacity: parseFloat(style.opacity) || 1,
        zIndex: parseInt(style.zIndex) || 0,
        width: rect.width,
        height: rect.height
        // ❌ NO rect: DOMRect - this breaks GSAP!
      };
    });
    console.log('✅ V5.7: Saved card states (NO DOMRect objects)');
  }
  
  /**
   * V5.7: Complete 8-phase casino wheel with ALL FIXES
   */
  async startCasinoWheelV57() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V5.7 CASINO WHEEL — ALL FIXES APPLIED!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Pre-select winner
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.greenPocketIndex = this.wheelEngine.getRandomGreenPocket();
    this.rouletteState.winnerPocketIndex = this.wheelEngine.getWinnerPocketIndex(
      this.rouletteState.originalWinnerIndex, this.items.length
    );
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: Card ${this.rouletteState.originalWinnerIndex} "${winnerTitle}"`);
    console.log(`💚 Green pocket: ${this.rouletteState.greenPocketIndex}`);
    console.log(`🎯 Winner pocket: ${this.rouletteState.winnerPocketIndex}`);
    
    this.saveCardStates();
    
    try {
      await this.phase1_Levitation();
      await this.phase2_CreateWheel();
      await this.phase3_SpinWheel();
      await this.phase4_BallLanding();
      await this.phase5_WinnerRise();
      await this.phase6_CenterFocus();
      await this.phase7_GravityDrop();
      await this.phase8_CarouselReveal(winnerTitle);
      
      console.log('🎉 V5.7 Complete!');
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      this.cleanupCasinoWheel();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  /**
   * Phase 1: Fast levitation
   */
  async phase1_Levitation() {
    console.log('📦 Phase 1: Levitation');
    
    // Casino overlay (NO backdrop-filter for performance)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      opacity: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.96) 0%, rgba(0, 15, 0, 0.98) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1200px;
    `;
    document.body.appendChild(overlay);
    this.rouletteState.wheelContainer = overlay;
    
    // Status
    const status = document.createElement('div');
    status.textContent = 'Preparing...';
    status.style.cssText = `
      position: fixed;
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
    document.body.appendChild(status);
    this.rouletteState.status = status;
    
    gsap.to(overlay, { opacity: 1, duration: 0.4 });
    gsap.to(status, { opacity: 1, duration: 0.3, delay: 0.2 });
    
    return new Promise(resolve => {
      gsap.to(this.items, {
        y: -80,
        z: 350,
        scale: 0.6,
        rotationX: 0,
        rotationY: 0,
        opacity: 0.85,
        duration: 1,
        stagger: 0.05,
        ease: 'power2.out',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 2: Create wheel with VISIBLE card content
   */
  async phase2_CreateWheel() {
    console.log('🔄 Phase 2: Create Wheel (FIXED card content)');
    this.rouletteState.status.textContent = 'Forming wheel...';
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wheelRadius = this.wheelEngine.config.wheelRadius();
    
    // Golden rim
    const rim = document.createElement('div');
    rim.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${wheelRadius * 2 + 80}px;
      height: ${wheelRadius * 2 + 80}px;
      transform: translate(-50%, -50%);
      border: 8px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#002200, #002200) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 40px rgba(255,215,0,0.8),
        0 0 80px rgba(255,215,0,0.5),
        inset 0 0 50px rgba(255,215,0,0.2);
      z-index: 10001;
      opacity: 0;
      will-change: transform;
    `;
    document.body.appendChild(rim);
    this.rouletteState.wheelRim = rim;
    gsap.to(rim, { opacity: 1, duration: 0.5 });
    
    // Pocket container
    const pocketContainer = document.createElement('div');
    pocketContainer.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 0;
      height: 0;
      z-index: 10002;
      transform-style: preserve-3d;
      will-change: transform;
    `;
    
    const positions = this.wheelEngine.calculatePocketPositions(centerX, centerY);
    const greenIndex = this.rouletteState.greenPocketIndex;
    const pockets = [];
    
    for (let i = 0; i < 37; i++) {
      const pos = positions[i];
      const isGreen = i === greenIndex;
      const sourceIndex = Math.floor((i / 37) * this.items.length);
      const sourceCard = this.items[sourceIndex];
      
      // Determine colors
      let borderColor, glowColor;
      if (isGreen) {
        borderColor = '#00FF00';
        glowColor = 'rgba(0, 255, 0, 0.9)';
      } else if (pos.pocketData.color === 'red') {
        borderColor = '#FF0000';
        glowColor = 'rgba(255, 0, 0, 0.8)';
      } else {
        borderColor = '#FFFFFF';
        glowColor = 'rgba(255, 255, 255, 0.6)';
      }
      
      // Create pocket element
      const pocket = document.createElement('div');
      pocket.dataset.pocketIndex = i;
      
      const relX = pos.x - centerX;
      const relY = pos.y - centerY;
      
      pocket.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: clamp(45px, 7vmin, 75px);
        height: clamp(65px, 10vmin, 95px);
        border-radius: 6px;
        border: 3px solid ${borderColor};
        overflow: hidden;
        transform: translate(${relX}px, ${relY}px) rotate(${pos.rotation}deg) scale(0);
        transform-origin: center center;
        opacity: 0;
        background: #111;
        box-shadow:
          0 0 20px ${glowColor},
          0 0 40px ${glowColor},
          inset 0 0 15px ${glowColor};
        will-change: transform;
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
            background: linear-gradient(135deg, #003300, #006600, #003300);
            color: #00FF00;
            font-family: Arial Black, sans-serif;
            font-size: clamp(10px, 2vmin, 16px);
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 15px #00FF00;
            line-height: 1.2;
          ">
            <div style="font-size: 130%;">TRY</div>
            <div style="font-size: 130%;">AGAIN</div>
            <div style="font-size: 70%; opacity: 0.8; margin-top: 4px;">or choose</div>
          </div>
        `;
      } else {
        // ✅ FIXED: Copy actual card content
        pocket.innerHTML = sourceCard.innerHTML;
        
        // Add dark overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.25);
          pointer-events: none;
          z-index: 1;
        `;
        pocket.appendChild(overlay);
        
        // Number badge
        const badge = document.createElement('div');
        badge.textContent = pos.pocketData.number;
        badge.style.cssText = `
          position: absolute;
          top: 3px;
          right: 3px;
          font-family: Arial Black, sans-serif;
          font-size: clamp(10px, 1.8vmin, 14px);
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 8px #FFD700;
          z-index: 10;
          background: rgba(0, 0, 0, 0.7);
          padding: 2px 5px;
          border-radius: 3px;
        `;
        pocket.appendChild(badge);
      }
      
      pockets.push(pocket);
      pocketContainer.appendChild(pocket);
    }
    
    document.body.appendChild(pocketContainer);
    this.rouletteState.pockets = pockets;
    this.rouletteState.pocketContainer = pocketContainer;
    
    // Hide original cards
    gsap.to(this.items, { opacity: 0, duration: 0.4 });
    
    // Animate pockets appearing
    return new Promise(resolve => {
      pockets.forEach((pocket, i) => {
        gsap.to(pocket, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          delay: i * 0.02,
          ease: 'back.out(1.3)'
        });
      });
      setTimeout(resolve, 2000);
    });
  }
  
  /**
   * Phase 3: Spin wheel with VISIBLE ball
   */
  async phase3_SpinWheel() {
    console.log('🎡 Phase 3: Spin Wheel (FIXED ball visibility)');
    this.rouletteState.status.textContent = 'Spinning...';
    
    const spinParams = this.wheelEngine.calculateWheelSpin(this.rouletteState.winnerPocketIndex);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wheelRadius = this.wheelEngine.config.wheelRadius();
    
    // ✅ FIXED: Create HIGHLY VISIBLE ball
    const ball = document.createElement('div');
    ball.style.cssText = `
      position: fixed;
      width: clamp(40px, 7vmin, 65px);
      height: clamp(40px, 7vmin, 65px);
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #ffffff, #f5f5f5 30%, #d5d5d5 70%, #b0b0b0);
      box-shadow:
        0 0 50px rgba(255,255,255,1),
        0 0 100px rgba(255,215,0,1),
        0 0 150px rgba(255,215,0,0.8),
        0 0 200px rgba(255,215,0,0.6),
        inset -4px -4px 15px rgba(0,0,0,0.3),
        inset 4px 4px 15px rgba(255,255,255,0.9),
        0 20px 60px rgba(0,0,0,0.5);
      z-index: 10006;
      pointer-events: none;
      filter: brightness(1.6);
      will-change: transform, left, top;
    `;
    document.body.appendChild(ball);
    this.rouletteState.ball = ball;
    console.log('⚪ Ball created with MASSIVE glow');
    
    // Ball shadow
    const ballShadow = document.createElement('div');
    ballShadow.style.cssText = `
      position: fixed;
      width: clamp(50px, 8vmin, 75px);
      height: clamp(20px, 4vmin, 30px);
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, transparent 70%);
      filter: blur(5px);
      z-index: 10005;
      pointer-events: none;
      will-change: transform, left, top;
    `;
    document.body.appendChild(ballShadow);
    this.rouletteState.ballShadow = ballShadow;
    
    const outerRadius = wheelRadius * 1.15;
    let ballAngle = Math.random() * 360;
    
    // Initial position
    const startX = centerX + outerRadius * Math.cos(ballAngle * Math.PI / 180);
    const startY = centerY + outerRadius * Math.sin(ballAngle * Math.PI / 180);
    
    gsap.set(ball, { left: startX, top: startY, xPercent: -50, yPercent: -50 });
    gsap.set(ballShadow, { left: startX + 5, top: startY + 15, xPercent: -50, yPercent: -50 });
    console.log(`⚪ Ball positioned at (${Math.round(startX)}, ${Math.round(startY)})`);
    
    const pocketContainer = this.rouletteState.pocketContainer;
    const rim = this.rouletteState.wheelRim;
    const duration = spinParams.duration;
    const statusEl = this.rouletteState.status;
    
    return new Promise(resolve => {
      // Wheel rotation
      gsap.to([pocketContainer, rim], {
        rotation: spinParams.finalRotation,
        duration,
        ease: 'power3.out'
      });
      console.log(`🎡 Wheel spinning to ${Math.round(spinParams.finalRotation)}° over ${duration.toFixed(1)}s`);
      
      // ✅ FIXED: Ball animation with logging
      let frameCount = 0;
      gsap.to({}, {
        duration,
        ease: 'none',
        onUpdate: function() {
          const progress = this.progress();
          frameCount++;
          
          // Ball speed decay
          const ballSpeed = 2800 * Math.pow(1 - progress, 1.9);
          ballAngle -= ballSpeed * 0.016 / 60;
          
          // Spiral inward
          let currentRadius = outerRadius;
          if (progress > 0.45) {
            const spiral = (progress - 0.45) / 0.55;
            currentRadius = outerRadius - (outerRadius * 0.3 * Math.pow(spiral, 2.2));
          }
          
          const angleRad = ballAngle * Math.PI / 180;
          const x = centerX + currentRadius * Math.cos(angleRad);
          const y = centerY + currentRadius * Math.sin(angleRad);
          
          gsap.set(ball, { left: x, top: y });
          gsap.set(ballShadow, { left: x + 5, top: y + 15 });
          
          if (progress < 0.3) {
            statusEl.textContent = '🎰 Spinning fast!';
          } else if (progress < 0.7) {
            statusEl.textContent = '🎰 Round and round...';
          } else {
            statusEl.textContent = '🎰 Slowing down...';
          }
          
          // Log every second (60fps)
          if (frameCount % 60 === 0) {
            console.log(`⚪ Ball: ${Math.round(progress * 100)}% pos(${Math.round(x)},${Math.round(y)})`);
          }
        },
        onComplete: () => {
          console.log(`⚪ Ball spin complete (${frameCount} frames)`);
          resolve();
        }
      });
      
      // Haptic
      if ('vibrate' in navigator) {
        let lastTick = 0;
        gsap.to({}, {
          duration,
          onUpdate: function() {
            const p = this.progress();
            if (p - lastTick > 0.1 / (1 - p * 0.5)) {
              navigator.vibrate(3);
              lastTick = p;
            }
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
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const pocketRect = winnerPocket.getBoundingClientRect();
    const targetX = pocketRect.left + pocketRect.width / 2;
    const targetY = pocketRect.top + pocketRect.height / 2;
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Bounce sequence
      tl.to(ball, { left: targetX, top: targetY, scale: 1.3, duration: 0.4, ease: 'power2.out' });
      tl.to(ball, { top: targetY - 40, duration: 0.25, ease: 'power1.out' });
      tl.to(ball, { top: targetY, scale: 1.1, duration: 0.2, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 15, duration: 0.15, ease: 'power1.out' });
      tl.to(ball, { top: targetY, scale: 1, duration: 0.1, ease: 'power2.in' });
      
      // Winner glow
      tl.to(winnerPocket, {
        boxShadow: '0 0 80px rgba(255,215,0,1), inset 0 0 40px rgba(255,215,0,0.6)',
        duration: 0.2,
        repeat: 3,
        yoyo: true
      }, '-=0.4');
      
      tl.to([ball, ballShadow], { opacity: 0, scale: 0, duration: 0.3 });
      
      if ('vibrate' in navigator) tl.call(() => navigator.vibrate([100, 50, 150]));
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
          tl.to(p, { opacity: 0, scale: 0.5, duration: 0.5 }, 0);
        }
      });
      
      tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.6 }, 0);
      
      tl.to(winnerPocket, {
        scale: 2.2,
        zIndex: 10010,
        boxShadow: '0 0 120px rgba(255,215,0,1)',
        duration: 1,
        ease: 'back.out(1.4)'
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
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const rect = winnerPocket.getBoundingClientRect();
    
    return new Promise(resolve => {
      gsap.to(winnerPocket, {
        left: centerX - rect.width / 2,
        top: centerY - rect.height / 2,
        x: 0,
        y: 0,
        rotation: 360,
        scale: 2.8,
        duration: 1,
        ease: 'power2.inOut',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 7: FIXED - Natural gravity drop with explicit properties
   */
  async phase7_GravityDrop() {
    console.log('🔄 Phase 7: Gravity Drop (FIXED - no DOMRect)');
    this.rouletteState.status.textContent = 'Returning...';
    
    const overlay = this.rouletteState.wheelContainer;
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const originalWinner = this.items[this.rouletteState.originalWinnerIndex];
    const savedState = this.rouletteState.savedCardStates[this.rouletteState.originalWinnerIndex];
    
    // Fade overlay
    gsap.to(overlay, { opacity: 0, duration: 0.8 });
    gsap.to(this.rouletteState.status, { opacity: 0, duration: 0.4 });
    
    // Show and position winner card
    gsap.set(originalWinner, { opacity: 1 });
    
    const pocketRect = winnerPocket.getBoundingClientRect();
    gsap.set(originalWinner, {
      x: pocketRect.left + pocketRect.width / 2 - window.innerWidth / 2,
      y: pocketRect.top + pocketRect.height / 2 - window.innerHeight / 2,
      scale: 2,
      rotation: 0
    });
    
    winnerPocket.style.opacity = '0';
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Float UP
      tl.to(originalWinner, {
        y: '-=250',
        scale: 1.8,
        rotation: 8,
        duration: 0.8,
        ease: 'power2.out'
      });
      
      // Pause
      tl.to({}, { duration: 0.25 });
      
      // Gravity drop
      const containerRect = this.container.getBoundingClientRect();
      const targetY = containerRect.top + containerRect.height / 2 - window.innerHeight / 2;
      
      tl.to(originalWinner, {
        y: targetY,
        x: 0,
        scale: 1.25,
        rotation: savedState.rotation,
        duration: 1,
        ease: 'power2.in',
        onUpdate: function() {
          const p = this.progress();
          const wobble = Math.sin(p * Math.PI * 3) * 6 * (1 - p);
          gsap.set(originalWinner, { rotation: savedState.rotation + wobble });
        }
      });
      
      // Landing bounce
      tl.to(originalWinner, { scale: savedState.scale * 0.92, duration: 0.1 });
      tl.to(originalWinner, { scale: savedState.scale, rotation: savedState.rotation, duration: 0.2, ease: 'elastic.out(1, 0.6)' });
      
      // ✅ FIXED: Restore others with EXPLICIT properties (no spreading)
      this.items.forEach((card, i) => {
        if (i === this.rouletteState.originalWinnerIndex) return;
        const state = this.rouletteState.savedCardStates[i];
        
        tl.to(card, {
          x: state.x,
          y: state.y,
          z: state.z,
          scale: state.scale,
          rotation: state.rotation,
          rotationX: state.rotationX,
          rotationY: state.rotationY,
          opacity: state.opacity,
          zIndex: state.zIndex,
          duration: 1.2
        }, '-=0.8');
      });
    });
  }
  
  /**
   * Phase 8: Carousel reveal
   */
  async phase8_CarouselReveal(winnerTitle) {
    console.log('🎬 Phase 8: Carousel Reveal');
    
    // Green pocket check
    if (this.rouletteState.winnerPocketIndex === this.rouletteState.greenPocketIndex) {
      console.log('💚 Green pocket won!');
      this.rouletteState.status.textContent = '💚 Try Again!';
      await this.delay(1500);
      
      if (confirm('🎰 Spin again?\n\nOK = Spin\nCancel = Browse')) {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
        await this.delay(400);
        return this.startCasinoWheelV57();
      }
      
      // Restore carousel
      this.items.forEach((card, i) => {
        const state = this.rouletteState.savedCardStates[i];
        gsap.to(card, { x: state.x, y: state.y, z: state.z, scale: state.scale, rotation: state.rotation, opacity: state.opacity, zIndex: state.zIndex, duration: 1 });
      });
      return;
    }
    
    // Regular winner
    this.currentIndex = this.rouletteState.originalWinnerIndex;
    this.updateAllItems(this.currentIndex, 0.8);
    
    await this.delay(500);
    
    const winner = this.items[this.rouletteState.originalWinnerIndex];
    await this.gsapTo(winner, { scale: 1.45, duration: 0.3, ease: 'back.out(1.8)' });
    await this.gsapTo(winner, { scale: 1.25, duration: 0.2 });
    
    await this.delay(600);
    
    const link = winner.querySelector('.card-link') || winner.querySelector('a[href]');
    if (link && window.confirm(`🎉 ${winnerTitle}!\n\nView project?`)) {
      window.location.href = link.href;
    }
  }
  
  /**
   * V5.7: Enhanced cleanup (prevent memory leaks)
   */
  cleanupCasinoWheel() {
    console.log('🧹 V5.7: Enhanced cleanup');
    
    // Kill all tweens
    if (this.rouletteState.pockets?.length) {
      gsap.killTweensOf(this.rouletteState.pockets);
    }
    gsap.killTweensOf([
      this.rouletteState.ball,
      this.rouletteState.ballShadow,
      this.rouletteState.wheelRim,
      this.rouletteState.wheelContainer,
      this.rouletteState.pocketContainer
    ].filter(Boolean));
    
    // Remove DOM
    [
      this.rouletteState.ball,
      this.rouletteState.ballShadow,
      this.rouletteState.wheelRim,
      this.rouletteState.pocketContainer,
      this.rouletteState.wheelContainer,
      this.rouletteState.status
    ].forEach(el => el?.remove());
    
    // Clear refs
    this.rouletteState = {
      isActive: false,
      savedCardStates: [],
      wheelContainer: null,
      pockets: [],
      pocketContainer: null,
      ball: null,
      ballShadow: null,
      status: null,
      wheelRim: null,
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
