'use client';

import { useEffect } from 'react';
import { applyTheme } from './theme';
import { useTheme } from './useTheme';

/** Keeps <html> in step with system changes and other tabs after the first paint. */
export function ThemeSync() {
  const { resolved } = useTheme();
  useEffect(() => applyTheme(resolved), [resolved]);
  return null;
}
