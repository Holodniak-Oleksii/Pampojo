import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { PlayDiamond } from '@/components/PlayDiamond';
import { buttonVariants } from '@/components/ui/button';
import { nextDateLabel, type TodayPlan } from '@/features/plan';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { isoWeekday } from '@/shared/plan/occurrences';
import { Thumbnails } from './PlannedCard';

export interface NextWorkoutCardProps {
  next: NonNullable<TodayPlan['next']>;
  /** Nothing is planned for today: the card leads with that and points to the calendar. */
  todayFree: boolean;
}

export function NextWorkoutCard({ next, todayFree }: NextWorkoutCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const name = next.rule.workout.name;
  // The play mark is drawn as the brand diamond; the ▶ stays in the copy for screen readers.
  const [before = '', after = ''] = t('Want to train now? Tap ▶ and choose a workout.').split('▶');
  const details = (
    <div
      className={cn(
        'flex flex-col gap-2.5',
        todayFree ? 'rounded-md bg-background p-3.5' : 'rounded-lg bg-card p-4',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Diamond tone="planned" variant="outline" className="border-[1.5px]" />
        {t('Next workout')}
      </span>
      <div>
        <h2 className="text-[28px] leading-tight font-extrabold">{name}</h2>
        <p className="mt-0.5 font-semibold">
          {nextDateLabel(t, locale, next.date, isoWeekday(next.date))}
        </p>
      </div>
      <Thumbnails
        urls={next.workout?.thumbnailUrls ?? []}
        name={name}
        count={next.workout?.exerciseCount ?? next.rule.workout.exerciseCount}
      />
    </div>
  );
  if (!todayFree) {
    return <article>{details}</article>;
  }
  return (
    <article className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h1 className="text-[17px] font-extrabold">{t('Nothing planned for today')}</h1>
      {details}
      <p className="text-muted-foreground">
        {before}
        <span className="inline-flex translate-y-[3px] px-0.5" aria-hidden="true">
          <PlayDiamond />
        </span>
        <span className="sr-only">▶</span>
        {after}
      </p>
      <Link href="/calendar" className={cn(buttonVariants({ variant: 'secondary' }), 'w-full')}>
        {t('Open calendar')}
      </Link>
    </article>
  );
}
