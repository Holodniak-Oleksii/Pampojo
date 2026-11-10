'use client';

import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useIsDesktop';

export interface StartWorkoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function StartWorkoutSheet({ open, onOpenChange, returnFocusRef }: StartWorkoutSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          // The sheet opens from two Start buttons without a SheetTrigger, so focus goes back by hand.
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        className="max-h-dvh overflow-y-auto rounded-t-[32px] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-6 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">{t('Choose workout')}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 lg:px-6">
          <EmptyState
            icon={ListChecks}
            title={t('No workouts yet')}
            description={t('Create a workout to start a session.')}
            action={
              <Button asChild>
                <Link href="/library/workouts" onClick={() => onOpenChange(false)}>
                  {t('Create workout')}
                </Link>
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
