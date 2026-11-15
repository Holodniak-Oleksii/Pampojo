'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkoutsQuery, workoutKeys } from '@/api/workouts';
import { EmptyState } from '@/components/EmptyState';
import { PlayDiamond } from '@/components/PlayDiamond';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { ForgottenSessionDialog } from '@/features/session/ForgottenSessionDialog';
import { useInProgress } from '@/features/session/hooks/useInProgress';
import { useNow } from '@/features/session/hooks/useNow';
import { sessionHref, useStartSession } from '@/features/session/hooks/useStartSession';
import { forgottenFinishedAt, isForgotten, loggedCount } from '@/features/session/utils';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';
import { useSessionRepository, type InProgressSummary } from '@/services/local-db';

export interface StartWorkoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

function WorkoutChoices({ onStarted }: { onStarted: () => void }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  const query = useWorkoutsQuery();
  const { start, pending } = useStartSession();

  if (query.isPending) {
    return (
      <ul aria-busy="true" className="divide-y divide-border rounded-lg bg-card">
        {[0, 1, 2].map((key) => (
          <li key={key} className="flex min-h-[72px] items-center gap-3 px-2.5">
            <span className="size-[52px] rounded-sm bg-background" />
            <span className="h-4 w-1/2 rounded-md bg-background" />
          </li>
        ))}
      </ul>
    );
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={t('No workouts yet')}
        description={t('Create a workout to start a session.')}
        action={
          <Button asChild>
            <Link href="/library/workouts" onClick={onStarted}>
              {t('Create workout')}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg bg-card">
      {items.map((item) => {
        const empty = item.exerciseCount === 0;
        const uncached = !online && !queryClient.getQueryData(workoutKeys.detail(item.id));
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={empty || uncached || pending}
              onClick={async () => {
                if (await start(item.id)) onStarted();
              }}
              className="flex min-h-[72px] w-full items-center gap-3 py-2.5 pr-3 pl-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:text-muted-foreground"
            >
              {empty ? (
                <span
                  aria-hidden="true"
                  className="size-[52px] shrink-0 rounded-sm border-[1.5px] border-dashed border-planned"
                />
              ) : (
                <ExerciseImage
                  src={item.thumbnailUrls[0] ?? null}
                  name={item.name}
                  alt=""
                  compact
                  className="size-[52px] shrink-0 rounded-sm"
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-bold">{item.name}</span>
                <span className="text-muted-foreground">
                  {empty
                    ? t('0 exercises. Add exercises to start.')
                    : uncached
                      ? t('Needs internet')
                      : t('{{count}} exercises', { count: item.exerciseCount })}
                </span>
              </span>
              {empty || uncached ? null : (
                <span aria-hidden="true" className="flex size-10 items-center justify-center">
                  <span className="scale-[1.45]">
                    <PlayDiamond />
                  </span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ContinueSession({
  inProgress,
  onClose,
}: {
  inProgress: InProgressSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const now = useNow(30_000);
  const userId = useCurrentUserId();
  const repository = useSessionRepository(userId);
  const { session, setLogs } = inProgress;
  const name = session.workoutSnapshot.name;
  const total = session.exercises.reduce((sum, item) => sum + item.plannedSets, 0);
  const done = session.exercises.reduce((sum, item) => sum + loggedCount(item, setLogs), 0);
  const minutes = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 60_000));
  const first = session.exercises[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 rounded-lg bg-card p-3.5">
        <ExerciseImage
          src={first?.exercise.thumbnailUrl ?? null}
          name={name}
          alt=""
          compact
          className="size-[52px] shrink-0 rounded-sm"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold">{name}</span>
          <span className="text-muted-foreground tabular-nums">
            {t('{{min}} min in. {{done}} of {{total}} sets', {
              min: minutes,
              done,
              total,
              count: total,
            })}
          </span>
        </span>
      </div>
      <Link
        href={sessionHref(session.id)}
        onClick={onClose}
        className={cn(buttonVariants({ size: 'md' }), 'w-full')}
      >
        {t('Continue {{name}}', { name })}
      </Link>
      <p className="text-sm text-muted-foreground">
        {t('To start another workout, finish or discard this one first.')}
      </p>
      <ForgottenSessionDialog
        open={isForgotten(session, now)}
        name={name}
        startedAt={session.startedAt}
        sets={setLogs.length}
        onFinish={() =>
          void repository.finish(session.id, forgottenFinishedAt(session.startedAt, setLogs))
        }
        onDiscard={async () => {
          await repository.abandon(session.id);
          onClose();
          router.push('/today');
        }}
      />
    </div>
  );
}

export function StartWorkoutSheet({ open, onOpenChange, returnFocusRef }: StartWorkoutSheetProps) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const inProgress = useInProgress();

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
        className="max-h-dvh overflow-y-auto rounded-t-xl bg-background pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-6 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">
            {inProgress ? t('Workout in progress') : t('Choose workout')}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 lg:px-6">
          {open && inProgress === undefined ? null : open && inProgress ? (
            <ContinueSession inProgress={inProgress} onClose={() => onOpenChange(false)} />
          ) : open ? (
            <WorkoutChoices onStarted={() => onOpenChange(false)} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
