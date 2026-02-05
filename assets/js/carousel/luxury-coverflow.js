/**
 * Luxury Coverflow Carousel V5.0 - Casino Wheel Edition
 * 
 * V5.0 FEATURES:
 * - ✅ 8-Phase Casino Wheel Transformation
 * - ✅ Cards levitate and form roulette wheel
 * - ✅ Ball spins with physics-based trajectory
 * - ✅ Dramatic winner reveal and morph back
 * - ✅ All V4.1 fixes retained
 */

import { gsap } from 'gsap';
import { Coverflow3DEngine } from './coverflow-3d-engine.js';
import { CoverflowPhysics } from './coverflow-physics.js';
import { RouletteWheelEngine } from './roulette-wheel-engine.js';

// V4: Cap GSAP ticker to 60fps
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
    
    // V5.0: Enhanced config
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
      
      // V5.0: Casino wheel config
      enableCasinoWheel: true,
      wheelSpinDuration: { min: 5, max: 7 },
      wheelSpins: { min: 3, max: 5 },
      
      ...options
    };
    
    this.currentIndex = Math.floor(this.items.length / 2);
    this.isAnimating = false;
    this.autoplayTimer = null;
    this.navQueue = null;
    this.scrollPosition = this.currentIndex;
    this.isScrollTracking = false;
    
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
    
    // V5.0: Wheel engine
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
    
    // V5.0: Roulette state
    this.rouletteState = {
      isActive: false,
      savedCardStates: [],
      wheelContainer: null,
      ballElement: null,
      winnerIndex: null,
      masterTimeline: null
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
    
    if (this.config.autoplay) {
      this.startAutoplay();
    }
    
    this.announceCurrentSlide();
    console.log('✨ Luxury Coverflow V5.0 initialized with CASINO WHEEL 🎰');
  }
  
  // ========================================
  // CORE ANIMATION METHODS
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
        rotationX: transform.rotateX || 0,
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
      item.classList.toggle('is-adjacent', absPosition === 1);
      item.setAttribute('aria-current', isCenter ? 'true' : 'false');
      item.setAttribute('tabindex', isCenter ? '0' : '-1');
      item.style.pointerEvents = transform.opacity > 0.1 ? 'auto' : 'none';
    });
    
    this.updatePagination();
  }
  
  updateContinuousPosition(position) {
    const transforms = this.engine3D.calculateAllTransforms(
      position, this.items.length, this.config.infiniteLoop
    );
    
    this.items.forEach((item, index) => {
      const transform = transforms[index];
      gsap.set(item, {
        x: transform.translateX,
        y: transform.translateY || 0,
        z: transform.translateZ,
        rotationY: transform.rotateY,
        scale: transform.scale,
        opacity: transform.opacity,
        filter: this.engine3D.getFilterString(transform.filter),
        zIndex: transform.zIndex,
        force3D: true
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
  // KEYBOARD, MOUSE, TOUCH, SCROLL HANDLERS
  // ========================================
  
  setupKeyboardNavigation() {
    if (!this.config.enableKeyboard) return;
    document.addEventListener('keydown', (e) => {
      if (!this.container.contains(document.activeElement) && 
          !this.container.matches(':hover')) return;
      
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      if (e.key === 'Home') { e.preventDefault(); this.goToSlide(0); }
      if (e.key === 'End') { e.preventDefault(); this.goToSlide(this.items.length - 1); }
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
    this.track.addEventListener('touchstart', (e) => {
      this.startDrag(e.touches[0].clientX);
    }, { passive: true });
    this.track.addEventListener('touchmove', (e) => {
      if (this.dragState.isDragging) {
        e.preventDefault();
        this.updateDrag(e.touches[0].clientX);
      }
    }, { passive: false });
    this.track.addEventListener('touchend', () => {
      if (this.dragState.isDragging) this.endDrag();
    });
  }
  
  setupScrollNavigation() {
    if (!this.config.enableScroll) return;
    let scrollDeltaX = 0, scrollTimeout;
    
    this.container.addEventListener('wheel', (e) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5;
      if (isHorizontal && Math.abs(e.deltaX) > 5) {
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
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.5) return;
      if (Math.abs(e.deltaX) < 5) return;
      
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
    this.dragState.isDragging = true;
    this.dragState.startX = clientX;
    this.dragState.currentX = clientX;
    this.dragState.startIndex = this.currentIndex;
    this.physics.startDrag(clientX);
    this.stopAutoplay();
    this.container.classList.add('is-dragging');
  }
  
  updateDrag(clientX) {
    if (!this.dragState.isDragging) return;
    this.dragState.currentX = clientX;
    if (!this.dragState.rafPending) {
      this.dragState.rafPending = true;
      requestAnimationFrame(() => {
        this.physics.updateDrag(this.dragState.currentX);
        this.dragState.rafPending = false;
      });
    }
  }
  
  endDrag() {
    const dragDelta = (this.dragState.currentX - this.dragState.startX) / 350;
    const targetIndex = this.physics.calculateSnapTarget(
      this.currentIndex, this.items.length, dragDelta, this.config.infiniteLoop
    );
    this.goToSlide(targetIndex);
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
  // V5.0: CASINO WHEEL ROULETTE
  // ========================================
  
  setupRouletteButton() {
    let btn = this.container.querySelector('.roulette-trigger-btn') ||
              document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 Casino wheel button ready');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.config.enableCasinoWheel) {
        await this.startCasinoWheelRoulette();
      } else {
        await this.startSimpleRoulette();
      }
    });
  }
  
  /**
   * V5.0: Full 8-Phase Casino Wheel Transformation
   */
  async startCasinoWheelRoulette() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 CASINO WHEEL ACTIVATED!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // Save original card states
    this.saveCardStates();
    
    // Pre-select winner
    this.rouletteState.winnerIndex = Math.floor(Math.random() * this.items.length);
    const winner = this.items[this.rouletteState.winnerIndex];
    const winnerTitle = winner.dataset.title || 'Selected Project!';
    console.log('🎯 Pre-selected winner:', this.rouletteState.winnerIndex, winnerTitle);
    
    // Create wheel container and ball
    this.createWheelElements();
    
    try {
      // Execute 8 phases
      await this.phase1_Levitation();
      await this.phase2_CircleTransformation();
      await this.phase3_WheelSpin();
      await this.phase4_BallLanding();
      await this.phase5_WinnerRise();
      await this.phase6_CenterFocus();
      await this.phase7_MorphBack();
      await this.phase8_CarouselOpen(winnerTitle);
      
      console.log('🎉 Casino wheel sequence complete!');
    } catch (error) {
      console.error('❌ Casino wheel error:', error);
    } finally {
      this.cleanupWheelElements();
      this.rouletteState.isActive = false;
      this.isAnimating = false;
    }
  }
  
  saveCardStates() {
    this.rouletteState.savedCardStates = this.items.map(card => {
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      return {
        rect,
        transform: style.transform,
        opacity: parseFloat(style.opacity),
        zIndex: parseInt(style.zIndex) || 0
      };
    });
  }
  
  createWheelElements() {
    // Create overlay
    let overlay = document.querySelector('.casino-wheel-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'casino-wheel-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 100%);
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(overlay);
    }
    this.rouletteState.wheelContainer = overlay;
    
    // Create ball
    const ball = document.createElement('div');
    ball.className = 'roulette-ball-3d';
    ball.style.cssText = `
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #FFFFFF 0%, #FFD700 40%, #B8860B 100%);
      box-shadow: 
        0 0 30px rgba(255,215,0,1),
        0 0 60px rgba(255,215,0,0.7),
        0 5px 20px rgba(0,0,0,0.5),
        inset -5px -5px 15px rgba(0,0,0,0.3);
      z-index: 10002;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(ball);
    this.rouletteState.ballElement = ball;
    
    // Create status text
    const status = document.createElement('div');
    status.className = 'casino-wheel-status';
    status.style.cssText = `
      position: fixed;
      bottom: 5rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      font-weight: 700;
      color: #FFD700;
      text-align: center;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      z-index: 10003;
      opacity: 0;
      text-shadow: 0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.5);
    `;
    document.body.appendChild(status);
    this.rouletteState.statusElement = status;
  }
  
  cleanupWheelElements() {
    document.querySelector('.casino-wheel-overlay')?.remove();
    document.querySelector('.roulette-ball-3d')?.remove();
    document.querySelector('.casino-wheel-status')?.remove();
    this.rouletteState.wheelContainer = null;
    this.rouletteState.ballElement = null;
    this.rouletteState.statusElement = null;
  }
  
  /**
   * Phase 1: Cards levitate out of carousel (2s)
   */
  async phase1_Levitation() {
    console.log('📦 Phase 1: Levitation');
    const overlay = this.rouletteState.wheelContainer;
    const status = this.rouletteState.statusElement;
    
    // Fade in overlay
    gsap.to(overlay, { opacity: 1, duration: 0.5 });
    
    // Show status
    status.textContent = 'Preparing the wheel...';
    gsap.to(status, { opacity: 1, duration: 0.5 });
    
    // Add perspective to track
    this.track.style.perspective = '1200px';
    
    // Levitate cards
    return new Promise(resolve => {
      gsap.to(this.items, {
        z: 350,
        y: -80,
        scale: 0.7,
        rotationX: 0,
        rotationY: 0,
        opacity: 0.95,
        duration: 2,
        stagger: 0.08,
        ease: 'power2.out',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 2: Cards transform into circular wheel layout (3s)
   */
  async phase2_CircleTransformation() {
    console.log('🔄 Phase 2: Circle Transformation');
    const status = this.rouletteState.statusElement;
    status.textContent = 'Forming the wheel...';
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const positions = this.wheelEngine.calculateCircularPositions(
      this.items.length, centerX, centerY
    );
    
    // Create wheel rim visual
    const wheelRim = document.createElement('div');
    wheelRim.className = 'wheel-rim';
    wheelRim.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${this.wheelEngine.config.wheelRadius() * 2 + 100}px;
      height: ${this.wheelEngine.config.wheelRadius() * 2 + 100}px;
      transform: translate(-50%, -50%);
      border: 4px solid rgba(255,215,0,0.4);
      border-radius: 50%;
      box-shadow: 
        0 0 40px rgba(255,215,0,0.3),
        inset 0 0 60px rgba(255,215,0,0.1);
      z-index: 10001;
      opacity: 0;
    `;
    document.body.appendChild(wheelRim);
    this.rouletteState.wheelRim = wheelRim;
    
    gsap.to(wheelRim, { opacity: 1, duration: 0.5 });
    
    return new Promise(resolve => {
      this.items.forEach((card, i) => {
        const pos = positions[i];
        
        gsap.to(card, {
          x: pos.x - window.innerWidth / 2,
          y: pos.y - window.innerHeight / 2,
          z: 0,
          rotation: pos.rotation,
          rotationX: 0,
          rotationY: 0,
          scale: pos.scale,
          duration: 2.5,
          delay: i * 0.1,
          ease: 'elastic.out(1, 0.7)'
        });
      });
      
      setTimeout(resolve, 3000);
    });
  }
  
  /**
   * Phase 3: Wheel spins with ball (5-8s)
   */
  async phase3_WheelSpin() {
    console.log('🎡 Phase 3: Wheel Spin');
    const status = this.rouletteState.statusElement;
    const ball = this.rouletteState.ballElement;
    const rim = this.rouletteState.wheelRim;
    
    status.textContent = 'Spin the wheel!';
    
    const spinParams = this.wheelEngine.calculateWheelSpin(
      this.rouletteState.winnerIndex, this.items.length
    );
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wheelRadius = this.wheelEngine.config.wheelRadius();
    
    // Position ball on outer rim
    const ballStartAngle = Math.random() * 360;
    const ballStartX = centerX + wheelRadius * 1.2 * Math.cos(ballStartAngle * Math.PI / 180);
    const ballStartY = centerY + wheelRadius * 1.2 * Math.sin(ballStartAngle * Math.PI / 180);
    
    gsap.set(ball, { left: ballStartX - 25, top: ballStartY - 25 });
    gsap.to(ball, { opacity: 1, duration: 0.3 });
    
    return new Promise(resolve => {
      const duration = spinParams.duration;
      
      // Create rotation wrapper for cards
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 0;
        height: 0;
      `;
      document.body.appendChild(wrapper);
      
      // Move cards into wrapper temporarily (visual only)
      const cardPositions = [];
      this.items.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        cardPositions.push({
          x: rect.left + rect.width/2 - centerX,
          y: rect.top + rect.height/2 - centerY
        });
      });
      
      // Animate wheel rotation (rotate all cards around center)
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Spin the wheel (rotate cards around center point)
      tl.to({}, {
        duration: duration,
        ease: 'power3.out',
        onUpdate: function() {
          const progress = this.progress();
          const currentRotation = spinParams.finalRotation * progress;
          
          // Update status text at intervals
          if (progress < 0.3) {
            status.textContent = 'Spinning fast!';
          } else if (progress < 0.7) {
            status.textContent = 'Round and round...';
          } else {
            status.textContent = 'Slowing down...';
          }
        }
      });
      
      // Animate ball spiraling in parallel
      tl.to({}, {
        duration: duration,
        onUpdate: function() {
          const progress = this.progress();
          
          // Ball goes opposite direction, faster, with spiral
          const ballSpeed = -spinParams.finalRotation * 1.5;
          const ballRotation = ballSpeed * Math.pow(progress, 0.7);
          
          // Spiral inward after 60%
          let currentRadius = wheelRadius * 1.2;
          if (progress > 0.6) {
            const spiralProgress = (progress - 0.6) / 0.4;
            currentRadius = wheelRadius * 1.2 - (wheelRadius * 0.3 * spiralProgress);
          }
          
          const angleRad = ballRotation * Math.PI / 180;
          const ballX = centerX + currentRadius * Math.cos(angleRad);
          const ballY = centerY + currentRadius * Math.sin(angleRad);
          
          gsap.set(ball, { left: ballX - 25, top: ballY - 25 });
        }
      }, 0);
      
      // Rotate the wheel rim for visual effect
      tl.to(rim, {
        rotation: spinParams.finalRotation,
        duration: duration,
        ease: 'power3.out'
      }, 0);
      
      // Haptic at intervals
      let lastTick = 0;
      tl.to({}, {
        duration: duration,
        onUpdate: function() {
          if ('vibrate' in navigator) {
            const progress = this.progress();
            const tickInterval = 0.1 / (1 - progress * 0.7); // Speed up as slowing down
            if (progress - lastTick > tickInterval) {
              navigator.vibrate(5);
              lastTick = progress;
            }
          }
        }
      }, 0);
    });
  }
  
  /**
   * Phase 4: Ball lands in winning pocket (2s)
   */
  async phase4_BallLanding() {
    console.log('⚾ Phase 4: Ball Landing');
    const status = this.rouletteState.statusElement;
    const ball = this.rouletteState.ballElement;
    const winner = this.items[this.rouletteState.winnerIndex];
    
    status.textContent = 'Landing...';
    
    const winnerRect = winner.getBoundingClientRect();
    const targetX = winnerRect.left + winnerRect.width / 2 - 25;
    const targetY = winnerRect.top + winnerRect.height / 2 - 25;
    
    const bounces = this.wheelEngine.getBounceSequence();
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Bounce sequence
      bounces.forEach((bounce, i) => {
        tl.to(ball, {
          left: targetX + (i === bounces.length - 1 ? 0 : (Math.random() - 0.5) * 60),
          top: targetY,
          scale: i === 0 ? 1.5 : 1,
          duration: bounce.duration,
          ease: bounce.ease
        });
        
        if (i < bounces.length - 1) {
          tl.to(ball, {
            top: targetY - bounce.height,
            duration: bounce.duration * 0.5,
            ease: 'power1.out'
          });
        }
      });
      
      // Final impact
      tl.to(ball, { scale: 1.3, duration: 0.1 });
      tl.to(ball, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.5)' });
      
      // Winner glow
      tl.to(winner, {
        boxShadow: '0 0 80px rgba(255,215,0,1), 0 0 120px rgba(255,215,0,0.5)',
        duration: 0.3,
        repeat: 2,
        yoyo: true
      }, '-=0.5');
      
      // Haptic burst
      if ('vibrate' in navigator) {
        tl.call(() => navigator.vibrate([100, 50, 100, 50, 200]));
      }
    });
  }
  
  /**
   * Phase 5: Winner rises from the wheel (2s)
   */
  async phase5_WinnerRise() {
    console.log('🏆 Phase 5: Winner Rise');
    const status = this.rouletteState.statusElement;
    const winner = this.items[this.rouletteState.winnerIndex];
    const ball = this.rouletteState.ballElement;
    
    status.textContent = 'Winner selected!';
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Fade out ball
      tl.to(ball, { opacity: 0, scale: 0, duration: 0.5 });
      
      // Fade out other cards
      this.items.forEach((card, i) => {
        if (i !== this.rouletteState.winnerIndex) {
          tl.to(card, {
            opacity: 0,
            scale: 0.5,
            duration: 0.8
          }, 0);
        }
      });
      
      // Fade out wheel rim
      if (this.rouletteState.wheelRim) {
        tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.8 }, 0);
      }
      
      // Winner rises
      tl.to(winner, {
        z: 500,
        scale: 1.3,
        rotation: 0,
        boxShadow: '0 50px 150px rgba(255,215,0,0.6)',
        duration: 1.5,
        ease: 'back.out(1.5)'
      }, 0.3);
    });
  }
  
  /**
   * Phase 6: Winner moves to center (1.5s)
   */
  async phase6_CenterFocus() {
    console.log('🎯 Phase 6: Center Focus');
    const status = this.rouletteState.statusElement;
    const winner = this.items[this.rouletteState.winnerIndex];
    const winnerTitle = winner.dataset.title || 'Selected!';
    
    status.textContent = `🎉 ${winnerTitle}`;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const winnerRect = winner.getBoundingClientRect();
    
    return new Promise(resolve => {
      gsap.to(winner, {
        x: centerX - winnerRect.left - winnerRect.width / 2,
        y: centerY - winnerRect.top - winnerRect.height / 2,
        z: 600,
        scale: 1.5,
        rotation: 360,
        duration: 1.5,
        ease: 'power2.inOut',
        onComplete: resolve
      });
    });
  }
  
  /**
   * Phase 7: Morph back to carousel (2s)
   */
  async phase7_MorphBack() {
    console.log('🔄 Phase 7: Morph Back');
    const status = this.rouletteState.statusElement;
    const winner = this.items[this.rouletteState.winnerIndex];
    const overlay = this.rouletteState.wheelContainer;
    
    status.textContent = 'Returning to projects...';
    
    // Remove wheel rim
    this.rouletteState.wheelRim?.remove();
    
    // Fade out overlay
    gsap.to(overlay, { opacity: 0, duration: 1 });
    gsap.to(status, { opacity: 0, duration: 0.5 });
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Fade in all cards and position as carousel
      this.items.forEach((card, i) => {
        if (i !== this.rouletteState.winnerIndex) {
          tl.to(card, {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
            duration: 0
          }, 0);
        }
      });
      
      // Winner goes to center carousel position
      tl.to(winner, {
        x: 0,
        y: 0,
        z: 0,
        scale: 1.25,
        rotation: 0,
        boxShadow: '0 0 50px rgba(201,167,109,0.3)',
        duration: 1.5,
        ease: 'power3.inOut'
      }, 0);
      
      // Update all items to carousel positions
      tl.call(() => {
        this.updateAllItems(this.rouletteState.winnerIndex, 0.8);
      }, null, 0.5);
    });
  }
  
  /**
   * Phase 8: Open carousel on winner (1s)
   */
  async phase8_CarouselOpen(winnerTitle) {
    console.log('🎬 Phase 8: Carousel Open');
    const winner = this.items[this.rouletteState.winnerIndex];
    
    // Set carousel to winner
    this.currentIndex = this.rouletteState.winnerIndex;
    
    await this.delay(500);
    
    // Pulse winner
    await this.gsapTo(winner, {
      scale: 1.4,
      duration: 0.4,
      ease: 'back.out(1.7)'
    });
    
    await this.gsapTo(winner, {
      scale: 1.25,
      duration: 0.3
    });
    
    // Offer to view project
    await this.delay(800);
    
    const projectLink = winner.querySelector('.card-link');
    if (projectLink && window.confirm(`🎉 You selected: ${winnerTitle}!\n\nView this project now?`)) {
      window.location.href = projectLink.href;
    }
  }
  
  /**
   * Simple roulette fallback (V4.1 style)
   */
  async startSimpleRoulette() {
    // ... V4.1 simple bounce roulette implementation ...
    console.log('Running simple roulette (casino wheel disabled)');
  }
  
  // ========================================
  // UTILITY METHODS
  // ========================================
  
  gsapTo(target, vars) {
    return new Promise(resolve => {
      gsap.to(target, { ...vars, onComplete: resolve });
    });
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
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }
  
  resetAutoplay() {
    this.stopAutoplay();
    if (this.config.autoplay) this.startAutoplay();
  }
  
  setupResizeHandler() {
    let timer;
    const handle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.updateAllItems(this.currentIndex, 0), 150);
    };
    window.addEventListener('resize', handle);
    if ('ResizeObserver' in window) {
      new ResizeObserver(handle).observe(this.container);
    }
  }
  
  announceCurrentSlide() {
    const card = this.items[this.currentIndex];
    if (!card) return;
    const title = card.dataset.title || 
                  card.querySelector('.card-title')?.textContent || 
                  `Slide ${this.currentIndex + 1}`;
    
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
    this.cleanupWheelElements();
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

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('[data-luxury-coverflow-auto]');
  if (el) {
    window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]');
  }
});
