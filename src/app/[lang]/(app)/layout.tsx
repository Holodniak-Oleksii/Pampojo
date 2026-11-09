import { Suspense } from 'react';
import { SessionGate } from './session-gate';

export default function AppLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <Suspense fallback={null}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
