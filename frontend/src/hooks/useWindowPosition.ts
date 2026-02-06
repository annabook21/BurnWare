/**
 * Window Position Hook
 * Manages window positioning with cascade effect
 * File size: ~80 lines
 */

import { useState, useCallback } from 'react';

export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface WindowState {
  id: string;
  position: WindowPosition;
}

export const useWindowPosition = () => {
  const [windows, setWindows] = useState<Map<string, WindowState>>(new Map());
  const [maxZIndex, setMaxZIndex] = useState(100);

  const cascadeOffset = 30; // Pixels to offset each new window

  const addWindow = useCallback(
    (id: string, width: number, height: number) => {
      const count = windows.size;
      const x = 100 + count * cascadeOffset;
      const y = 100 + count * cascadeOffset;

      const newWindow: WindowState = {
        id,
        position: { x, y, width, height, zIndex: maxZIndex + 1 },
      };

      setWindows(new Map(windows).set(id, newWindow));
      setMaxZIndex(maxZIndex + 1);
    },
    [windows, maxZIndex, cascadeOffset]
  );

  const removeWindow = useCallback(
    (id: string) => {
      const newWindows = new Map(windows);
      newWindows.delete(id);
      setWindows(newWindows);
    },
    [windows]
  );

  const bringToFront = useCallback(
    (id: string) => {
      const window = windows.get(id);
      if (window) {
        window.position.zIndex = maxZIndex + 1;
        setWindows(new Map(windows));
        setMaxZIndex(maxZIndex + 1);
      }
    },
    [windows, maxZIndex]
  );

  return { windows, addWindow, removeWindow, bringToFront };
};
