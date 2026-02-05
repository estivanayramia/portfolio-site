/**
 * Roulette Wheel Engine V1.0
 * Handles circular layout math and wheel physics
 * 
 * Used by Luxury Coverflow for the 3D casino wheel transformation
 */

export class RouletteWheelEngine {
  constructor(config = {}) {
    this.config = {
      // Wheel dimensions (responsive)
      wheelRadius: () => Math.min(window.innerWidth, window.innerHeight) * 0.35,
      pocketScale: 0.45,    // Card scale when in pocket
      
      // Spin physics
      minSpins: 3,          // Minimum full rotations
      maxSpins: 5,          // Maximum full rotations
      spinDuration: { min: 5, max: 8 }, // Duration in seconds
      
      // Ball physics
      ballRadiusMultiplier: 1.15, // Ball starts outside wheel
      ballSpeedMultiplier: 1.6,   // Ball faster than wheel initially
      ballDecayRate: 2.2,         // Ball slows faster than wheel
      
      ...config
    };
  }
  
  /**
   * Calculate circular positions for cards around wheel center
   */
  calculateCircularPositions(cardCount, centerX = null, centerY = null) {
    const radius = this.config.wheelRadius();
    centerX = centerX ?? window.innerWidth / 2;
    centerY = centerY ?? window.innerHeight / 2;
    
    const positions = [];
    const angleStep = (2 * Math.PI) / cardCount;
    const startAngle = -Math.PI / 2; // Start at top (12 o'clock)
    
    for (let i = 0; i < cardCount; i++) {
      const angle = startAngle + (angleStep * i);
      
      positions.push({
        index: i,
        angle: angle,
        angleDeg: angle * (180 / Math.PI),
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        rotation: angle * (180 / Math.PI) + 90, // Face center
        scale: this.config.pocketScale
      });
    }
    
    return positions;
  }
  
  /**
   * Calculate wheel spin parameters for landing on target
   */
  calculateWheelSpin(winnerIndex, totalItems) {
    const pocketAngle = (360 / totalItems) * winnerIndex;
    const spins = this.config.minSpins + Math.random() * 
                  (this.config.maxSpins - this.config.minSpins);
    
    // Final rotation: full spins + landing on winner pocket
    const finalRotation = (spins * 360) + (360 - pocketAngle);
    
    // Duration with randomness
    const duration = this.config.spinDuration.min + 
                     Math.random() * (this.config.spinDuration.max - this.config.spinDuration.min);
    
    return {
      finalRotation,
      duration,
      spins: Math.round(spins),
      winnerPocketAngle: pocketAngle
    };
  }
  
  /**
   * Get ball trajectory parameters
   */
  getBallTrajectory(wheelDuration, centerX, centerY) {
    const wheelRadius = this.config.wheelRadius();
    const ballRadius = wheelRadius * this.config.ballRadiusMultiplier;
    
    return {
      startRadius: ballRadius,
      endRadius: wheelRadius * 0.9,
      startX: centerX + ballRadius,
      startY: centerY,
      centerX,
      centerY,
      speedMultiplier: this.config.ballSpeedMultiplier,
      decayRate: this.config.ballDecayRate,
      spiralStartTime: wheelDuration * 0.6 // Start spiraling at 60%
    };
  }
  
  /**
   * Calculate ball position at given progress
   */
  calculateBallPosition(progress, trajectory, wheelRotation) {
    let { startRadius, endRadius, centerX, centerY, spiralStartTime } = trajectory;
    
    // Ball angle (opposite direction, faster decay)
    const ballAngle = -wheelRotation * trajectory.speedMultiplier * 
                      Math.pow(1 - progress, trajectory.decayRate);
    
    // Radius spirals inward after spiralStartTime
    let currentRadius = startRadius;
    if (progress > spiralStartTime / trajectory.duration) {
      const spiralProgress = (progress - spiralStartTime / trajectory.duration) / 
                             (1 - spiralStartTime / trajectory.duration);
      currentRadius = startRadius + (endRadius - startRadius) * 
                      this.easeOutCubic(spiralProgress);
    }
    
    const angleRad = ballAngle * (Math.PI / 180);
    
    return {
      x: centerX + currentRadius * Math.cos(angleRad),
      y: centerY + currentRadius * Math.sin(angleRad),
      angle: ballAngle,
      radius: currentRadius
    };
  }
  
  /**
   * Get bounce parameters for ball landing
   */
  getBounceSequence() {
    return [
      { height: 60, duration: 0.4, ease: 'power2.out' },
      { height: 30, duration: 0.3, ease: 'power2.out' },
      { height: 10, duration: 0.2, ease: 'power1.out' }
    ];
  }
  
  /**
   * Calculate roulette pocket colors (casino style)
   */
  getPocketColor(index, totalItems) {
    // Special cases for 0 (green)
    if (index === 0) return '#0F8A0F'; // Green
    
    // Alternate red/black
    return index % 2 === 0 ? '#DC2626' : '#1A1A1A';
  }
  
  /**
   * Create custom easing curve for wheel deceleration
   * Fast start, dramatic slowdown at end
   */
  getWheelEasingCurve() {
    // This creates a curve: fast 0-20%, gradual 20-80%, dramatic 80-100%
    return 'power3.out';
  }
  
  /**
   * Easing functions
   */
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
