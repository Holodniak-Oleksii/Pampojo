import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { StatusMarker, statusLabel, windowEndLabel } from '@/features/plan';
import { useLocale } from '@/i18n/client';
import type { CalendarOccurrence } from '@/shared/plan/statuses';

export interface MissedRowProps {
  occurrence: CalendarOccurrence;
  thumbnailUrl: string | null;
  today: string;
  starting: boolean;
  onMakeUp: () => void;
}

/** A missed workout; while its late window is open it can be made up from here. */
export function MissedRow({ occurrence, thumbnailUrl, today, starting, onMakeUp }: MissedRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const end = occurrence.lateWindowEnd;
  const open = end !== null && end >= today;
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-card p-3">
      <div className="flex items-center gap-3">
        <ExerciseImage
          src={thumbnailUrl}
          name={occurrence.workoutName}
          alt=""
          compact
          className="size-12 shrink-0 rounded-sm"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold">{occurrence.workoutName}</span>
          <span className="inline-flex items-center gap-[7px] text-sm font-semibold text-destructive-text">
            <StatusMarker status="missed" />
            {statusLabel(t, 'missed')}
          </span>
        </span>
      </div>
      {open ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t('You can make it up until {{date}}.', { date: windowEndLabel(t, locale, end) })}
          </p>
          <Button className="w-full" disabled={starting} onClick={onMakeUp}>
            {t('Make up')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
