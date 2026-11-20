'use client';

import { useEffect } from 'react';
import { warmMissingPages } from './warm-pages';

/** Keeps the main app pages in the page cache, so they open offline without a first visit. */
export function useWarmAppPages(): void {
  useEffect(() => {
    void warmMissingPages();
    const onOnline = () => void warmMissingPages();
    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener('controllerchange', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      navigator.serviceWorker?.removeEventListener('controllerchange', onOnline);
    };
  }, []);
}
