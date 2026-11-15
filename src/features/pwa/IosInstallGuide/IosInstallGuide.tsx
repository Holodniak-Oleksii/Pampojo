'use client';

import { Share, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useIsDesktop';

export interface IosInstallGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Step({ index, icon, text }: { index: number; icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span
        aria-hidden="true"
        className="mx-1 inline-flex size-[22px] shrink-0 rotate-45 items-center justify-center rounded-[2px] border-[1.5px] border-foreground"
      >
        <span className="-rotate-45 text-xs font-extrabold">{index}</span>
      </span>
      <span
        aria-hidden="true"
        // The text tile ("Додати") grows past 44px instead of touching its edges.
        className="grid h-11 min-w-11 shrink-0 place-items-center rounded-lg bg-background px-2 text-[13px] font-bold"
      >
        {icon}
      </span>
      <span className="text-base font-semibold">{text}</span>
    </li>
  );
}

/** Safari has no install prompt, so iPhone users get the three taps it takes. */
export function IosInstallGuide({ open, onOpenChange }: IosInstallGuideProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const body = (
    <>
      <ol className="flex flex-col gap-3.5">
        <Step index={1} icon={<Share className="size-[22px]" />} text={t('Tap "Share"')} />
        <Step
          index={2}
          icon={<SquarePlus className="size-[22px]" />}
          text={t('Choose "Add to Home Screen"')}
        />
        <Step index={3} icon={t('Add')} text={t('Tap "Add"')} />
      </ol>
      <Button className="mt-1.5 w-full" onClick={() => onOpenChange(false)}>
        {t('Got it')}
      </Button>
    </>
  );
  const title = t('Install Pampojo');
  const intro = t('Opens from your home screen and works in the gym without internet.');

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-w-[440px] flex-col gap-4 rounded-xl bg-card p-6">
          <DialogTitle className="pr-10 text-xl font-extrabold">{title}</DialogTitle>
          <DialogDescription className="-mt-1.5">{intro}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t('Close')}
        className="gap-4 rounded-t-xl bg-card px-5 pt-2.5 pb-[max(2rem,env(safe-area-inset-bottom))] motion-reduce:animate-none"
      >
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border-strong"
        />
        <SheetTitle className="pr-10 text-xl font-extrabold">{title}</SheetTitle>
        <SheetDescription className="-mt-1.5 text-base">{intro}</SheetDescription>
        {body}
      </SheetContent>
    </Sheet>
  );
}
