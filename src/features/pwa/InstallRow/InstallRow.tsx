'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppIconTile } from '../AppIconTile';
import { IosInstallGuide } from '../IosInstallGuide';
import { useInstallAction } from '../useInstallAction';

/** Profile row that installs the app; it stays until the app is installed. */
export function InstallRow() {
  const { t } = useTranslation();
  const { path, run, guideOpen, setGuideOpen } = useInstallAction();
  if (path === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="flex min-h-14 w-full items-center gap-3.5 rounded-lg bg-card py-3 pr-3.5 pl-4 text-left text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AppIconTile size={32} />
        <span className="flex-1">{t('Install app')}</span>
        <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
      </button>
      <IosInstallGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
