/**
 * Roulette Wheel Engine V5.6 — Fixed for Professional Casino Experience
 * 
 * V5.6 Fixes:
 * - Green "Try Again" pocket support
 * - Transparent card backgrounds (visible content)
 * - Auto-spin parameters
 */

export class RouletteWheelEngine {
  constructor(config = {}) {
    // Authentic European roulette wheel sequence
    this.wheelSequence = [
      { number: 0, color: 'green' },
      { number: 32, color: 'red' },
      { number: 15, color: 'black' },
      { number: 19, color: 'red' },
      { number: 4, color: 'black' },
      { number: 21, color: 'red' },
      { number: 2, color: 'black' },
      { number: 25, color: 'red' },
      { number: 17, color: 'black' },
      { number: 34, color: 'red' },
      { number: 6, color: 'black' },
      { number: 27, color: 'red' },
      { number: 13, color: 'black' },
      { number: 36, color: 'red' },
      { number: 11, color: 'black' },
      { number: 30, color: 'red' },
      { number: 8, color: 'black' },
      { number: 23, color: 'red' },
      { number: 10, color: 'black' },
      { number: 5, color: 'red' },
      { number: 24, color: 'black' },
      { number: 16, color: 'red' },
      { number: 33, color: 'black' },
      { number: 1, color: 'red' },
      { number: 20, color: 'black' },
      { number: 14, color: 'red' },
      { number: 31, color: 'black' },
      { number: 9, color: 'red' },
      { number: 22, color: 'black' },
      { number: 18, color: 'red' },
      { number: 29, color: 'black' },
      { number: 7, color: 'red' },
      { number: 28, color: 'black' },
      { number: 12, color: 'red' },
      { number: 35, color: 'black' },
      { number: 3, color: 'red' },
      { number: 26, color: 'black' }
    ];
    
    this.pocketCount = 37;
    this.greenPocketIndex = null;
    
    this.config = {
      wheelRadius: () => Math.min(window.innerWidth, window.innerHeight) * 0.36,
      pocketScale: 0.35,
      minSpins: 4,
      maxSpins: 6,
      spinDuration: { min: 5, max: 7 },
      ballRadiusMultiplier: 1.12,
      ...config
    };
  }
  
  /**
   * V5.6: Select ONE random pocket to be the GREEN "Try Again" pocket
   */
  getRandomGreenPocket() {
    this.greenPocketIndex = Math.floor(Math.random() * this.pocketCount);
    console.log(`💚 Green "Try Again" pocket: ${this.greenPocketIndex}`);
    return this.greenPocketIndex;
  }
  
  /**
   * V5.6: Clone cards to create 37 pockets (content stays visible)
   */
  createRoulettePockets(originalCards) {
    const pockets = [];
    const cardCount = originalCards.length;
    
    for (let i = 0; i < this.pocketCount; i++) {
      const sourceIndex = Math.floor((i / this.pocketCount) * cardCount);
      const sourceCard = originalCards[sourceIndex];
      
      const pocket = sourceCard.cloneNode(true);
      
      pocket.removeAttribute('id');
      pocket.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      
      pocket.classList.add('roulette-pocket-v56');
      pocket.dataset.pocketIndex = i;
      pocket.dataset.pocketNumber = this.wheelSequence[i].number;
      pocket.dataset.pocketColor = this.wheelSequence[i].color;
      pocket.dataset.originalCardIndex = sourceIndex;
      
      pockets.push(pocket);
    }
    
    console.log(`🎰 Created ${this.pocketCount} pockets from ${cardCount} cards`);
    return pockets;
  }
  
  /**
   * Calculate circular positions for 37 pockets
   */
  calculatePocketPositions(centerX = null, centerY = null) {
    centerX = centerX ?? window.innerWidth / 2;
    centerY = centerY ?? window.innerHeight / 2;
    
    const radius = this.config.wheelRadius();
    const positions = [];
    
    for (let i = 0; i < this.pocketCount; i++) {
      const angle = ((360 / this.pocketCount) * i) - 90;
      const angleRad = angle * (Math.PI / 180);
      
      positions.push({
        index: i,
        x: centerX + radius * Math.cos(angleRad),
        y: centerY + radius * Math.sin(angleRad),
        rotation: angle + 90,
        angle,
        angleRad,
        pocketData: this.wheelSequence[i],
        scale: this.config.pocketScale
      });
    }
    
    return positions;
  }
  
