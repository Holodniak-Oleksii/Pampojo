import { useEffect, useState } from 'react';

/**
 * A key that changes each time the page is hidden. With Cache Components, Next.js keeps a left
 * page in a hidden Activity with its state, so a form keyed by this opens empty on the next visit.
 */
export function useVisitKey(): number {
  const [key, setKey] = useState(0);
  // Activity runs effect cleanups when it hides the page, and a real unmount ignores the update.
  useEffect(() => () => setKey((value) => value + 1), []);
  return key;
}
