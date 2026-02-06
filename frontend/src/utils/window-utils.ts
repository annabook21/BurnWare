/**
 * Window Utilities
 * Helper functions for window management
 * File size: ~75 lines
 */

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class WindowUtils {
  /**
   * Ensure window is within screen bounds
   */
  static constrainToViewport(
    x: number,
    y: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let constrainedX = Math.max(0, Math.min(x, viewportWidth - width));
    let constrainedY = Math.max(0, Math.min(y, viewportHeight - height));

    return { x: constrainedX, y: constrainedY };
  }

  /**
   * Calculate cascade position for new window
   */
  static calculateCascadePosition(index: number, offset: number = 30): { x: number; y: number } {
    return {
      x: 100 + index * offset,
      y: 100 + index * offset,
    };
  }

  /**
   * Center window on screen
   */
  static centerWindow(width: number, height: number): { x: number; y: number } {
    return {
      x: (window.innerWidth - width) / 2,
      y: (window.innerHeight - height) / 2,
    };
  }

  /**
   * Check if windows overlap
   */
  static doWindowsOverlap(bounds1: Bounds, bounds2: Bounds): boolean {
    return !(
      bounds1.right < bounds2.left ||
      bounds1.left > bounds2.right ||
      bounds1.bottom < bounds2.top ||
      bounds1.top > bounds2.bottom
    );
  }
}
