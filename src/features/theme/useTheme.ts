'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { DARK_QUERY, THEME_STORAGE_KEY, type ResolvedTheme, type Theme } from './constants';
import { applyTheme, parseTheme, resolveTheme } from './theme';

const listeners = new Set<() => void>();
// Used when storage is unavailable (private mode), so the switch still works for the visit.
let memoryTheme: Theme | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY) ?? memoryTheme);
  } catch {
    return parseTheme(memoryTheme);
  }
}

function systemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) listener();
  };
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', listener);
  };
}

function snapshot(): string {
  return `${readTheme()}:${systemDark() ? 'dark' : 'light'}`;
}

export function setStoredTheme(theme: Theme): void {
  memoryTheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is unavailable; the in-memory value keeps the choice until the page closes.
  }
  applyTheme(resolveTheme(theme, systemDark()));
  emit();
}

export interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

/** The device theme setting, live with the system theme and other tabs. */
export function useTheme(): ThemeState {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'system:light');
  const [stored, system] = value.split(':');
  const theme = parseTheme(stored);
  const resolved = resolveTheme(theme, system === 'dark');
  const setTheme = useCallback((next: Theme) => setStoredTheme(next), []);
  return { theme, resolved, setTheme };
}
