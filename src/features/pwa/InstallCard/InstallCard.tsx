'use client';

import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AppIconTile } from '../AppIconTile';
import { IosInstallGuide } from '../IosInstallGuide';
import { useInstallAction } from '../useInstallAction';
import { useInstallCardSnooze } from '../useInstallCardSnooze';

/** Today's install nudge, phones only; closing it hides it for a week. */
export function InstallCard() {
  const { t } = useTranslation();
  const { path, run, guideOpen, setGuideOpen } = useInstallAction();
  const { hidden, snooze } = useInstallCardSnooze();
  if (path === null || hidden) return null;

  return (
    <section
      aria-labelledby="install-card-title"
      className="flex items-center gap-3 rounded-lg bg-card py-2.5 pr-0.5 pl-3 lg:hidden"
    >
      <AppIconTile size={40} />
      <h2 id="install-card-title" className="min-w-0 flex-1 text-base leading-tight font-extrabold">
        {t('Install Pampojo')}
      </h2>
      <Button size="sm" className="px-3.5" onClick={run}>
        {path === 'ios' ? t('How to install') : t('Install')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('Close')}
        className="h-11 w-10 text-muted-foreground"
        onClick={snooze}
      >
        <X aria-hidden="true" className="size-[18px]" />
      </Button>
      <IosInstallGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </section>
  );
}
