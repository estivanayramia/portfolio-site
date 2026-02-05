/**
 * Luxury Coverflow V6.1 — CRITICAL ANIMATION FIX
 * 
 * FIXES:
 * ✅ Ball orbit — Full wheel circumference, not tiny movement
 * ✅ Ball 3D look — No awkward flip, smooth rotation
 * ✅ Smooth bounces — Natural timing and height
 * ✅ Winner alignment — Pocket preview = opened card (1:1)
 * ✅ Elegant morph — Float up → center → restore to carousel
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
      wheelRim: null,
      status: null,
      originalWinnerIndex: null,
      winnerPocketIndex: null,
      greenPocketIndex: null,
      pocketToCardMap: [] // V6.1: Direct mapping
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
    console.log('✨ Luxury Coverflow V6.1 — CRITICAL ANIMATION FIX 🎰');
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
  // V6.1: FIXED CASINO WHEEL
  // ========================================
  
  setupRouletteButton() {
    const btn = this.container.querySelector('.roulette-trigger-btn') ||
                document.querySelector('.roulette-trigger-btn');
    
    if (!btn) return;
    
    console.log('🎰 V6.1 Casino wheel ready — CRITICAL FIX');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.startCasinoWheelV61();
    });
  }
  
  /**
   * V6.1: Casino wheel with all critical fixes
   */
  async startCasinoWheelV61() {
    if (this.rouletteState.isActive) return;
    
    console.log('🎰 V6.1 CASINO — CRITICAL ANIMATION FIX!');
    this.rouletteState.isActive = true;
    this.isAnimating = true;
    
    // V6.1: Select winner FIRST, then ensure pocket maps to it
    this.rouletteState.originalWinnerIndex = Math.floor(Math.random() * this.items.length);
    this.rouletteState.greenPocketIndex = Math.floor(Math.random() * 37);
    
    // V6.1: Winner pocket is NOT green
    let winnerPocket = Math.floor(Math.random() * 37);
    while (winnerPocket === this.rouletteState.greenPocketIndex) {
      winnerPocket = Math.floor(Math.random() * 37);
    }
    this.rouletteState.winnerPocketIndex = winnerPocket;
    
    const winnerTitle = this.items[this.rouletteState.originalWinnerIndex].dataset.title || 'Selected!';
    console.log(`🎯 Winner: Card ${this.rouletteState.originalWinnerIndex} "${winnerTitle}"`);
    console.log(`🎯 Winner Pocket: ${this.rouletteState.winnerPocketIndex}`);
    console.log(`💚 Green Pocket: ${this.rouletteState.greenPocketIndex}`);
    
    try {
      await this.phase1_CreateOverlay();
      await this.phase2_CreateWheelFixed();
      await this.phase3_SpinFixed();
      await this.phase4_BallLandingFixed();
      await this.phase5_WinnerFloatUp();
      await this.phase6_CenterAndHold();
      await this.phase7_MorphToCarousel(winnerTitle);
      
      console.log('🎉 V6.1 Complete!');
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
    overlay.className = 'casino-overlay-v61';
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
   * Phase 2: Create wheel with FIXED pocket-to-card mapping
   */
  async phase2_CreateWheelFixed() {
    console.log('🔄 Phase 2: Create Wheel (FIXED MAPPING)');
    this.rouletteState.status.textContent = 'Forming wheel...';
    
    const overlay = this.rouletteState.overlay;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.35; // V6.1: Larger radius
    
    const wheelWrapper = document.createElement('div');
    wheelWrapper.className = 'wheel-wrapper-v61';
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
    const rimSize = wheelRadius * 2 + 120;
    const rim = document.createElement('div');
    rim.style.cssText = `
      position: absolute;
      left: ${-rimSize / 2}px;
      top: ${-rimSize / 2}px;
      width: ${rimSize}px;
      height: ${rimSize}px;
      border: 12px solid transparent;
      border-radius: 50%;
      background:
        linear-gradient(#002800, #002800) padding-box,
        linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #B8860B, #FFD700) border-box;
      box-shadow:
        0 0 80px rgba(255,215,0,0.9),
        0 0 150px rgba(255,215,0,0.5),
        inset 0 0 100px rgba(255,215,0,0.2);
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
    const pocketW = 80;
    const pocketH = 105;
    const greenIdx = this.rouletteState.greenPocketIndex;
    const winnerPocket = this.rouletteState.winnerPocketIndex;
    const winnerCard = this.rouletteState.originalWinnerIndex;
    
    // V6.1: Create direct pocket-to-card mapping
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
      
      const pocket = document.createElement('div');
      pocket.className = 'pocket-v61';
      pocket.dataset.pocketIndex = i;
      pocket.style.cssText = `
        position: absolute;
        left: ${x - pocketW / 2}px;
        top: ${y - pocketH / 2}px;
        width: ${pocketW}px;
        height: ${pocketH}px;
        border: 4px solid ${borderColor};
        border-radius: 10px;
        overflow: hidden;
        transform: rotate(${angle + 90}deg) scale(0);
        transform-origin: center center;
        opacity: 0;
        box-shadow:
          0 0 30px ${glowColor},
          0 0 60px ${glowColor};
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
            font-family: Arial Black, sans-serif;
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 15px #00FF00;
            line-height: 1.2;
          ">
            <div style="font-size: 150%;">TRY</div>
            <div style="font-size: 150%;">AGAIN</div>
          </div>
        `;
        this.rouletteState.pocketToCardMap[i] = -1; // Green = no card
      } else {
        // V6.1: CRITICAL FIX — Winner pocket MUST show winner card
        let cardIndex;
        if (isWinner) {
          cardIndex = winnerCard; // Winner pocket shows winner card
        } else {
          // Distribute other cards across non-winner, non-green pockets
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
          top: 5px;
          right: 5px;
          font-family: Arial Black, sans-serif;
          font-size: 13px;
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 12px #FFD700;
          background: rgba(0, 0, 0, 0.85);
          padding: 3px 6px;
          border-radius: 4px;
          z-index: 10;
        `;
        pocket.appendChild(badge);
      }
      
      wheelWrapper.appendChild(pocket);
      pockets.push(pocket);
    }
    
    this.rouletteState.pockets = pockets;
    console.log(`✅ Created ${pockets.length} pockets`);
    console.log(`✅ Winner pocket ${winnerPocket} → Card ${winnerCard}`);
    
    return new Promise(resolve => {
      pockets.forEach((pocket, i) => {
        gsap.to(pocket, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          delay: i * 0.025,
          ease: 'back.out(1.4)'
        });
      });
      setTimeout(resolve, 2500);
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
        svgClone.style.cssText = 'width: 45px; height: 45px; opacity: 0.9;';
        bgDiv.appendChild(svgClone);
      }
      
      preview.appendChild(bgDiv);
    }
    
    const title = sourceCard.dataset.title || 
                  sourceCard.querySelector('.card-title')?.textContent || 
                  'Project';
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title.length > 14 ? title.substring(0, 14) + '...' : title;
    titleEl.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 5px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(transparent, rgba(0,0,0,0.95));
      text-align: center;
      white-space: nowrap;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
    `;
    preview.appendChild(titleEl);
    
    return preview;
  }
  
  /**
   * Phase 3: Spin with FULL ORBIT ball
   */
  async phase3_SpinFixed() {
    console.log('🎡 Phase 3: Spin with FULL ORBIT Ball');
    this.rouletteState.status.textContent = 'Spinning...';
    
    const overlay = this.rouletteState.overlay;
    const wrapper = this.rouletteState.wheelWrapper;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    const wheelRadius = Math.min(viewW, viewH) * 0.35;
    
    // Calculate spin to land on winner pocket
    const winnerAngle = (360 / 37) * this.rouletteState.winnerPocketIndex;
    const spins = 4 + Math.floor(Math.random() * 2); // 4-5 full spins
    const finalRotation = -(spins * 360 + winnerAngle + 90); // Counter-rotate wheel
    const duration = 5 + Math.random(); // 5-6 seconds
    
    console.log(`🎡 Spinning ${spins} rotations to pocket ${this.rouletteState.winnerPocketIndex}`);
    
    // V6.1: Ball with proper 3D look (no flip)
    const ball = document.createElement('div');
    ball.className = 'roulette-ball-v61';
    ball.style.cssText = `
      position: absolute;
      width: 45px;
      height: 45px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ffffff 0%, #e8e8e8 30%, #b8b8b8 70%, #888888 100%);
      box-shadow:
        inset -8px -8px 20px rgba(0,0,0,0.4),
        inset 5px 5px 15px rgba(255,255,255,0.8),
        0 0 40px rgba(255,215,0,0.9),
        0 0 80px rgba(255,215,0,0.6);
      z-index: 100;
      pointer-events: none;
    `;
    overlay.appendChild(ball);
    this.rouletteState.ball = ball;
    
    // Ball shadow
    const ballShadow = document.createElement('div');
    ballShadow.style.cssText = `
      position: absolute;
      width: 50px;
      height: 18px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%);
      filter: blur(3px);
      z-index: 99;
      pointer-events: none;
    `;
    overlay.appendChild(ballShadow);
    this.rouletteState.ballShadow = ballShadow;
    
    // V6.1: Ball starts on OUTER edge and orbits FULL circumference
    const outerOrbitRadius = wheelRadius + 60; // Outside the wheel
    let ballAngle = Math.random() * 360;
    
    const updateBallPosition = (angle, radius) => {
      const rad = angle * Math.PI / 180;
      const x = centerX + radius * Math.cos(rad) - 22.5;
      const y = centerY + radius * Math.sin(rad) - 22.5;
      gsap.set(ball, { left: x, top: y });
      gsap.set(ballShadow, { left: x - 2, top: y + 30 });
    };
    
    updateBallPosition(ballAngle, outerOrbitRadius);
    console.log('⚪ Ball positioned on outer orbit');
    
    const statusEl = this.rouletteState.status;
    
    return new Promise(resolve => {
      // Spin wheel
      gsap.to(wrapper, {
        rotation: finalRotation,
        duration,
        ease: 'power2.out'
      });
      
      // V6.1: Ball orbits in OPPOSITE direction, spiraling inward
      let currentRadius = outerOrbitRadius;
      const innerRadius = wheelRadius - 10;
      
      gsap.to({}, {
        duration,
        ease: 'none',
        onUpdate: function() {
          const progress = this.progress();
          
          // Ball speed decreases with exponential decay
          const speedFactor = Math.pow(1 - progress, 1.5);
          const angularSpeed = 800 * speedFactor; // degrees per second equivalent
          ballAngle += angularSpeed * 0.016; // ~60fps
          
          // Spiral inward after 30% progress
          if (progress > 0.3) {
            const spiralProgress = (progress - 0.3) / 0.7;
            currentRadius = outerOrbitRadius - (outerOrbitRadius - innerRadius) * Math.pow(spiralProgress, 2);
          }
          
          updateBallPosition(ballAngle, currentRadius);
          
          // Dynamic glow based on speed
          const glowIntensity = 40 + speedFactor * 60;
          ball.style.boxShadow = `
            inset -8px -8px 20px rgba(0,0,0,0.4),
            inset 5px 5px 15px rgba(255,255,255,0.8),
            0 0 ${glowIntensity}px rgba(255,215,0,${0.6 + speedFactor * 0.4}),
            0 0 ${glowIntensity * 2}px rgba(255,215,0,${0.3 + speedFactor * 0.3})
          `;
          
          // Status updates
          if (progress < 0.3) statusEl.textContent = '🎰 Fast spin!';
          else if (progress < 0.6) statusEl.textContent = '🎰 Round and round...';
          else if (progress < 0.85) statusEl.textContent = '🎰 Slowing down...';
          else statusEl.textContent = '🎰 Almost there...';
        },
        onComplete: () => {
          console.log('⚪ Ball orbit complete');
          resolve();
        }
      });
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        const hapticInterval = setInterval(() => {
          navigator.vibrate(3);
        }, 150);
        setTimeout(() => clearInterval(hapticInterval), duration * 1000);
      }
    });
  }
  
  /**
   * Phase 4: Ball landing with natural bounces
   */
  async phase4_BallLandingFixed() {
    console.log('⚾ Phase 4: Ball Landing (SMOOTH BOUNCES)');
    this.rouletteState.status.textContent = 'Landing...';
    
    const ball = this.rouletteState.ball;
    const ballShadow = this.rouletteState.ballShadow;
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const rect = winnerPocket.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2 - 22.5;
    const targetY = rect.top + rect.height / 2 - 22.5;
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Move to pocket
      tl.to(ball, {
        left: targetX,
        top: targetY,
        duration: 0.4,
        ease: 'power2.out'
      });
      
      // V6.1: Natural bounce sequence (physics-based heights)
      tl.to(ball, { top: targetY - 40, duration: 0.2, ease: 'power2.out' });
      tl.to(ball, { top: targetY, duration: 0.25, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 18, duration: 0.15, ease: 'power1.out' });
      tl.to(ball, { top: targetY, duration: 0.18, ease: 'bounce.out' });
      tl.to(ball, { top: targetY - 6, duration: 0.1, ease: 'power1.out' });
      tl.to(ball, { top: targetY, duration: 0.1 });
      
      // Winner glow
      tl.to(winnerPocket, {
        boxShadow: '0 0 100px rgba(255,215,0,1), 0 0 200px rgba(255,215,0,0.7)',
        duration: 0.15,
        repeat: 3,
        yoyo: true
      }, '-=0.6');
      
      // Fade ball
      tl.to([ball, ballShadow], {
        opacity: 0,
        scale: 0.5,
        duration: 0.4
      });
      
      if ('vibrate' in navigator) navigator.vibrate([60, 30, 100, 50, 40]);
    });
  }
  
  /**
   * Phase 5: Winner floats up elegantly
   */
  async phase5_WinnerFloatUp() {
    console.log('🏆 Phase 5: Winner Float Up');
    this.rouletteState.status.textContent = 'Winner!';
    
    const pockets = this.rouletteState.pockets;
    const winnerPocket = pockets[this.rouletteState.winnerPocketIndex];
    const winnerCardIndex = this.rouletteState.pocketToCardMap[this.rouletteState.winnerPocketIndex];
    const winnerTitle = this.items[winnerCardIndex]?.dataset.title || 'Selected!';
    
    console.log(`🎯 Confirming winner: Pocket ${this.rouletteState.winnerPocketIndex} → Card ${winnerCardIndex} "${winnerTitle}"`);
    
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      
      // Fade out all other pockets
      pockets.forEach((p, i) => {
        if (i !== this.rouletteState.winnerPocketIndex) {
          tl.to(p, {
            opacity: 0,
            scale: 0.3,
            duration: 0.6,
            ease: 'power2.in'
          }, 0);
        }
      });
      
      // Fade rim
      tl.to(this.rouletteState.wheelRim, { opacity: 0, duration: 0.5 }, 0);
      
      // V6.1: Winner floats UP with subtle wobble
      tl.to(winnerPocket, {
        y: -50, // Float up
        scale: 2,
        rotation: 0, // Reset rotation
        boxShadow: '0 0 150px rgba(255,215,0,1), 0 30px 60px rgba(0,0,0,0.5)',
        duration: 1,
        ease: 'power2.out'
      }, 0.3);
    });
  }
  
  /**
   * Phase 6: Center and hold
   */
  async phase6_CenterAndHold() {
    console.log('🎯 Phase 6: Center and Hold');
    
    const winnerPocket = this.rouletteState.pockets[this.rouletteState.winnerPocketIndex];
    const winnerCardIndex = this.rouletteState.pocketToCardMap[this.rouletteState.winnerPocketIndex];
    const winnerTitle = this.items[winnerCardIndex]?.dataset.title || 'Selected!';
    
    this.rouletteState.status.textContent = `🎉 ${winnerTitle}`;
    
    // Get current position and calculate move to center
    const rect = winnerPocket.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const currentCenterX = rect.left + rect.width / 2;
    const currentCenterY = rect.top + rect.height / 2;
    const moveX = centerX - currentCenterX;
    const moveY = centerY - currentCenterY;
    
    return new Promise(resolve => {
      gsap.to(winnerPocket, {
        x: `+=${moveX}`,
        y: `+=${moveY}`,
        scale: 3,
        rotation: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: () => {
          // Hold at center
          setTimeout(resolve, 1000);
        }
      });
    });
  }
  
  /**
   * Phase 7: Morph smoothly to carousel
   */
  async phase7_MorphToCarousel(winnerTitle) {
    console.log('🔄 Phase 7: Morph to Carousel');
    this.rouletteState.status.textContent = 'Returning...';
    
    const winnerCardIndex = this.rouletteState.pocketToCardMap[this.rouletteState.winnerPocketIndex];
    
    // V6.1: Verify the opened card matches the preview
    console.log(`✅ Opening card ${winnerCardIndex}: "${this.items[winnerCardIndex]?.dataset.title}"`);
    
    // Check if green pocket
    if (this.rouletteState.winnerPocketIndex === this.rouletteState.greenPocketIndex) {
      console.log('💚 Green pocket hit!');
      
      if (confirm('🎰 Spin again?\n\nOK = Spin\nCancel = Browse')) {
        this.cleanupCasinoWheel();
        this.rouletteState.isActive = false;
        this.isAnimating = false;
        await this.delay(300);
        return this.startCasinoWheelV61();
      }
    }
    
    // Fade out overlay smoothly
    return new Promise(resolve => {
      gsap.to(this.rouletteState.overlay, {
        opacity: 0,
        duration: 1,
        ease: 'power2.inOut',
        onComplete: async () => {
          // Clear GSAP styles
          this.items.forEach(item => {
            gsap.set(item, { clearProps: 'all' });
          });
          
          await this.delay(50);
          
          // V6.1: Restore carousel with winner centered
          this.currentIndex = winnerCardIndex;
          this.updateAllItems(this.currentIndex, 0);
          
          // Fade cards in
          gsap.set(this.items, { opacity: 0 });
          gsap.to(this.items, {
            opacity: 1,
            duration: 0.8,
            stagger: 0.05,
            ease: 'power2.out',
            onComplete: () => {
              console.log('✅ Carousel restored with winner centered');
              
              // Highlight winner
              const winner = this.items[winnerCardIndex];
              gsap.timeline()
                .to(winner, { scale: 1.25, duration: 0.4, ease: 'back.out(2)' })
                .to(winner, { scale: 1.15, duration: 0.3 });
              
              // Ask to view
              this.delay(700).then(() => {
                const link = winner.querySelector('.card-link') || winner.querySelector('a[href]');
                if (link) {
                  const confirmView = confirm(`🎉 ${winnerTitle}!\n\nView this project?`);
                  if (confirmView) {
                    window.location.href = link.href;
                  }
                }
                resolve();
              });
            }
          });
        }
      });
    });
  }
  
  /**
   * Cleanup
   */
  cleanupCasinoWheel() {
    console.log('🧹 V6.1: Cleanup');
    
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
  if (el) window.luxuryCoverflow = new LuxuryCoverflow('[data-luxury-coverflow-auto]');
});
