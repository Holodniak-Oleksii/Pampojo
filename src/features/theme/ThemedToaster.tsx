'use client';

import { Toaster } from '@/components/ui/sonner';
import { useTheme } from './useTheme';

/** Toasts read the tokens already; the theme only switches Sonner's own icons and defaults. */
export function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} />;
}
