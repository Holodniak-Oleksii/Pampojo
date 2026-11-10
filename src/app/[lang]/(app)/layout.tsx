import type { Viewport } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/features/app-shell/AppShell';
import { AppShellSkeleton } from '@/features/app-shell/AppShellSkeleton';
import { SessionGate } from './session-gate';

// Without viewport-fit=cover iOS reports every env(safe-area-inset-*) as 0.
export const viewport: Viewport = { viewportFit: 'cover' };

export default function AppLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <SessionGate>
        <AppShell>{children}</AppShell>
      </SessionGate>
    </Suspense>
  );
}
