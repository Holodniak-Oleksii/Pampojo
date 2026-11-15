'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { REST } from '@/constants/session';

const SOUND_KEY = 'pampojo:session:sound';
const restKey = (exerciseId: string) => `pampojo:rest:${exerciseId}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the default is used then.
  }
}

/** The rest length last chosen for the exercise on this device, else the default. */
export function restLengthFor(exerciseId: string): number {
  const stored = Number(read(restKey(exerciseId)));
  return Number.isInteger(stored) && stored >= REST.minSec && stored <= REST.maxSec
    ? stored
    : REST.defaultSec;
}

export function rememberRestLength(exerciseId: string, seconds: number): void {
  write(restKey(exerciseId), String(seconds));
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSoundOn(): boolean {
  return read(SOUND_KEY) !== 'off';
}

/** The timer sound toggle, kept on the device. */
export function useTimerSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isSoundOn, () => true);
  const set = useCallback((value: boolean) => {
    write(SOUND_KEY, value ? 'on' : 'off');
    for (const listener of listeners) listener();
  }, []);
  return [on, set];
}
