'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { MakeUpPromptProvider } from '@/features/plan/hooks/useMakeUpPrompt';
import { SessionBar } from '@/features/session/SessionBar';
import { useInProgress } from '@/features/session/hooks/useInProgress';
import { cn } from '@/lib/utils';
import { BottomNav } from '../BottomNav';
import { SidebarNav } from '../SidebarNav';
import { StartSheetContext } from '../StartSheetContext';
import { StartWorkoutSheet } from '../StartWorkoutSheet';
import { TopBar } from '../TopBar';
import { sectionFromPathname } from '../utils';

export function AppShell({ children }: { children: ReactNode }) {
  const section = sectionFromPathname(usePathname());
  const [startOpen, setStartOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const inProgress = useInProgress();

  const openStart = (event: MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setStartOpen(true);
  };

  return (
    <MakeUpPromptProvider>
      <StartSheetContext.Provider value={() => setStartOpen(true)}>
        <div className="flex min-h-dvh">
          <SidebarNav section={section} onStart={openStart} inProgress={Boolean(inProgress)}>
            {inProgress ? <SessionBar inProgress={inProgress} variant="sidebar" /> : null}
          </SidebarNav>
          <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
            <TopBar section={section} />
            <main
              className={cn(
                'mx-auto w-full max-w-[960px] flex-1 px-4 pt-4 lg:mx-0 lg:max-w-none lg:px-8 lg:pt-6 lg:pb-12',
                // The session bar sits above the bottom nav and must not cover the end of the page.
                inProgress
                  ? 'pb-[calc(12.5rem+env(safe-area-inset-bottom))]'
                  : 'pb-[calc(8rem+env(safe-area-inset-bottom))]',
              )}
            >
              {children}
            </main>
          </div>
          {inProgress ? (
            <SessionBar
              inProgress={inProgress}
              className="fixed inset-x-3 bottom-[calc(112px+env(safe-area-inset-bottom))] z-30 lg:hidden"
            />
          ) : null}
          <BottomNav section={section} onStart={openStart} inProgress={Boolean(inProgress)} />
          <StartWorkoutSheet
            open={startOpen}
            onOpenChange={setStartOpen}
            returnFocusRef={openerRef}
          />
        </div>
      </StartSheetContext.Provider>
    </MakeUpPromptProvider>
  );
}
