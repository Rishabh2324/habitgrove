import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Seamless 48s loop of breeze, a distant stream and songbirds (synthesized, no third-party audio).
const SOURCE = require('../assets/sounds/garden-ambience.m4a');
const KEY = 'habitgrove/ambience/v1';
const VOLUME = 0.45;
const FADE_MS = 2500;

// Ambient sound should respect the silent switch and never interrupt the user's music.
setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});

/** Plays the garden soundscape while mounted, with a persisted on/off preference. */
export function useGardenAmbience() {
  const player = useAudioPlayer(SOURCE);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setEnabled(raw !== 'off'))
      .catch(() => setEnabled(true));
  }, []);

  useEffect(() => {
    if (!enabled) {
      player.pause();
      return;
    }
    player.loop = true;
    player.volume = 0;
    let fade: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      player.play();
      const t0 = Date.now();
      fade = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / FADE_MS);
        player.volume = VOLUME * p * p;
        if (p === 1) clearInterval(fade);
      }, 50);
    };

    // Browsers block audio until the user interacts with the page, so wait for the first gesture.
    const nav = typeof navigator !== 'undefined' ? (navigator as { userActivation?: { hasBeenActive: boolean } }) : undefined;
    if (Platform.OS === 'web' && nav?.userActivation && !nav.userActivation.hasBeenActive) {
      const events = ['pointerdown', 'keydown'] as const;
      const onGesture = () => {
        events.forEach((e) => window.removeEventListener(e, onGesture));
        start();
      };
      events.forEach((e) => window.addEventListener(e, onGesture));
      return () => {
        events.forEach((e) => window.removeEventListener(e, onGesture));
        clearInterval(fade);
      };
    }

    start();
    return () => clearInterval(fade);
  }, [enabled, player]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(KEY, next ? 'on' : 'off').catch(() => {});
      return next;
    });
  }, []);

  return { enabled: enabled ?? false, toggle };
}
