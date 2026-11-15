'use client';

import { useEffect, useRef } from 'react';
import { isSoundOn } from './useRestPrefs';

let audio: AudioContext | null = null;

/** iOS only lets audio start inside a user gesture, so the context is created on a set tap. */
export function primeAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function beep(): void {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.1;
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.15);
}

/** Vibrates and beeps once when a visible rest reaches zero. */
export function useRestAlarm(restEndsAt: string | null, over: boolean): void {
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!restEndsAt || !over || firedFor.current === restEndsAt) return;
    firedFor.current = restEndsAt;
    if (document.visibilityState !== 'visible') return;
    // A rest that ended long ago (the phone slept) is shown, not announced.
    if (Date.now() - new Date(restEndsAt).getTime() > 5000) return;
    navigator.vibrate?.(200);
    if (isSoundOn()) beep();
  }, [restEndsAt, over]);
}
