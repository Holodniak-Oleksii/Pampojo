import type { Viewport } from 'next';
import { Suspense } from 'react';
import { SessionSkeleton } from '@/features/session/ActiveSession';
import { SessionGate } from '../(app)/session-gate';

// Without viewport-fit=cover iOS reports every env(safe-area-inset-*) as 0.
export const viewport: Viewport = { viewportFit: 'cover' };

/** Full screen, no app shell: the session hides the navigation. */
export default function SessionLayout({ children }: LayoutProps<'/[lang]/session'>) {
  const skeleton = (
    <div className="min-h-dvh bg-background text-foreground">
      <SessionSkeleton />
    </div>
  );
  return (
    <Suspense fallback={skeleton}>
      <SessionGate fallback={skeleton}>{children}</SessionGate>
    </Suspense>
  );
}
