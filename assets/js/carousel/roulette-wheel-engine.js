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
  calculateWheelSpin(winnerPocketIndex) {
    const pocketAngle = (360 / this.pocketCount) * winnerPocketIndex;
    const spins = this.config.minSpins + Math.random() * 
                  (this.config.maxSpins - this.config.minSpins);
    
    const finalRotation = (spins * 360) + (360 - pocketAngle);
    
    const duration = this.config.spinDuration.min + 
                     Math.random() * (this.config.spinDuration.max - this.config.spinDuration.min);
    
    return { finalRotation, duration, spins: Math.round(spins) };
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
   * Ball bounce sequence
   */
  getBounceSequence() {
    return [
      { height: 50, duration: 0.35, ease: 'power2.out' },
      { height: 25, duration: 0.25, ease: 'power2.out' },
      { height: 8, duration: 0.15, ease: 'power1.out' }
    ];
  }
}
