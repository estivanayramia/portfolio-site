/**
 * Luxury Coverflow 3D Transform Engine V4.1
 * Performance-optimized transforms with fractional position support
 */

export class Coverflow3DEngine {
  constructor(config = {}) {
    this.config = {
      perspectiveDepth: 2500,
      itemGap: 480,
      depthMultiplier: 200,
      infiniteLoop: true,
      positions: config.positions || this.getDefaultPositions(),
      ...config
    };
    
    this.currentIndex = 0;
    this.targetIndex = 0;
    this.isAnimating = false;
  }
  
  /**
   * V4.1: Refined position presets for professional look
   */
  getDefaultPositions() {
    return {
      center: { 
        rotateY: 0, 
        translateZ: 0, 
        translateX: 0, 
        scale: 1.25, 
        opacity: 1, 
        zIndex: 100, 
        blur: 0, 
        brightness: 1.1,
        saturate: 1.05
      },
      adjacent1: { 
        rotateY: 48, 
        translateZ: -320, 
        translateX: 400, 
        scale: 0.88, 
        opacity: 0.92, 
        zIndex: 90, 
        blur: 0, 
        brightness: 0.95,
        saturate: 1
      },
      adjacent2: { 
        rotateY: 58, 
        translateZ: -550, 
        translateX: 650, 
        scale: 0.72, 
        opacity: 0.75, 
        zIndex: 80, 
        blur: 0.5, 
        brightness: 0.85,
        saturate: 0.95
      },
      adjacent3: { 
        rotateY: 65, 
        translateZ: -780, 
        translateX: 840, 
        scale: 0.58, 
        opacity: 0.5, 
        zIndex: 70, 
        blur: 1.5, 
        brightness: 0.7,
        saturate: 0.9
      },
      far: { 
        rotateY: 70, 
        translateZ: -1000, 
        translateX: 980, 
        scale: 0.45, 
        opacity: 0.2, 
        zIndex: 60, 
        blur: 2.5, 
        brightness: 0.5,
        saturate: 0.8
      }
    };
  }
  
  /**
   * V4.1: Interpolate between two position configs for smooth transitions
   */
  interpolatePositions(from, to, progress) {
    const lerp = (a, b, t) => a + (b - a) * t;
    
    return {
      rotateY: lerp(from.rotateY, to.rotateY, progress),
      rotateX: lerp(from.rotateX || 0, to.rotateX || 0, progress),
      translateZ: lerp(from.translateZ, to.translateZ, progress),
      translateX: lerp(from.translateX, to.translateX, progress),
      scale: lerp(from.scale, to.scale, progress),
      opacity: lerp(from.opacity, to.opacity, progress),
      zIndex: lerp(from.zIndex, to.zIndex, progress),
      blur: lerp(from.blur || 0, to.blur || 0, progress),
      brightness: lerp(from.brightness || 1, to.brightness || 1, progress),
      saturate: lerp(from.saturate || 1, to.saturate || 1, progress)
    };
  }
  
  /**
   * V4.1: Calculate transform with fractional position support
   */
  calculateItemTransform(itemIndex, centerIndex, totalItems, infiniteLoop = false) {
    let relativePosition = itemIndex - centerIndex;
    
    // Handle wrapping for infinite loop display
    if (infiniteLoop && totalItems > 1) {
      const halfCount = totalItems / 2;
      if (relativePosition > halfCount) {
        relativePosition -= totalItems;
      } else if (relativePosition < -halfCount) {
        relativePosition += totalItems;
      }
    }
    
    const absPosition = Math.abs(relativePosition);
    const direction = relativePosition >= 0 ? 1 : -1;
    
    // V4.1: Interpolate between position presets for smooth transitions
    let positionConfig;
    if (absPosition <= 0.01) {
      positionConfig = this.config.positions.center;
    } else if (absPosition < 1) {
      // Interpolate between center and adjacent1
      positionConfig = this.interpolatePositions(
        this.config.positions.center,
        this.config.positions.adjacent1,
        absPosition
      );
    } else if (absPosition < 2) {
      positionConfig = this.interpolatePositions(
        this.config.positions.adjacent1,
        this.config.positions.adjacent2,
        absPosition - 1
      );
    } else if (absPosition < 3) {
      positionConfig = this.interpolatePositions(
        this.config.positions.adjacent2,
        this.config.positions.adjacent3,
        absPosition - 2
      );
    } else if (absPosition < 4) {
      positionConfig = this.interpolatePositions(
        this.config.positions.adjacent3,
        this.config.positions.far,
        absPosition - 3
      );
    } else {
      positionConfig = this.config.positions.far;
    }
    
    // Apply direction multiplier
    const transforms = {
      rotateY: positionConfig.rotateY * direction,
      rotateX: positionConfig.rotateX || 0,
      translateZ: positionConfig.translateZ,
      translateX: positionConfig.translateX * direction,
      translateY: 0,
      scale: positionConfig.scale,
      opacity: positionConfig.opacity,
      zIndex: Math.round(positionConfig.zIndex - absPosition),
      filter: {
        blur: positionConfig.blur || 0,
        brightness: positionConfig.brightness || 1,
        saturate: positionConfig.saturate || 1
      }
    };
    
    // Hide items beyond visible range
    if (absPosition > 4) {
      transforms.opacity = 0;
    }
    
    return transforms;
  }
  
  /**
   * Generate CSS transform string (for fallback)
   */
  getTransformString(transforms) {
    return `translateX(${transforms.translateX}px) translateY(${transforms.translateY}px) translateZ(${transforms.translateZ}px) rotateY(${transforms.rotateY}deg) rotateX(${transforms.rotateX}deg) scale(${transforms.scale})`;
  }
  
  /**
   * Generate CSS filter string
   */
  getFilterString(filterObj) {
    return `blur(${filterObj.blur}px) brightness(${filterObj.brightness}) saturate(${filterObj.saturate})`;
  }
  
  /**
   * V4.1: Calculate all transforms with fractional position support
   */
  calculateAllTransforms(centerIndex, totalItems, infiniteLoop = false) {
    const transforms = [];
    
    for (let i = 0; i < totalItems; i++) {
      transforms.push(this.calculateItemTransform(i, centerIndex, totalItems, infiniteLoop));
    }
    
    return transforms;
  }
  
  /**
   * Easing function - cubic ease in/out
   */
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
