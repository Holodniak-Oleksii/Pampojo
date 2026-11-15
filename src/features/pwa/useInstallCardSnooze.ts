'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { INSTALL_CARD_HIDDEN_UNTIL_KEY, INSTALL_CARD_SNOOZE_DAYS } from './constants';

const listeners = new Set<() => void>();
// Used when storage is unavailable (private mode): the card stays closed for this visit.
let memoryUntil: string | null = null;

function readUntil(): string | null {
  try {
    return localStorage.getItem(INSTALL_CARD_HIDDEN_UNTIL_KEY) ?? memoryUntil;
  } catch {
    return memoryUntil;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isHidden(): boolean {
  const until = readUntil();
  return until !== null && Date.parse(until) > Date.now();
}

/** The Today card's close button hides it for a week on this device. */
export function useInstallCardSnooze(): { hidden: boolean; snooze: () => void } {
  // Hidden on the server and during hydration, so the card never flashes for a snoozed user.
  const hidden = useSyncExternalStore(subscribe, isHidden, () => true);
  const snooze = useCallback(() => {
    const until = new Date(Date.now() + INSTALL_CARD_SNOOZE_DAYS * 86_400_000).toISOString();
    memoryUntil = until;
    try {
      localStorage.setItem(INSTALL_CARD_HIDDEN_UNTIL_KEY, until);
    } catch {
      // Private mode: the memory copy keeps it hidden for this visit.
    }
    for (const listener of listeners) listener();
  }, []);
  return { hidden, snooze };
}
