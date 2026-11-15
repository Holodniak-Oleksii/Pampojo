'use client';

import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SessionExercise, SetLog } from '@/shared/schemas/session';
import { isEntryDone, loggedCount } from '../utils';

export interface ExerciseStripProps {
  exercises: SessionExercise[];
  setLogs: readonly SetLog[];
  currentId: string | null;
  onOpen: () => void;
}

/** One diamond per exercise and "Вправа N з M"; opens the exercise list. */
export function ExerciseStrip({ exercises, setLogs, currentId, onOpen }: ExerciseStripProps) {
  const { t } = useTranslation();
  const index =
    Math.max(
      0,
      exercises.findIndex((item) => item.id === currentId),
    ) + 1;
  return (
    <button
      type="button"
      aria-label={t('All exercises, exercise {{n}} of {{total}}', {
        n: index,
        total: exercises.length,
      })}
      onClick={onOpen}
      className="mx-4 flex h-12 w-[calc(100%-2rem)] items-center gap-3.5 rounded-md border border-border pr-3 pl-3.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <span aria-hidden="true" className="flex max-w-[55%] items-center gap-2.5 overflow-hidden">
        {exercises.map((entry) => {
          const current = entry.id === currentId;
          const done = isEntryDone(entry, setLogs);
          const started = loggedCount(entry, setLogs) > 0;
          return (
            <span
              key={entry.id}
              className={cn(
                'size-2.5 shrink-0 rotate-45 rounded-[2px] box-border',
                current
                  ? cn(
                      'border-2 border-foreground',
                      started && 'bg-[linear-gradient(135deg,var(--accent)_50%,transparent_50%)]',
                    )
                  : done
                    ? 'bg-accent'
                    : 'border-[1.5px] border-planned',
              )}
            />
          );
        })}
      </span>
      <span className="flex-1 text-left text-muted-foreground">
        {t('Exercise {{n}} of {{total}}', { n: index, total: exercises.length })}
      </span>
      <Menu aria-hidden="true" className="size-[18px] text-muted-foreground" />
    </button>
  );
}
