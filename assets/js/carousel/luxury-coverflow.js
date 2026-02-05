/**
 * Luxury Coverflow V5.5 — Ultra-Realistic Casino Roulette Edition
 * 
 * V5.5 FEATURES:
 * - ✅ 37-pocket authentic European roulette wheel
 * - ✅ Real red/black/green casino colors
 * - ✅ Multi-layer neon casino lighting
 * - ✅ Ball ON wheel track (not floating)
 * - ✅ Natural gravity drop return (not backwards morph)
 * - ✅ All V5.0 features retained
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
      console.error(`❌ Coverflow container "${containerSelector}" not found`);
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
      
      // V5.5: Casino config
      enableCasinoWheel: true,
      wheelSpinDuration: { min: 6, max: 8 },
      
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
    
    this.wheelEngine = new RouletteWheelEngine({
      spinDuration: this.config.wheelSpinDuration
    });
    
    this.dragState = {
      isDragging: false,
      startX: 0,
      currentX: 0,
      startIndex: 0,
      rafPending: false
    };
    
    // V5.5: Enhanced roulette state
    this.rouletteState = {
      isActive: false,
      savedCardStates: [],
      wheelContainer: null,
      pockets: [],
      ball: null,
      ballShadow: null,
      status: null,
      wheelRim: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null
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
    console.log('✨ Luxury Coverflow V5.5 — ULTRA-REALISTIC CASINO EDITION 🎰');
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
  // INPUT HANDLERS (Keyboard, Mouse, Touch, Scroll)
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
  // V5.5: ULTRA-REALISTIC CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 Casino wheel V5.5 ready');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV55();
    });
  }
  
  /**
   * V5.5: Complete 8-phase ultra-realistic casino wheel
   */
  async startCasinoWheelV55() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V5.5 ULTRA-REALISTIC CASINO WHEEL ACTIVATED!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Pre-select winner
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.winnerPocketIndex = this.wheelEngine.getWinnerPocketIndex(
      this.rouletteState.originalWinnerIndex, this.items.length
    );
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: ${this.rouletteState.originalWinnerIndex} "${winnerTitle}"`);
    
    // Save original states
    this.saveCardStates();
    
    try {
      await this.phase1_CasinoLevitation();
      await this.phase2_Create37PocketWheel();
      await this.phase3_WheelSpinWithBall();
      await this.phase4_BallLandingBounce();
      await this.phase5_WinnerRiseGlow();
      await this.phase6_CenterFocus();
      await this.phase7_NaturalGravityDrop();
      await this.phase8_CarouselReveal(winnerTitle);
      
      console.log('🎉 V5.5 Casino wheel complete!');
    } catch (error) {
      console.error('❌ Casino wheel error:', error);
    } finally {
      this.cleanupCasinoWheel();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  saveCardStates() {
    this.rouletteState.savedCardStates = this.items.map(card => {
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      const matrix = new DOMMatrix(style.transform);
      return {
        rect,
        x: matrix.m41 || 0,
        y: matrix.m42 || 0,
        scale: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) || 1,
        rotation: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI) || 0,
        opacity: parseFloat(style.opacity) || 1,
        zIndex: parseInt(style.zIndex) || 0,
        width: rect.width,
        height: rect.height
      };
    });
  }
  
  /**
   * Phase 1: Cards levitate with casino atmosphere
   */
  async phase1_CasinoLevitation() {
    console.log('📦 Phase 1: Casino Levitation');
    
    // Create casino atmosphere overlay
    const overlay = document.createElement('div');
    overlay.className = 'casino-wheel-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      opacity: 0;
      background:
        radial-gradient(circle at 50% 50%, rgba(0, 60, 0, 0.95) 0%, rgba(0, 20, 0, 0.98) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1200px;
    `;
    
    // Green felt texture
    const feltTexture = document.createElement('div');
    feltTexture.style.cssText = `
      position: absolute;
      inset: 0;
      background-image:
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
      opacity: 0.4;
      pointer-events: none;
    `;
    overlay.appendChild(feltTexture);
    document.body.appendChild(overlay);
    this.rouletteState.wheelContainer = overlay;
    
    // Status text
    const status = document.createElement('div');
    status.className = 'casino-status';
    status.textContent = 'Preparing the wheel...';
    status.style.cssText = `
      position: fixed;
      bottom: 4rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(1.5rem, 4vw, 2.5rem);
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
    
    // Fade in
    gsap.to(overlay, { opacity: 1, duration: 0.6 });
    gsap.to(status, { opacity: 1, duration: 0.4, delay: 0.3 });
    
    // Levitate original cards
    return new Promise(resolve => {
      gsap.to(this.items, {
        y: -100,
        z: 400,
        scale: 0.6,
        rotationX: 0,
        rotationY: 0,
        opacity: 0.9,
        duration: 1.8,
        stagger: 0.08,
        ease: 'power2.out',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 2: Create 37-pocket authentic wheel
   */
  async phase2_Create37PocketWheel() {
    console.log('🔄 Phase 2: Creating 37-pocket wheel');
    this.rouletteState.status.textContent = 'Forming the wheel...';
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wheelRadius = this.wheelEngine.config.wheelRadius();
    
    // Create golden wheel rim
    const rim = document.createElement('div');
    rim.className = 'wheel-rim';
    rim.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${wheelRadius * 2 + 80}px;
      height: ${wheelRadius * 2 + 80}px;
      transform: translate(-50%, -50%) rotateX(5deg);
      border: 10px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#003300, #003300) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 40px rgba(255,215,0,0.8),
        0 0 80px rgba(255,215,0,0.5),
        inset 0 0 50px rgba(255,215,0,0.2),
        0 30px 100px rgba(0,0,0,0.7);
      z-index: 10001;
      opacity: 0;
      transform-style: preserve-3d;
    `;
    document.body.appendChild(rim);
    this.rouletteState.wheelRim = rim;
    
    gsap.to(rim, { opacity: 1, duration: 0.5 });
    
    // Clone cards into 37 pockets
    const pockets = this.wheelEngine.createRoulettePockets(this.items);
    const positions = this.wheelEngine.calculatePocketPositions(centerX, centerY);
    
    // Style and position each pocket
    const pocketContainer = document.createElement('div');
    pocketContainer.className = 'pocket-container';
    pocketContainer.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 0;
      height: 0;
      z-index: 10002;
      transform-style: preserve-3d;
    `;
    
    pockets.forEach((pocket, i) => {
      const pos = positions[i];
      const color = pos.pocketData.color;
      const number = pos.pocketData.number;
      
      // Position relative to center
      const relX = pos.x - centerX;
      const relY = pos.y - centerY;
      
      // Apply pocket styling
      pocket.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: clamp(35px, 6vmin, 60px);
        height: clamp(50px, 9vmin, 80px);
        border-radius: 6px;
        border: 2px solid #FFD700;
        overflow: hidden;
        transform: translate(${relX}px, ${relY}px) rotate(${pos.rotation}deg) scale(0);
        transform-origin: center center;
        opacity: 0;
        box-shadow:
          inset 0 -3px 6px rgba(0,0,0,0.6),
          inset 0 2px 4px rgba(255,255,255,0.2),
          0 2px 8px rgba(0,0,0,0.5);
        background: ${color === 'green' ? 'linear-gradient(180deg, #006400, #228B22, #006400)' :
                      color === 'red' ? 'linear-gradient(180deg, #8B0000, #DC143C, #8B0000)' :
                      'linear-gradient(180deg, #000, #1a1a1a, #000)'};
      `;
      
      // Number overlay
      const numOverlay = document.createElement('div');
      numOverlay.textContent = number;
      numOverlay.style.cssText = `
        position: absolute;
        top: 3px;
        left: 50%;
        transform: translateX(-50%);
        font-family: Arial Black, sans-serif;
        font-size: clamp(10px, 2vmin, 16px);
        font-weight: 900;
        color: #FFD700;
        text-shadow: 0 0 8px #FFD700, 0 1px 2px rgba(0,0,0,0.9);
        z-index: 10;
      `;
      pocket.appendChild(numOverlay);
      
      pocketContainer.appendChild(pocket);
    });
    
    document.body.appendChild(pocketContainer);
    this.rouletteState.pockets = pockets;
    this.rouletteState.pocketContainer = pocketContainer;
    
    // Hide original cards
    gsap.to(this.items, { opacity: 0, duration: 0.5 });
    
    // Animate pockets appearing in circle
    return new Promise(resolve => {
      pockets.forEach((pocket, i) => {
        const pos = positions[i];
        const relX = pos.x - centerX;
        const relY = pos.y - centerY;
        
        gsap.to(pocket, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          delay: i * 0.03,
          ease: 'back.out(1.5)',
          onUpdate: function() {
            const scale = this.targets()[0].style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 0;
            pocket.style.transform = `translate(${relX}px, ${relY}px) rotate(${pos.rotation}deg) scale(${scale})`;
          }
        });
      });
      
      setTimeout(resolve, 2500);
    });
  }
  
  /**
   * Phase 3: Wheel spin with ball on track
   */
  async phase3_WheelSpinWithBall() {
    console.log('🎡 Phase 3: Wheel spin with ball');
    this.rouletteState.status.textContent = 'Spin the wheel!';
    
    const spinParams = this.wheelEngine.calculateWheelSpin(this.rouletteState.winnerPocketIndex);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wheelRadius = this.wheelEngine.config.wheelRadius();
    
    // Create ball
    const ball = document.createElement('div');
    ball.className = 'roulette-ball-v55';
    ball.style.cssText = `
      position: fixed;
      width: clamp(28px, 4.5vmin, 45px);
      height: clamp(28px, 4.5vmin, 45px);
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #fff, #f0f0f0 30%, #d0d0d0 70%, #a0a0a0);
      box-shadow:
        0 0 25px rgba(255,255,255,1),
        0 0 50px rgba(255,215,0,0.9),
        0 0 80px rgba(255,215,0,0.6),
        inset -3px -3px 10px rgba(0,0,0,0.3),
        inset 3px 3px 10px rgba(255,255,255,0.8),
        0 10px 30px rgba(0,0,0,0.5);
      z-index: 10005;
      pointer-events: none;
    `;
    document.body.appendChild(ball);
    this.rouletteState.ball = ball;
    
    // Ball shadow (creates "on wheel" illusion)
    const ballShadow = document.createElement('div');
    ballShadow.className = 'roulette-ball-shadow';
    ballShadow.style.cssText = `
      position: fixed;
      width: clamp(35px, 5.5vmin, 55px);
      height: clamp(12px, 2.5vmin, 20px);
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%);
      filter: blur(4px);
      z-index: 10004;
      pointer-events: none;
    `;
    document.body.appendChild(ballShadow);
    this.rouletteState.ballShadow = ballShadow;
    
    const outerRadius = wheelRadius * 1.1;
    let ballAngle = Math.random() * 360;
    
    gsap.set(ball, {
      left: centerX + outerRadius * Math.cos(ballAngle * Math.PI / 180),
      top: centerY + outerRadius * Math.sin(ballAngle * Math.PI / 180),
      xPercent: -50,
      yPercent: -50
    });
    
    const pocketContainer = this.rouletteState.pocketContainer;
    const rim = this.rouletteState.wheelRim;
    const duration = spinParams.duration;
    
    return new Promise(resolve => {
      // Rotate wheel (container + rim)
      gsap.to([pocketContainer, rim], {
        rotation: spinParams.finalRotation,
        duration,
        ease: 'power3.out'
      });
      
      // Ball animation (opposite direction, spiraling in)
      gsap.to({}, {
        duration,
        onUpdate: function() {
          const progress = this.progress();
          
          // Ball speed decays
          const ballSpeed = 2200 * Math.pow(1 - progress, 1.6);
          ballAngle -= ballSpeed * 0.016 / 60;
          
          // Spiral inward after 55%
          let currentRadius = outerRadius;
          if (progress > 0.55) {
            const spiral = (progress - 0.55) / 0.45;
            currentRadius = outerRadius - (outerRadius * 0.2 * Math.pow(spiral, 1.5));
          }
          
          const angleRad = ballAngle * Math.PI / 180;
          const x = centerX + currentRadius * Math.cos(angleRad);
          const y = centerY + currentRadius * Math.sin(angleRad);
          
          gsap.set(ball, { left: x, top: y });
          gsap.set(ballShadow, { 
            left: x + 4, 
            top: y + 8,
            scaleX: 0.9 + (1 - progress) * 0.2
          });
          
          // Status updates
          if (progress < 0.3) {
            this.status.textContent = 'Spinning fast!';
          } else if (progress < 0.7) {
            this.status.textContent = 'Round and round...';
          } else {
            this.status.textContent = 'Slowing down...';
          }
        }.bind({ status: this.rouletteState.status }),
        onComplete: resolve
      });
      
      // Haptic ticks
      if ('vibrate' in navigator) {
        let lastTick = 0;
        gsap.to({}, {
          duration,
          onUpdate: function() {
            const p = this.progress();
            const interval = 0.08 / (1 - p * 0.6);
            if (p - lastTick > interval) {
              navigator.vibrate(4);
              lastTick = p;
            }
          }
        });
      }
    });
  }
  
  /**
   * Phase 4: Ball bounces into winner pocket
   */
  async phase4_BallLandingBounce() {
    console.log('⚾ Phase 4: Ball landing');
    this.rouletteState.status.textContent = 'Landing...';
    
    const ball = this.rouletteState.ball;
    const ballShadow = this.rouletteState.ballShadow;
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const pocketRect = winnerPocket.getBoundingClientRect();
    const targetX = pocketRect.left + pocketRect.width / 2;
    const targetY = pocketRect.top + pocketRect.height / 2;
    
    const bounces = this.wheelEngine.getBounceSequence();
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      bounces.forEach((b, i) => {
        tl.to(ball, {
          left: targetX + (i < 2 ? (Math.random() - 0.5) * 40 : 0),
          top: targetY,
          scale: i === 0 ? 1.4 : 1,
          duration: b.duration,
          ease: b.ease
        });
        
        if (i < bounces.length - 1) {
          tl.to(ball, { top: targetY - b.height, duration: b.duration * 0.4, ease: 'power1.out' });
        }
      });
      
      // Winner glow
      tl.to(winnerPocket, {
        boxShadow: '0 0 60px rgba(255,215,0,1), inset 0 0 30px rgba(255,215,0,0.5)',
        duration: 0.2,
        repeat: 3,
        yoyo: true
      }, '-=0.4');
      
      tl.to([ball, ballShadow], { opacity: 0, scale: 0, duration: 0.4 });
      
      if ('vibrate' in navigator) tl.call(() => navigator.vibrate([100, 50, 150]));
    });
  }
  
  /**
   * Phase 5: Winner rises with glow
   */
  async phase5_WinnerRiseGlow() {
    console.log('🏆 Phase 5: Winner rise');
    this.rouletteState.status.textContent = 'Winner!';
    
    const pockets = this.rouletteState.pockets;
    const winnerPocket = pockets[this.rouletteState.winnerPocketIndex];
    const rim = this.rouletteState.wheelRim;
    const pocketContainer = this.rouletteState.pocketContainer;
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Fade others
      pockets.forEach((p, i) => {
        if (i !== this.rouletteState.winnerPocketIndex) {
          tl.to(p, { opacity: 0, scale: 0.5, duration: 0.6 }, 0);
        }
      });
      
      // Fade rim
      tl.to(rim, { opacity: 0, duration: 0.8 }, 0);
      
      // Winner rises
      tl.to(winnerPocket, {
        scale: 2,
        zIndex: 10010,
        boxShadow: '0 0 100px rgba(255,215,0,1), 0 50px 150px rgba(0,0,0,0.5)',
        duration: 1.2,
        ease: 'back.out(1.5)'
      }, 0.3);
    });
  }
  
  /**
   * Phase 6: Winner moves to center
   */
  async phase6_CenterFocus() {
    console.log('🎯 Phase 6: Center focus');
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    
    this.rouletteState.status.textContent = `🎉 ${winnerTitle}`;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const pocketRect = winnerPocket.getBoundingClientRect();
    
    return new Promise(resolve => {
      gsap.to(winnerPocket, {
        left: centerX - pocketRect.width / 2,
        top: centerY - pocketRect.height / 2,
        x: 0,
        y: 0,
        rotation: 360,
        scale: 2.5,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 7: NATURAL GRAVITY DROP (not backwards morph)
   */
  async phase7_NaturalGravityDrop() {
    console.log('🔄 Phase 7: Natural gravity drop');
    this.rouletteState.status.textContent = 'Returning to projects...';
    
    const overlay = this.rouletteState.wheelContainer;
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const originalWinner = this.items[this.rouletteState.originalWinnerIndex];
    const savedState = this.rouletteState.savedCardStates[this.rouletteState.originalWinnerIndex];
    
    // Fade out overlay
    gsap.to(overlay, { opacity: 0, duration: 0.8 });
    gsap.to(this.rouletteState.status, { opacity: 0, duration: 0.4 });
    
    // Show original winner card
    gsap.set(originalWinner, { opacity: 1 });
    
    // Get pocket position
    const pocketRect = winnerPocket.getBoundingClientRect();
    
    // Position original card at pocket position
    gsap.set(originalWinner, {
      x: pocketRect.left + pocketRect.width / 2 - window.innerWidth / 2,
      y: pocketRect.top + pocketRect.height / 2 - window.innerHeight / 2,
      scale: 2,
      rotation: 0
    });
    
    // Hide pocket (swap to original card)
    winnerPocket.style.opacity = '0';
    
    return new Promise(resolve => {
      // Step 1: Card floats UP 
      const tl = gsap.timeline({ onComplete: resolve });
      
      tl.to(originalWinner, {
        y: '-=250',
        scale: 1.8,
        rotation: 15,
        duration: 0.8,
        ease: 'power2.out'
      });
      
      // Step 2: Pause at apex
      tl.to({}, { duration: 0.2 });
      
      // Step 3: GRAVITY DROP with tumble
      const containerRect = this.container.getBoundingClientRect();
      const targetY = containerRect.top + containerRect.height / 2 - window.innerHeight / 2;
      
      tl.to(originalWinner, {
        y: targetY,
        x: 0,
        scale: 1.25,
        rotation: 0,
        duration: 1,
        ease: 'power2.in', // Gravity acceleration
        onUpdate: function() {
          // Tumble wobble
          const p = this.progress();
          const wobble = Math.sin(p * Math.PI * 4) * 12 * (1 - p);
          gsap.set(originalWinner, { rotation: wobble });
        }
      });
      
      // Step 4: Landing bounce
      tl.to(originalWinner, {
        scale: 1.15,
        duration: 0.08,
        ease: 'power2.out'
      });
      tl.to(originalWinner, {
        scale: 1.25,
        duration: 0.15,
        ease: 'elastic.out(1, 0.6)'
      });
      
      // Show other cards
      this.items.forEach((card, i) => {
        if (i === this.rouletteState.originalWinnerIndex) return;
        tl.to(card, {
          opacity: 1,
          duration: 0.6
        }, '-=0.8');
      });
    });
  }
  
  /**
   * Phase 8: Carousel opens on winner
   */
  async phase8_CarouselReveal(winnerTitle) {
    console.log('🎬 Phase 8: Carousel reveal');
    
    this.currentIndex = this.rouletteState.originalWinnerIndex;
    this.updateAllItems(this.currentIndex, 0.8);
    
    await this.delay(600);
    
    const winner = this.items[this.rouletteState.originalWinnerIndex];
    
    // Victory pulse
    await this.gsapTo(winner, { scale: 1.45, duration: 0.35, ease: 'back.out(1.8)' });
    await this.gsapTo(winner, { scale: 1.25, duration: 0.25 });
    
    await this.delay(800);
    
    const link = winner.querySelector('.card-link');
    if (link && window.confirm(`🎉 ${winnerTitle}!\n\nView this project?`)) {
      window.location.href = link.href;
    }
  }
  
  cleanupCasinoWheel() {
    this.rouletteState.wheelContainer?.remove();
    this.rouletteState.pocketContainer?.remove();
    this.rouletteState.ball?.remove();
    this.rouletteState.ballShadow?.remove();
    this.rouletteState.wheelRim?.remove();
    this.rouletteState.status?.remove();
    
    this.rouletteState.pockets.forEach(p => p.remove());
    
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
      winnerPocketIndex: null
    };
    
    console.log('✅ Casino wheel cleanup complete');
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
    console.log('⏹️ Luxury Coverflow destroyed');
  }
  
  getState() {
    return {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      isAnimating: this.isAnimating,
      casinoWheelActive: this.rouletteState.isActive
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('[data-luxury-coverflow-auto]');
  if (el) window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]');
});
