/**
 * AIM Sounds Hook
 * Manages fire-themed notification sounds
 * File size: ~90 lines
 */

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface SoundEffects {
  playFireIgnite: () => void;
  playFireExtinguish: () => void;
  playMatchStrike: () => void;
  setMuted: (muted: boolean) => void;
}

export const useAIMSounds = (): SoundEffects => {
  const soundsRef = useRef<{
    fireIgnite: Howl;
    fireExtinguish: Howl;
    matchStrike: Howl;
  } | null>(null);

  useEffect(() => {
    // Initialize sounds
    soundsRef.current = {
      fireIgnite: new Howl({
        src: ['/sounds/fire-ignite.mp3'],
        volume: 0.5,
        preload: true,
      }),
      fireExtinguish: new Howl({
        src: ['/sounds/fire-extinguish.mp3'],
        volume: 0.5,
        preload: true,
      }),
      matchStrike: new Howl({
        src: ['/sounds/match-strike.mp3'],
        volume: 0.4,
        preload: true,
      }),
    };

    return () => {
      // Cleanup
      Object.values(soundsRef.current || {}).forEach((sound) => sound.unload());
    };
  }, []);

  const playFireIgnite = () => {
    soundsRef.current?.fireIgnite.play();
  };

  const playFireExtinguish = () => {
    soundsRef.current?.fireExtinguish.play();
  };

  const playMatchStrike = () => {
    soundsRef.current?.matchStrike.play();
  };

  const setMuted = (muted: boolean) => {
    if (soundsRef.current) {
      Object.values(soundsRef.current).forEach((sound) => {
        sound.mute(muted);
      });
    }
  };

  return {
    playFireIgnite,
    playFireExtinguish,
    playMatchStrike,
    setMuted,
  };
};
