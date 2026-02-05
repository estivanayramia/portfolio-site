/**
 * Physics engine for drag/swipe momentum and inertia
 */

export class CoverflowPhysics {
  constructor(config = {}) {
    this.friction = config.friction || 0.92;
    this.snapThreshold = config.snapThreshold || 0.3;
    this.velocityMultiplier = config.velocityMultiplier || 1.5;
    
    this.velocity = 0;
    this.position = 0;
    this.targetPosition = 0;
    this.isDragging = false;
    this.lastPosition = 0;
    this.lastTime = 0;
    
    this.rafId = null;
  }
  
  /**
   * Start drag/touch interaction
   */
  startDrag(initialPosition) {
    this.isDragging = true;
    this.position = initialPosition;
    this.lastPosition = initialPosition;
    this.lastTime = performance.now();
    this.velocity = 0;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  /**
   * Update drag position and calculate velocity
   */
  updateDrag(currentPosition) {
    if (!this.isDragging) return;
    
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    const deltaPosition = currentPosition - this.lastPosition;
    
    if (deltaTime > 0) {
      this.velocity = (deltaPosition / deltaTime) * this.velocityMultiplier;
    }
    
    this.position = currentPosition;
    this.lastPosition = currentPosition;
    this.lastTime = now;
  }
  
  /**
   * End drag and apply momentum
   */
  endDrag(onUpdate, onComplete) {
    this.isDragging = false;
    this.animateMomentum(onUpdate, onComplete);
  }
  
  /**
   * Momentum animation loop with friction
   */
  animateMomentum(onUpdate, onComplete) {
    const animate = () => {
      this.velocity *= this.friction;
      this.position += this.velocity;
      
      if (onUpdate) {
        onUpdate(this.position, this.velocity);
      }
      
      if (Math.abs(this.velocity) > 0.01) {
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.velocity = 0;
        if (onComplete) {
          onComplete(this.position);
        }
      }
    };
    
    this.rafId = requestAnimationFrame(animate);
  }
  
  /**
   * V2: Calculate snap target with infinite loop support
   */
  calculateSnapTarget(currentIndex, totalItems, dragDelta, infiniteLoop = false) {
    const threshold = this.snapThreshold;
    let targetIndex = currentIndex;
    
    if (dragDelta > threshold) {
      targetIndex = currentIndex - 1;
    } else if (dragDelta < -threshold) {
      targetIndex = currentIndex + 1;
    } else if (Math.abs(this.velocity) > 0.5) {
      const direction = this.velocity > 0 ? -1 : 1;
      targetIndex = currentIndex + direction;
    }
    
    // V2: Handle infinite loop wrapping
    if (infiniteLoop) {
      if (targetIndex < 0) {
        targetIndex = totalItems - 1;
      } else if (targetIndex >= totalItems) {
        targetIndex = 0;
      }
    } else {
      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(totalItems - 1, targetIndex));
    }
    
    return targetIndex;
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
