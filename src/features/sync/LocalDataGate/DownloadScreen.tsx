'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SetDoneIcon } from '@/components/BrandIcons';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { BRAND_ASSETS } from '@/features/pwa/brand-assets';
import { cn } from '@/lib/utils';
import type { DownloadStep, DownloadStepKey, DownloadView } from '@/services/sync';
import { signOutAndClear } from '../../auth/sign-out';

type ActiveView = Extract<DownloadView, { steps: DownloadStep[] }>;

function stepLabel(t: TFunction, key: DownloadStepKey): string {
  switch (key) {
    case 'profile':
      return t('Profile and gym');
    case 'workouts':
      return t('Workouts and plan');
    case 'exercises':
      return t('Exercises');
    case 'history':
      return t('History for 30 days');
    case 'measurements':
      return t('Body measurements');
  }
}

function errorTitle(t: TFunction, key: DownloadStepKey): string {
  switch (key) {
    case 'profile':
      return t('Could not load the profile');
    case 'workouts':
      return t('Could not load the workouts');
    case 'exercises':
      return t('Could not load the exercises');
    case 'history':
      return t('Could not load the history');
    case 'measurements':
      return t('Could not load the measurements');
  }
}

function Wordmark() {
  return (
    <>
      {/* Plain images: next/image would request /_next/image, which is not cached offline. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        src={BRAND_ASSETS.wordmark}
        alt="Pampojo"
        width={116}
        height={28}
        className="h-7 w-auto lg:h-8 dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        src={BRAND_ASSETS.wordmarkDark}
        alt="Pampojo"
        width={116}
        height={28}
        className="hidden h-7 w-auto lg:h-8 dark:block"
      />
    </>
  );
}

function StepValue({ step }: { step: DownloadStep }) {
  const { t } = useTranslation();
  if (step.status === 'failed') return <span>{t('Not loaded')}</span>;
  if (step.status === 'pending') return null;
  if (step.status === 'done') {
    if (step.key === 'workouts' || step.key === 'history') {
      return <span>{t('{{count}} workouts', { count: step.done ?? 0 })}</span>;
    }
    if (step.key === 'exercises') {
      return <span>{t('{{count}} exercises', { count: step.done ?? 0 })}</span>;
    }
    return <span>{t('Done')}</span>;
  }
  if (step.total === null) return null;
  return <span>{t('{{done}} of {{total}}', { done: step.done ?? 0, total: step.total })}</span>;
}

function StepList({ steps }: { steps: DownloadStep[] }) {
  const { t } = useTranslation();
  return (
    <ol className="mt-4 px-5 lg:px-8">
      {steps.map((step) => (
        <li
          key={step.key}
          aria-current={step.status === 'current' ? 'step' : undefined}
          className="flex min-h-[52px] items-center gap-3.5 border-b border-border last:border-b-0"
        >
          <SetDoneIcon
            done={step.status === 'done'}
            className={cn(
              'size-[22px]',
              step.status === 'pending' && 'text-planned',
              step.status === 'failed' && 'text-destructive',
            )}
          />
          <span
            className={cn(
              'flex-1 text-base font-bold',
              step.status === 'pending' && 'text-muted-foreground',
            )}
          >
            {stepLabel(t, step.key)}
          </span>
          <span
            className={cn(
              'text-[15px] font-semibold tabular-nums',
              step.status === 'done' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            <StepValue step={step} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function ProgressCard({ view }: { view: ActiveView }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const error = view.state === 'error';
  const failed = view.failedStep ?? 'profile';
  return (
    <section
      aria-labelledby="download-title"
      className="w-full overflow-hidden rounded-lg bg-card lg:w-[480px]"
    >
      <div
        role="progressbar"
        aria-label={t('Preparing your data for the gym')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent}
        className="h-[3px] bg-border"
      >
        <div
          className={cn(
            'h-[3px] motion-safe:transition-[width] motion-safe:duration-[240ms]',
            error ? 'bg-planned' : 'bg-accent',
          )}
          style={{ width: `${view.percent}%` }}
        />
      </div>
      <div className="px-5 pt-6 pb-2 lg:px-8 lg:pt-8">
        <h1
          id="download-title"
          className="text-[30px] leading-9 font-extrabold tracking-[-0.01em] lg:text-4xl lg:leading-[42px]"
        >
          {error ? errorTitle(t, failed) : t('Preparing your data for the gym')}
        </h1>
        {error ? (
          <p role="alert" className="mt-3 text-[15px] leading-[22px] text-muted-foreground">
            {t(
              'The connection dropped. What is loaded is saved on this device. Try again when you have a network.',
            )}
          </p>
        ) : (
          <p className="mt-3 text-[15px] leading-[22px] text-muted-foreground">
            <span className="lg:hidden">
              {t(
                'We save your workouts on this phone so they work without a network. This happens only once.',
              )}
            </span>
            <span className="hidden lg:inline">
              {t(
                'We save your workouts on this device so they work without a network. This happens only once.',
              )}
            </span>
          </p>
        )}
      </div>
      <StepList steps={view.steps} />
      {error ? (
        <div className="flex flex-col gap-2 p-5 lg:px-8">
          <Button size="md" className="w-full" onClick={view.retry}>
            {t('Try again')}
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full text-[15px] font-semibold"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              if (!(await signOutAndClear())) setLeaving(false);
            }}
          >
            {t('Log out', { context: 'download' })}
          </Button>
        </div>
      ) : (
        <div className="h-2" />
      )}
    </section>
  );
}

function OfflineCard({ view }: { view: ActiveView }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="download-offline-title"
      className="flex w-full flex-col items-center rounded-lg bg-card px-5 pt-8 pb-5 text-center lg:w-[480px]"
    >
      <span aria-hidden="true" className="flex h-14 items-center">
        <span className="size-10 rotate-45 rounded-md border-2 border-dashed border-planned" />
      </span>
      <h1 id="download-offline-title" className="mt-5 text-2xl leading-[30px] font-extrabold">
        {t('The first start needs internet')}
      </h1>
      <p className="mt-3 max-w-[300px] text-[15px] leading-[22px] text-muted-foreground">
        {t(
          'This device has none of your data yet. Connect to a network once, and after that Pampojo works without it.',
        )}
      </p>
      <Button size="md" className="mt-6 w-full" onClick={view.retry}>
        {t('Try again')}
      </Button>
      <p className="mt-3.5 text-sm text-muted-foreground">
        {t('The download starts by itself when the network is back.')}
      </p>
    </section>
  );
}

/** The full-screen first download of a device (boards D16.1–D16.4); no app shell. */
export function DownloadScreen({ view }: { view: ActiveView }) {
  const { t } = useTranslation();
  const offline = view.state === 'offline';
  return (
    <div className="flex min-h-dvh flex-col bg-background p-4 text-foreground lg:px-10 lg:py-6">
      <header className="flex h-10 items-center justify-between lg:h-12">
        <Wordmark />
        {offline ? <StatusPill status="offline" /> : null}
      </header>
      <main className="flex flex-1 flex-col items-center justify-center">
        {offline ? <OfflineCard view={view} /> : <ProgressCard view={view} />}
        {!offline && view.state === 'running' ? (
          <p className="mt-4 px-1 text-center text-sm text-muted-foreground">
            {t('If the connection drops, we continue from the same place.')}
          </p>
        ) : null}
      </main>
    </div>
  );
}
