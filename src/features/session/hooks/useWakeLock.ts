'use client';

import { useEffect } from 'react';

/** Keeps the screen on while the session is visible, where the browser supports it. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (active) sentinel = next;
        else void next.release();
      } catch {
        // Low battery or a denied permission: the screen simply sleeps as usual.
      }
    };
    // The browser releases the lock when the page hides, so it is requested again on return.
    const onVisible = () => void request();

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
