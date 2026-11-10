import { useSyncExternalStore } from 'react';
import { partOfDay, type PartOfDay } from './utils';

const subscribe = () => () => {};

/** `null` on the server and during hydration: the device clock is unknown there. */
export function usePartOfDay(): PartOfDay | null {
  return useSyncExternalStore(
    subscribe,
    () => partOfDay(new Date()),
    () => null,
  );
}
