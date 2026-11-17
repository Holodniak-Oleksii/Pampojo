'use client';

import { createContext, useContext } from 'react';

/** Opens the Start sheet from page content, such as an empty state. A no-op outside the shell. */
export const StartSheetContext = createContext<() => void>(() => {});

export function useOpenStartSheet(): () => void {
  return useContext(StartSheetContext);
}
