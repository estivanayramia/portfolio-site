/**
 * Luxury Coverflow Carousel V4.1 - Ultimate Performance + Visibility Edition
 * 
 * V4.1 FIXES:
 * - ✅ Roulette cards VISIBLE through overlay (reduced opacity + card pulse)
 * - ✅ Directional scroll (↔️ carousel, ↕️ page scroll)
 * - ✅ Frame-by-frame smooth tracking with GSAP quickTo
 * - ✅ All V4.0 fixes retained
 */

import { gsap } from 'gsap';
import { Coverflow3DEngine } from './coverflow-3d-engine.js';
import { CoverflowPhysics } from './coverflow-physics.js';

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
    
    // V4.1: Enhanced config
    this.config = {
      autoplay: false,
      autoplayDelay: 5000,
      infiniteLoop: true,
      enableKeyboard: true,
      enableMouse: true,
      enableTouch: true,
      enableScroll: true,
      enableSmoothTracking: true,   // V4.1: Frame-by-frame tracking
      scrollThreshold: 30,          // V4.1: More sensitive
      scrollSensitivity: 0.004,     // V4.1: Continuous tracking sensitivity
      
      // V4: Performance tuning
      animationDuration: 0.55,
      animationEase: 'power2.out',
      staggerDelay: 0.02,
      
      // Roulette config
      rouletteBounces: { min: 8, max: 13 },
      
      ...options
    };
    
    this.currentIndex = Math.floor(this.items.length / 2);
    this.isAnimating = false;
    this.autoplayTimer = null;
    this.navQueue = null;
    
    // V4.1: Continuous scroll position
    this.scrollPosition = this.currentIndex;
    this.isScrollTracking = false;
    
    // V4: Click detection state
    this.clickState = {
      startTime: 0,
      startX: 0,
      startY: 0
    };
    
    this.engine3D = new Coverflow3DEngine({
      ...this.config,
      infiniteLoop: this.config.infiniteLoop
    });
    
    this.physics = new CoverflowPhysics({
      friction: 0.92,
      snapThreshold: 0.2,
      velocityMultiplier: 2.5
    });
    
    // V4: Enhanced drag state
    this.dragState = {
      isDragging: false,
      startX: 0,
      currentX: 0,
      startIndex: 0,
      rafPending: false
    };
    
    this.init();
  }
  
  init() {
    if (this.items.length === 0) {
      console.warn('⚠️ No coverflow items found');
      return;
    }
    
    // V4: Initial render (instant)
    this.updateAllItems(this.currentIndex, 0);
    
    // Setup all interactions
    this.setupKeyboardNavigation();
    this.setupMouseDrag();
    this.setupTouchDrag();
    this.setupScrollNavigation();      // V4.1: Directional scroll
    this.setupSmoothScrollTracking();  // V4.1: Frame-by-frame
    this.setupItemClicks();
    this.setupResizeHandler();
    this.setupNavigationButtons();
    this.setupRouletteButton();
    
    if (this.config.autoplay) {
      this.startAutoplay();
    }
    
    this.announceCurrentSlide();
    console.log('✨ Luxury Coverflow V4.1 initialized with', this.items.length, 'items');
  }
  
  /**
   * V4: GSAP-powered animations with GPU optimization
   */
  updateAllItems(centerIndex, duration = this.config.animationDuration) {
    const transforms = this.engine3D.calculateAllTransforms(
      centerIndex,
      this.items.length,
      this.config.infiniteLoop
    );
    
    // Kill any existing animations
    gsap.killTweensOf(this.items);
    
    this.items.forEach((item, index) => {
      const transform = transforms[index];
      const isCenter = index === Math.round(centerIndex);
      const absPosition = this.getAbsoluteDistance(index, Math.round(centerIndex));
      
      // V4: GPU promotion only during animation
      if (duration > 0) {
        item.style.willChange = 'transform, opacity';
      }
      
      // Stagger based on distance
      const stagger = absPosition * this.config.staggerDelay;
      
      // V4: Optimized GSAP animation
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
        
        duration: duration,
        ease: this.config.animationEase,
        delay: duration > 0 ? stagger : 0,
        force3D: true,
        
        onComplete: () => {
          item.style.willChange = 'auto';
        }
      });
      
      // Immediate class updates
      item.classList.toggle('is-center', isCenter);
      item.classList.toggle('is-adjacent', absPosition === 1);
      item.setAttribute('aria-current', isCenter ? 'true' : 'false');
      item.setAttribute('tabindex', isCenter ? '0' : '-1');
      item.style.pointerEvents = transform.opacity > 0.1 ? 'auto' : 'none';
    });
    
    this.updatePagination();
  }
  
  /**
   * V4.1: Update to fractional position (for smooth scrolling)
   */
  updateContinuousPosition(position) {
    const transforms = this.engine3D.calculateAllTransforms(
      position,
      this.items.length,
      this.config.infiniteLoop
    );
    
    this.items.forEach((item, index) => {
      const transform = transforms[index];
      const isCenter = index === Math.round(position);
      const absPosition = this.getAbsoluteDistance(index, Math.round(position));
      
      // Instant update (no animation)
      gsap.set(item, {
        x: transform.translateX,
        y: transform.translateY || 0,
        z: transform.translateZ,
        rotationY: transform.rotateY,
        rotationX: transform.rotateX || 0,
        scale: transform.scale,
        opacity: transform.opacity,
        filter: this.engine3D.getFilterString(transform.filter),
        zIndex: transform.zIndex,
        force3D: true
      });
      
      item.classList.toggle('is-center', isCenter);
      item.classList.toggle('is-adjacent', absPosition === 1);
    });
  }
  
  /**
   * V4: Calculate distance with infinite loop wrapping
   */
  getAbsoluteDistance(index, centerIndex) {
    let distance = Math.abs(index - centerIndex);
    
    if (this.config.infiniteLoop && this.items.length > 1) {
      const wrapDistance = this.items.length - distance;
      distance = Math.min(distance, wrapDistance);
    }
    
    return distance;
  }
  
  /**
   * V4: Fixed infinite loop with proper modulo
   */
  goToSlide(targetIndex, duration = this.config.animationDuration) {
    // V4: Normalize using proper modulo (handles negative)
    if (this.config.infiniteLoop && this.items.length > 0) {
      targetIndex = ((targetIndex % this.items.length) + this.items.length) % this.items.length;
    } else {
      targetIndex = Math.max(0, Math.min(this.items.length - 1, targetIndex));
    }
    
    // Skip if already there
    if (targetIndex === this.currentIndex) {
      return;
    }
    
    // V4: Queue if animating
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
    
    setTimeout(() => {
      this.isAnimating = false;
    }, duration * 1000 + 50);
  }
  
  next() {
    this.goToSlide(this.currentIndex + 1);
  }
  
  prev() {
    this.goToSlide(this.currentIndex - 1);
  }
  
  // ========================================
  // KEYBOARD NAVIGATION
  // ========================================
  
  setupKeyboardNavigation() {
    if (!this.config.enableKeyboard) return;
    
    document.addEventListener('keydown', (e) => {
      if (!this.container.contains(document.activeElement) && 
          !this.container.matches(':hover')) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.next();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.items.length - 1);
          break;
      }
    });
  }
  
  // ========================================
  // MOUSE DRAG
  // ========================================
  
  setupMouseDrag() {
    if (!this.config.enableMouse) return;
    
    this.track.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startDrag(e.clientX);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.dragState.isDragging) return;
      this.updateDrag(e.clientX);
    });
    
    document.addEventListener('mouseup', () => {
      if (!this.dragState.isDragging) return;
      this.endDrag();
    });
  }
  
  // ========================================
  // TOUCH DRAG
  // ========================================
  
  setupTouchDrag() {
    if (!this.config.enableTouch) return;
    
    this.track.addEventListener('touchstart', (e) => {
      this.startDrag(e.touches[0].clientX);
    }, { passive: true });
    
    this.track.addEventListener('touchmove', (e) => {
      if (!this.dragState.isDragging) return;
      e.preventDefault();
      this.updateDrag(e.touches[0].clientX);
    }, { passive: false });
    
    this.track.addEventListener('touchend', () => {
      if (!this.dragState.isDragging) return;
      this.endDrag();
    });
  }
  
  // ========================================
  // V4.1: DIRECTIONAL SCROLL NAVIGATION
  // ========================================
  
  /**
   * V4.1: Detect scroll direction - only horizontal triggers carousel
   */
  setupScrollNavigation() {
    if (!this.config.enableScroll) return;
    
    let scrollDeltaX = 0;
    let scrollTimeout;
    
    this.container.addEventListener('wheel', (e) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);
      
      // V4.1: Determine scroll direction with 1.5x bias toward horizontal
      const isHorizontal = absDeltaX > (absDeltaY * 0.5);
      
      if (isHorizontal && absDeltaX > 5) {
        // Horizontal scroll → carousel navigation
        e.preventDefault();
        
        scrollDeltaX += e.deltaX;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (Math.abs(scrollDeltaX) >= this.config.scrollThreshold) {
            if (scrollDeltaX > 0) {
              this.next();
            } else {
              this.prev();
            }
          }
          scrollDeltaX = 0;
        }, 80);
      }
      // Vertical scroll → allow page scroll (don't preventDefault)
      
    }, { passive: false });
    
    console.log('✅ Directional scroll enabled: ↔️ Carousel | ↕️ Page');
  }
  
  // ========================================
  // V4.1: FRAME-BY-FRAME SMOOTH TRACKING
  // ========================================
  
  /**
   * V4.1: Continuous smooth carousel tracking with GSAP
   */
  setupSmoothScrollTracking() {
    if (!this.config.enableSmoothTracking) return;
    
    let targetPosition = this.currentIndex;
    let scrollEndTimeout;
    
    this.container.addEventListener('wheel', (e) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);
      
      // Only for horizontal scroll
      if (absDeltaX <= (absDeltaY * 0.5)) return;
      if (absDeltaX < 5) return;
      
      e.preventDefault();
      this.isScrollTracking = true;
      
      // Accumulate scroll delta for continuous tracking
      targetPosition += e.deltaX * this.config.scrollSensitivity;
      
      // Wrap or clamp position
      if (this.config.infiniteLoop) {
        while (targetPosition < 0) {
          targetPosition += this.items.length;
        }
        while (targetPosition >= this.items.length) {
          targetPosition -= this.items.length;
        }
      } else {
        targetPosition = Math.max(0, Math.min(this.items.length - 1, targetPosition));
      }
      
      // Update continuously (instant)
      this.scrollPosition = targetPosition;
      this.updateContinuousPosition(targetPosition);
      
      // Debounced snap on scroll end
      clearTimeout(scrollEndTimeout);
      scrollEndTimeout = setTimeout(() => {
        this.isScrollTracking = false;
        const nearestIndex = Math.round(targetPosition);
        
        // Snap to nearest slide
        this.goToSlide(nearestIndex, 0.25);
        targetPosition = nearestIndex;
      }, 120);
      
    }, { passive: false });
    
    console.log('✅ Smooth frame-by-frame tracking enabled');
  }
  
  // ========================================
  // DRAG HANDLERS
  // ========================================
  
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
      this.currentIndex,
      this.items.length,
      dragDelta,
      this.config.infiniteLoop
    );
    
    this.goToSlide(targetIndex);
    
    this.dragState.isDragging = false;
    this.container.classList.remove('is-dragging');
    this.physics.endDrag();
  }
  
  // ========================================
  // ITEM CLICKS
  // ========================================
  
  setupItemClicks() {
    this.items.forEach((item, index) => {
      item.addEventListener('pointerdown', (e) => {
        this.clickState.startTime = Date.now();
        this.clickState.startX = e.clientX;
        this.clickState.startY = e.clientY;
      });
      
      item.addEventListener('pointerup', (e) => {
        const duration = Date.now() - this.clickState.startTime;
        const moveX = Math.abs(e.clientX - this.clickState.startX);
        const moveY = Math.abs(e.clientY - this.clickState.startY);
        
        const isClick = duration < 300 && moveX < 10 && moveY < 10;
        
        if (isClick && index !== this.currentIndex) {
          e.preventDefault();
          e.stopPropagation();
          this.goToSlide(index);
        }
      });
      
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && index !== this.currentIndex) {
          e.preventDefault();
          this.goToSlide(index);
        }
      });
    });
  }
  
  // ========================================
  // NAVIGATION BUTTONS
  // ========================================
  
  setupNavigationButtons() {
    const prevBtn = this.container.querySelector('.coverflow-btn-prev');
    const nextBtn = this.container.querySelector('.coverflow-btn-next');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prev();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.next();
      });
    }
  }
  
  // ========================================
  // V4.1: ROULETTE FEATURE (VISIBILITY FIX)
  // ========================================
  
  setupRouletteButton() {
    let rouletteBtn = this.container.querySelector('.roulette-trigger-btn');
    
    if (!rouletteBtn) {
      rouletteBtn = document.querySelector('.roulette-trigger-btn');
    }
    
    if (!rouletteBtn) {
      console.log('ℹ️ No roulette button found');
      return;
    }
    
    console.log('🎰 Roulette button found, attaching listener');
    
    rouletteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🎰 Roulette clicked!');
      
      try {
        await this.startRoulette();
      } catch (error) {
        console.error('❌ Roulette error:', error);
        this.isAnimating = false;
        this.stopCardPulsing();
      }
    });
  }
  
  /**
   * V4.1: Roulette with VISIBLE cards through overlay
   */
  async startRoulette() {
    if (this.isAnimating) {
      console.warn('⚠️ Animation in progress');
      return;
    }
    
    console.log('🎰 Starting roulette...');
    this.isAnimating = true;
    
    // Get or create overlay
    let overlay = document.querySelector('.roulette-ball-overlay');
    if (!overlay) {
      overlay = this.createRouletteOverlay();
    }
    
    const ball = overlay.querySelector('.roulette-ball');
    const status = overlay.querySelector('.roulette-status');
    
    // V4.1: SEMI-TRANSPARENT overlay so cards are VISIBLE
    overlay.style.cssText = `
      display: flex !important;
      opacity: 0;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.5) !important;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px) !important;
      pointer-events: none;
    `;
    
    // V4.1: BRIGHTER ball with stronger glow
    ball.style.cssText = `
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #fff, #FFD700 50%, #FFA500);
      box-shadow: 
        0 0 30px rgba(255, 215, 0, 1),
        0 0 60px rgba(255, 215, 0, 0.8),
        0 0 90px rgba(255, 215, 0, 0.5),
        0 15px 40px rgba(0, 0, 0, 0.6);
      z-index: 10001;
      pointer-events: none;
    `;
    
    // Fade in overlay
    await this.gsapTo(overlay, {
      opacity: 1,
      duration: 0.3
    });
    
    // V4.1: PULSE EFFECT on cards during roulette for visibility
    this.startCardPulsing();
    
    // V4.1: BIGGER, GLOWING status text
    status.textContent = 'Spinning the wheel...';
    status.style.cssText = `
      position: fixed;
      bottom: 4rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 2rem;
      font-weight: 700;
      color: #FFD700;
      text-align: center;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      opacity: 0;
      z-index: 10001;
      text-shadow: 
        0 0 20px rgba(255, 215, 0, 0.8),
        0 0 40px rgba(255, 215, 0, 0.5);
      pointer-events: none;
    `;
    status.style.opacity = '1';
    
    // Get FRESH card positions (adapts to zoom)
    const cardRects = this.items.map(card => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    });
    
    // V4.1: Create ghost card outlines on overlay
    this.createGhostCards(overlay, cardRects);
    
    // Phase 1: Ball bounces
    await this.animateRouletteBounce(ball, cardRects, status);
    
    // Phase 2: Select random winner
    const winnerIndex = Math.floor(Math.random() * this.items.length);
    const winnerTitle = this.items[winnerIndex].dataset.title || 'Selected!';
    console.log('🎯 Winner:', winnerIndex, winnerTitle);
    
    // V4.1: STOP card pulsing
    this.stopCardPulsing();
    
    // Phase 3: Land on winner
    status.textContent = 'Landing...';
    await this.animateRouletteLand(ball, cardRects[winnerIndex]);
    
    // Show winner name
    status.textContent = `🎉 ${winnerTitle}`;
    await this.delay(1200);
    
    // Remove ghost cards
    overlay.querySelectorAll('.roulette-ghost-card').forEach(g => g.remove());
    
    // Fade out overlay
    await this.gsapTo(overlay, {
      opacity: 0,
      duration: 0.5
    });
    overlay.style.display = 'none';
    
    // Navigate to winner
    this.isAnimating = false;
    this.goToSlide(winnerIndex, 0.9);
    
    // Wait for navigation, then pulse
    await this.delay(1000);
    
    const winnerCard = this.items[winnerIndex];
    await this.gsapTo(winnerCard, {
      scale: 1.4,
      duration: 0.5,
      ease: 'back.out(1.9)'
    });
    await this.gsapTo(winnerCard, {
      scale: 1.3,
      duration: 0.3
    });
    
    // Navigate to project
    setTimeout(() => {
      const projectLink = winnerCard.querySelector('.card-link');
      if (projectLink && window.confirm(`View ${winnerTitle}?`)) {
        window.location.href = projectLink.href;
      }
    }, 1500);
  }
  
  /**
   * V4.1: Start pulsing effect on all cards
   */
  startCardPulsing() {
    this.items.forEach(card => {
      gsap.to(card, {
        scale: '+=0.05',
        boxShadow: '0 0 40px rgba(255, 215, 0, 0.6)',
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    });
  }
  
  /**
   * V4.1: Stop pulsing effect
   */
  stopCardPulsing() {
    this.items.forEach(card => {
      gsap.killTweensOf(card);
    });
  }
  
  /**
   * V4.1: Create ghost card outlines on overlay
   */
  createGhostCards(overlay, cardRects) {
    cardRects.forEach((rect, i) => {
      const ghost = document.createElement('div');
      ghost.className = 'roulette-ghost-card';
      ghost.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 3px solid rgba(255, 215, 0, 0.4);
        border-radius: 16px;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 
          0 0 20px rgba(255, 215, 0, 0.3),
          inset 0 0 30px rgba(255, 215, 0, 0.1);
      `;
      overlay.appendChild(ghost);
    });
  }
  
  /**
   * V4: Create overlay DOM
   */
  createRouletteOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'roulette-ball-overlay';
    
    const ball = document.createElement('div');
    ball.className = 'roulette-ball';
    
    const status = document.createElement('div');
    status.className = 'roulette-status';
    
    overlay.appendChild(ball);
    overlay.appendChild(status);
    document.body.appendChild(overlay);
    
    return overlay;
  }
  
  /**
   * V4: Ball bounce animation with physics
   */
  async animateRouletteBounce(ball, cardRects, status) {
    const { min, max } = this.config.rouletteBounces;
    const bounceCount = min + Math.floor(Math.random() * (max - min + 1));
    
    console.log(`⚾ Bouncing ${bounceCount} times`);
    
    const startX = window.innerWidth / 2 - 25;
    const startY = -100;
    
    gsap.set(ball, {
      left: startX,
      top: startY,
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1
    });
    
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      for (let i = 0; i < bounceCount; i++) {
        const card = cardRects[Math.floor(Math.random() * cardRects.length)];
        const targetX = card.centerX - 25;
        const targetY = card.centerY - 25;
        
        const progress = i / bounceCount;
        const duration = 0.2 + (progress * 0.25);
        const ease = progress < 0.6 ? 'power2.out' : 'power1.out';
        
        tl.to(ball, {
          left: targetX,
          top: targetY,
          duration: duration,
          ease: ease
        });
        
        tl.to(ball, {
          scale: 1.5,
          duration: 0.06,
          ease: 'power2.out'
        }, '>-0.02');
        
        tl.to(ball, {
          scale: 1,
          duration: 0.06,
          ease: 'power2.in'
        });
        
        if ('vibrate' in navigator) {
          const vibStrength = Math.max(5, 15 - Math.floor(progress * 10));
          tl.call(() => navigator.vibrate(vibStrength));
        }
        
        if (i === Math.floor(bounceCount * 0.4)) {
          tl.call(() => { status.textContent = 'Bouncing...'; });
        }
        if (i === Math.floor(bounceCount * 0.7)) {
          tl.call(() => { status.textContent = 'Slowing down...'; });
        }
      }
    });
  }
  
  /**
   * V4: Dramatic landing animation
   */
  async animateRouletteLand(ball, winnerRect) {
    const targetX = winnerRect.centerX - 25;
    const targetY = winnerRect.centerY - 25;
    
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(ball, {
          left: targetX,
          top: targetY,
          scale: 2.5,
          duration: 0.7,
          ease: 'back.out(1.8)'
        })
        .to(ball, {
          scale: 1.5,
          duration: 0.35,
          ease: 'elastic.out(1, 0.5)'
        });
        
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    });
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
    const currentEl = this.container.querySelector('.pagination-current');
    const totalEl = this.container.querySelector('.pagination-total');
    
    if (currentEl) currentEl.textContent = String(this.currentIndex + 1);
    if (totalEl) totalEl.textContent = String(this.items.length);
  }
  
  startAutoplay() {
    if (!this.config.autoplay) return;
    
    this.autoplayTimer = setInterval(() => {
      this.next();
    }, this.config.autoplayDelay);
  }
  
  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }
  
  resetAutoplay() {
    this.stopAutoplay();
    if (this.config.autoplay) {
      this.startAutoplay();
    }
  }
  
  setupResizeHandler() {
    let resizeTimer;
    
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        console.log('📐 Recalculating positions');
        this.updateAllItems(this.currentIndex, 0);
      }, 150);
    };
    
    window.addEventListener('resize', handleResize);
    
    if ('ResizeObserver' in window) {
      new ResizeObserver(handleResize).observe(this.container);
    }
  }
  
  announceCurrentSlide() {
    const currentCard = this.items[this.currentIndex];
    if (!currentCard) return;
    
    const title = currentCard.dataset.title || 
                  currentCard.querySelector('.card-title')?.textContent || 
                  `Slide ${this.currentIndex + 1}`;
    
    let liveRegion = document.getElementById('coverflow-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'coverflow-live-region';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = `Now showing: ${title}`;
  }
  
  // ========================================
  // PUBLIC API
  // ========================================
  
  destroy() {
    this.stopAutoplay();
    gsap.killTweensOf(this.items);
    this.container.classList.remove('is-dragging');
    console.log('⏹️ Luxury Coverflow destroyed');
  }
  
  getState() {
    return {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      isAnimating: this.isAnimating,
      config: { ...this.config }
    };
  }
}

// Auto-initialize if data attribute present
document.addEventListener('DOMContentLoaded', () => {
  const autoInit = document.querySelector('[data-luxury-coverflow-auto]');
  if (autoInit) {
    window.luxuryCoverflow = new LuxuryCoverflow(
      '[data-luxury-coverflow-auto]',
      JSON.parse(autoInit.dataset.luxuryCoverflowOptions || '{}')
    );
  }
});
