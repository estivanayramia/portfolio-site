/**
 * Roulette Wheel Engine V5.5 — Ultra-Realistic European Casino Edition
 * 
 * Features:
 * - Authentic 37-pocket European roulette number sequence
 * - Real red/black/green color mapping
 * - Card cloning for full wheel
 * - Ball physics with on-track illusion
 */

export class RouletteWheelEngine {
  constructor(config = {}) {
    // V5.5: Authentic European roulette wheel sequence
    // Source: https://www.casino.org/blog/the-roulette-table-explained/
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
    
    this.config = {
      // Wheel sizing
      wheelRadius: () => Math.min(window.innerWidth, window.innerHeight) * 0.36,
      pocketScale: 0.35,
      
      // Spin physics
      minSpins: 4,
      maxSpins: 6,
      spinDuration: { min: 6, max: 8 },
      
      // Ball physics
      ballRadiusMultiplier: 1.12,
      ballDecayRate: 1.8,
      
      ...config
    };
  }
  
  /**
   * V5.5: Clone original cards to create 37 authentic roulette pockets
   */
  createRoulettePockets(originalCards) {
    const pockets = [];
    const cardCount = originalCards.length;
    
    for (let i = 0; i < this.pocketCount; i++) {
      // Distribute cards evenly across 37 pockets
      const sourceIndex = Math.floor((i / this.pocketCount) * cardCount);
      const sourceCard = originalCards[sourceIndex];
      
      // Deep clone with all children
      const pocket = sourceCard.cloneNode(true);
      
      // Strip old IDs to avoid conflicts
      pocket.removeAttribute('id');
      pocket.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      
      // Apply pocket identity
      pocket.classList.add('roulette-pocket');
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
   * V5.5: Calculate circular positions for 37 pockets
   */
  calculatePocketPositions(centerX = null, centerY = null) {
    centerX = centerX ?? window.innerWidth / 2;
    centerY = centerY ?? window.innerHeight / 2;
    
    const radius = this.config.wheelRadius();
    const positions = [];
    
    for (let i = 0; i < this.pocketCount; i++) {
      // Start at top (-90°), distribute evenly
      const angle = ((360 / this.pocketCount) * i) - 90;
      const angleRad = angle * (Math.PI / 180);
      
      const x = centerX + radius * Math.cos(angleRad);
      const y = centerY + radius * Math.sin(angleRad);
      
      // Face center (perpendicular to radius)
      const rotation = angle + 90;
      
      positions.push({
        index: i,
        x, y,
        rotation,
        angle,
        angleRad,
        pocketData: this.wheelSequence[i],
        scale: this.config.pocketScale
      });
    }
    
    return positions;
  }
  
  /**
   * V5.5: Get pocket index that lands on winner
   * Maps original card index to one of the pockets containing that card
   */
  getWinnerPocketIndex(originalCardIndex, originalCardCount) {
    // Find all pockets that contain this card
    const matchingPockets = [];
    
    for (let i = 0; i < this.pocketCount; i++) {
      const sourceIndex = Math.floor((i / this.pocketCount) * originalCardCount);
      if (sourceIndex === originalCardIndex) {
        matchingPockets.push(i);
      }
    }
    
    // Pick random pocket from matches (more realistic)
    const winnerPocket = matchingPockets[Math.floor(Math.random() * matchingPockets.length)];
    const pocketData = this.wheelSequence[winnerPocket];
    
    console.log(`🎯 Card ${originalCardIndex} → Pocket ${winnerPocket} (${pocketData.number} ${pocketData.color})`);
    
    return winnerPocket;
  }
  
  /**
   * V5.5: Calculate wheel spin parameters for landing on target pocket
   */
  calculateWheelSpin(winnerPocketIndex) {
    const pocketAngle = (360 / this.pocketCount) * winnerPocketIndex;
    const spins = this.config.minSpins + Math.random() * 
                  (this.config.maxSpins - this.config.minSpins);
    
    // Final rotation lands on winner pocket
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
   * V5.5: Ball trajectory with spiral inward
   */
  getBallTrajectory(centerX, centerY) {
    const wheelRadius = this.config.wheelRadius();
    
    return {
      startRadius: wheelRadius * this.config.ballRadiusMultiplier,
      endRadius: wheelRadius * 0.92,
      centerX,
      centerY,
      spiralStartProgress: 0.55,
      decayRate: this.config.ballDecayRate
    };
  }
  
  /**
   * V5.5: Multi-bounce landing sequence
   */
  getBounceSequence() {
    return [
      { height: 50, duration: 0.35, ease: 'power2.out' },
      { height: 25, duration: 0.25, ease: 'power2.out' },
      { height: 8, duration: 0.15, ease: 'power1.out' }
    ];
  }
  
  /**
   * Get pocket color for styling
   */
  getPocketColor(pocketIndex) {
    return this.wheelSequence[pocketIndex]?.color || 'black';
  }
  
  /**
   * Get pocket number for display
   */
  getPocketNumber(pocketIndex) {
    return this.wheelSequence[pocketIndex]?.number ?? pocketIndex;
  }
}
