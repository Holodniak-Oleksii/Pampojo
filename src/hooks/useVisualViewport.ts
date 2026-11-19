import { useSyncExternalStore } from 'react';

export interface VisualViewportBox {
  height: number;
  offsetTop: number;
}

let cached: VisualViewportBox | null = null;

function read(): VisualViewportBox | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  // A new object only on a real change, so useSyncExternalStore does not loop.
  if (cached?.height !== viewport.height || cached.offsetTop !== viewport.offsetTop) {
    cached = { height: viewport.height, offsetTop: viewport.offsetTop };
  }
  return cached;
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
}

/** The visible part of the page: it shrinks when an on-screen keyboard opens. */
export function useVisualViewport(): VisualViewportBox | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
