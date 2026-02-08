/**
 * AIM Sounds Hook
 * Classic AIM notification sounds from im_20191103
 */

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface SoundEffects {
  /** IM.mp3 — message sent in chat */
  playMessageSend: () => void;
  /** Goodbye.mp3 — thread burned */
  playBurn: () => void;
  /** BuddyIn.mp3 — anonymous message sent */
  playBuddyIn: () => void;
  /** BuddyOut.mp3 — sign out */
  playBuddyOut: () => void;
  /** Welcome.mp3 — login success */
  playWelcome: () => void;
  /** You've Got Mail.mp3 — opening threads with messages */
  playYouvGotMail: () => void;
  /** File's Done.mp3 — link created */
  playFilesDone: () => void;
  setMuted: (muted: boolean) => void;

  // Legacy aliases (kept for backward compat)
  playFireIgnite: () => void;
  playFireExtinguish: () => void;
  playMatchStrike: () => void;
}

const SOUNDS = {
  messageSend:  { src: '/sounds/fire-ignite.mp3',      volume: 0.5 },
  burn:         { src: '/sounds/fire-extinguish.mp3',   volume: 0.5 },
  buddyIn:      { src: '/sounds/match-strike.mp3',      volume: 0.4 },
  buddyOut:     { src: '/sounds/buddy-out.mp3',         volume: 0.4 },
  welcome:      { src: '/sounds/welcome.mp3',           volume: 0.5 },
  youvGotMail:  { src: '/sounds/youve-got-mail.mp3',    volume: 0.5 },
  filesDone:    { src: '/sounds/files-done.mp3',        volume: 0.4 },
} as const;

type SoundKey = keyof typeof SOUNDS;

export const useAIMSounds = (): SoundEffects => {
  const soundsRef = useRef<Record<SoundKey, Howl> | null>(null);

  useEffect(() => {
    const entries = Object.entries(SOUNDS) as [SoundKey, (typeof SOUNDS)[SoundKey]][];
    const loaded = {} as Record<SoundKey, Howl>;
    for (const [key, config] of entries) {
      loaded[key] = new Howl({ src: [config.src], volume: config.volume, preload: true });
    }
    soundsRef.current = loaded;

    return () => {
      Object.values(soundsRef.current || {}).forEach((sound) => sound.unload());
    };
  }, []);

  const play = (key: SoundKey) => () => soundsRef.current?.[key].play();

  const setMuted = (muted: boolean) => {
    if (soundsRef.current) {
      Object.values(soundsRef.current).forEach((sound) => sound.mute(muted));
    }
  };

  return {
    playMessageSend: play('messageSend'),
    playBurn: play('burn'),
    playBuddyIn: play('buddyIn'),
    playBuddyOut: play('buddyOut'),
    playWelcome: play('welcome'),
    playYouvGotMail: play('youvGotMail'),
    playFilesDone: play('filesDone'),
    setMuted,

    // Legacy aliases
    playFireIgnite: play('messageSend'),
    playFireExtinguish: play('burn'),
    playMatchStrike: play('buddyIn'),
  };
};
