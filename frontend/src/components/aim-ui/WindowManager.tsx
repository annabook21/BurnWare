/**
 * Window Manager Component
 * Manages multiple open chat windows
 * File size: ~145 lines
 */

import React, { useState, useCallback } from 'react';

export interface WindowConfig {
  id: string;
  component: React.ReactNode;
  zIndex: number;
}

interface WindowManagerProps {
  children: (api: WindowManagerAPI) => React.ReactNode;
}

export interface WindowManagerAPI {
  windows: Map<string, WindowConfig>;
  openWindow: (id: string, component: React.ReactNode) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  isWindowOpen: (id: string) => boolean;
}

export const WindowManager: React.FC<WindowManagerProps> = ({ children }) => {
  const [windows, setWindows] = useState<Map<string, WindowConfig>>(new Map());
  const [maxZIndex, setMaxZIndex] = useState(100);

  const openWindow = useCallback(
    (id: string, component: React.ReactNode) => {
      if (!windows.has(id)) {
        const newWindows = new Map(windows);
        const newZIndex = maxZIndex + 1;

        newWindows.set(id, {
          id,
          component,
          zIndex: newZIndex,
        });

        setWindows(newWindows);
        setMaxZIndex(newZIndex);
      } else {
        // Window already open, just focus it
        focusWindow(id);
      }
    },
    [windows, maxZIndex]
  );

  const closeWindow = useCallback(
    (id: string) => {
      const newWindows = new Map(windows);
      newWindows.delete(id);
      setWindows(newWindows);
    },
    [windows]
  );

  const focusWindow = useCallback(
    (id: string) => {
      const window = windows.get(id);
      if (window) {
        const newWindows = new Map(windows);
        const newZIndex = maxZIndex + 1;
        window.zIndex = newZIndex;
        newWindows.set(id, window);
        setWindows(newWindows);
        setMaxZIndex(newZIndex);
      }
    },
    [windows, maxZIndex]
  );

  const isWindowOpen = useCallback(
    (id: string) => {
      return windows.has(id);
    },
    [windows]
  );

  const api: WindowManagerAPI = {
    windows,
    openWindow,
    closeWindow,
    focusWindow,
    isWindowOpen,
  };

  return (
    <>
      {children(api)}
      {Array.from(windows.values()).map((window) => (
        <React.Fragment key={window.id}>{window.component}</React.Fragment>
      ))}
    </>
  );
};