  /**
   * Get pocket index for winner (avoiding green pocket)
   */
  getWinnerPocketIndex(originalCardIndex, originalCardCount) {
    const matchingPockets = [];
    
    for (let i = 0; i < this.pocketCount; i++) {
      // Skip green pocket for regular wins
      if (i === this.greenPocketIndex) continue;
      
      const sourceIndex = Math.floor((i / this.pocketCount) * originalCardCount);
      if (sourceIndex === originalCardIndex) {
        matchingPockets.push(i);
      }
    }
    
    // If no matches (unlikely), use any non-green pocket
    if (matchingPockets.length === 0) {
      for (let i = 0; i < this.pocketCount; i++) {
        if (i !== this.greenPocketIndex) matchingPockets.push(i);
      }
    }
    
    const winnerPocket = matchingPockets[Math.floor(Math.random() * matchingPockets.length)];
    console.log(`🎯 Card ${originalCardIndex} → Pocket ${winnerPocket}`);
    
    return winnerPocket;
  }
  
  /**
   * Check if a pocket is the green "Try Again" pocket
   */
  isGreenPocket(pocketIndex) {
    return pocketIndex === this.greenPocketIndex;
  }
  
  /**
   * Calculate wheel spin parameters
   */
  calculateWheelSpin(winnerPocketIndex, options = {}) {
    const pocketAngle = ((360 / this.pocketCount) * winnerPocketIndex) - 90;
    const landingAngle = Number.isFinite(options.landingAngle) ? options.landingAngle : -92;
    const spinRange = Math.max(1, this.config.maxSpins - this.config.minSpins + 1);
    const spins = this.config.minSpins + Math.floor(Math.random() * spinRange);

    // Align selected pocket to a deterministic landing angle after full turns.
    const finalRotation = (landingAngle - pocketAngle) - (spins * 360);

    const duration = this.config.spinDuration.min +
                     Math.random() * (this.config.spinDuration.max - this.config.spinDuration.min);

    return { finalRotation, duration, spins, landingAngle, pocketAngle };
  }
  
  /**
   * Ball trajectory parameters
   */
  getBallTrajectory(centerX, centerY) {
    const wheelRadius = this.config.wheelRadius();
    return {
      startRadius: wheelRadius * this.config.ballRadiusMultiplier,
      endRadius: wheelRadius * 0.92,
      centerX,
      centerY
    };
  }
  
  /**
   * Ball bounce sequence for the final settle phase.
   * Each bounce lifts the ball outward (radially) and advances it by a
   * fraction of a pocket before it drops back down.
   *
   * height: radial lift in px (outward from wheel centre)
   * angularTravel: degrees the ball travels during this bounce
   * duration: seconds for the full up-and-down arc
   * ease: GSAP ease for the upward half; downward mirrors with .in
   */
  getBounceSequence() {
    return [
      { height: 38,  angularTravel: 22,  duration: 0.38, ease: 'power2.out' },
      { height: 20,  angularTravel: 12,  duration: 0.30, ease: 'power2.out' },
      { height: 9,   angularTravel: 5,   duration: 0.22, ease: 'power1.out' },
      { height: 3.5, angularTravel: 1.8, duration: 0.14, ease: 'sine.out'   }
    ];
  }

  /**
   * Pocket-boundary bounce modulation.
   *
   * Given the current ball angle, returns a radial offset that simulates
   * the ball rattling over the metal frets (pocket dividers) on the wheel.
   *
   * The amplitude envelope decays as `progress` approaches 1 so the
   * rattling fades away naturally during deceleration.
   *
   * @param {number} ballAngle  Current ball angle in degrees
   * @param {number} progress   Normalised spin progress 0..1
   * @param {number} amplitude  Max radial perturbation in px (default 6)
   * @returns {number} Radial offset (positive = outward)
   */
  getPocketBounceOffset(ballAngle, progress, amplitude = 6) {
    const pocketArc = 360 / this.pocketCount;           // ~9.73 deg per pocket
    const positionInPocket = ((ballAngle % pocketArc) + pocketArc) % pocketArc;
    const normPos = positionInPocket / pocketArc;        // 0..1 within pocket

    // Half-sine pulse: peaks at the boundary (normPos near 0 or 1),
    // zero in the middle of the pocket.
    const bounceWave = Math.abs(Math.sin(normPos * Math.PI));

    // Envelope: strongest early on, fades with exponential decay
    const envelope = Math.pow(1 - progress, 2.2);

    return bounceWave * amplitude * envelope;
  }

  /**
   * Compute an exponential-decay velocity factor for a given progress.
   *
   * At progress=0 the factor is 1 (full speed). At progress=1 the factor
   * approaches `floor` (near-zero but not exactly zero, to keep a slow
   * creep at the end). The `sharpness` parameter controls how quickly
   * velocity drops off:
   *   sharpness=3 → moderate (good for premium tier)
   *   sharpness=5 → very fast initial drop-off
   *
   * @param {number} progress   0..1
   * @param {number} sharpness  Exponential rate (default 3.2)
   * @param {number} floor      Minimum velocity fraction (default 0.04)
   * @returns {number} velocity multiplier 0..1
   */
  getDecelerationFactor(progress, sharpness = 3.2, floor = 0.04) {
    return floor + (1 - floor) * Math.exp(-sharpness * progress);
  }
}
