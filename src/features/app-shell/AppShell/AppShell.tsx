'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { BottomNav } from '../BottomNav';
import { SidebarNav } from '../SidebarNav';
import { StartWorkoutSheet } from '../StartWorkoutSheet';
import { TopBar } from '../TopBar';
import { sectionFromPathname } from '../utils';

export function AppShell({ children }: { children: ReactNode }) {
  const section = sectionFromPathname(usePathname());
  const [startOpen, setStartOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const openStart = (event: MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setStartOpen(true);
  };

  return (
    <div className="flex min-h-dvh">
      <SidebarNav section={section} onStart={openStart} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <TopBar section={section} />
        <main className="mx-auto w-full max-w-[960px] lg:mx-0 lg:max-w-none flex-1 px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav section={section} onStart={openStart} />
      <StartWorkoutSheet open={startOpen} onOpenChange={setStartOpen} returnFocusRef={openerRef} />
    </div>
  );
}
