'use client';

import { useTranslation } from 'react-i18next';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { useLocale } from '@/i18n/client';
import type { LastPerformance, SessionExercise } from '@/shared/schemas/session';
import { distanceInKm } from '../utils';
import { formatField } from './fields';

export function useSetText() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    entry: SessionExercise,
    set: {
      weightKg: number | null;
      reps: number | null;
      durationSec: number | null;
      distanceM: number | null;
    },
  ) => {
    const km = distanceInKm(entry);
    if (set.durationSec !== null) return t('{{value}} s', { value: set.durationSec });
    if (set.distanceM !== null) {
      const value = formatField('distanceM', set.distanceM, km, locale);
      return km ? t('{{value}} km', { value }) : t('{{value}} m', { value });
    }
    if (set.weightKg !== null && set.reps !== null) {
      return t('{{weight}} kg × {{reps}}', {
        weight: formatField('weightKg', set.weightKg, false, locale),
        reps: set.reps,
      });
    }
    return set.reps === null ? '' : t('× {{reps}}', { reps: set.reps });
  };
}

export function ExerciseHeader({
  entry,
  last,
}: {
  entry: SessionExercise;
  last: LastPerformance | null | undefined;
}) {
  const { t } = useTranslation();
  const setText = useSetText();
  const first = last?.sets[0];
  const lastText = first ? setText(entry, first) : '';
  return (
    <div className="flex items-start gap-3.5 lg:items-center lg:gap-[18px]">
      <ExerciseImage
        src={entry.exercise.thumbnailUrl}
        name={entry.exercise.name}
        alt=""
        compact
        className="size-16 shrink-0 rounded-sm lg:size-20"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-2xl leading-tight font-extrabold lg:text-4xl">{entry.exercise.name}</h1>
        {entry.exercise.laterality === 'unilateral' ? (
          <span className="text-sm text-muted-foreground">{t('per side')}</span>
        ) : null}
        {lastText ? (
          <span className="text-[15px] font-semibold text-muted-foreground tabular-nums">
            {t('Last time: {{value}}', { value: lastText })}
          </span>
        ) : entry.notes ? (
          <span className="text-sm text-muted-foreground">{entry.notes}</span>
        ) : null}
      </div>
    </div>
  );
}
