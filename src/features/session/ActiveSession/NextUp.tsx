'use client';

import { useTranslation } from 'react-i18next';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import type { SessionExercise } from '@/shared/schemas/session';

export function NextUp({
  next,
  target,
  onSelect,
}: {
  next: SessionExercise | null;
  target: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  if (!next) {
    return (
      <p className="border-t border-border pt-3.5 text-muted-foreground lg:hidden">
        {t('Last exercise. When you are done, press "Finish".')}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-16 w-full items-center gap-3 border-t border-border px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <ExerciseImage
        src={next.exercise.thumbnailUrl}
        name={next.exercise.name}
        alt=""
        compact
        className="size-10 shrink-0 rounded-sm opacity-85"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold text-muted-foreground">{t('Next')}</span>
        <span className="truncate font-bold">{next.exercise.name}</span>
      </span>
      <span className="font-semibold text-muted-foreground tabular-nums">{target}</span>
    </button>
  );
}
