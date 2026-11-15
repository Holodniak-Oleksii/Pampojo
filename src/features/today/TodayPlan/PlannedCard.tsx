import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { PlayDiamond } from '@/components/PlayDiamond';
import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import type { PlannedWorkout } from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';

export function Thumbnails({ urls, name }: { urls: readonly string[]; name: string }) {
  if (urls.length === 0) return null;
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {urls.slice(0, 4).map((url) => (
        <ExerciseImage key={url} src={url} name={name} alt="" compact className="size-[52px] rounded-sm" />
      ))}
    </span>
  );
}

export interface PlannedCardProps {
  item: PlannedWorkout;
  starting: boolean;
  onStart: () => void;
}

export function PlannedCard({ item, starting, onStart }: PlannedCardProps) {
  const { t } = useTranslation();
  const name = item.rule.workout.name;
  const count = item.workout?.exerciseCount ?? item.rule.workout.exerciseCount;
  if (item.done) {
    return (
      <article className="flex flex-col gap-2.5 rounded-lg bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] leading-tight font-extrabold">{name}</h2>
            <p className="mt-0.5 text-muted-foreground">{t('{{count}} exercises', { count })}</p>
          </div>
          <span className="flex h-8 items-center gap-2 rounded-md bg-background px-2.5 text-sm font-bold">
            <Diamond tone="accent" className="size-[9px]" />
            {t('Done', { context: 'plan' })}
          </span>
        </div>
        <Link
          href={sessionHref(item.done.id)}
          className="flex min-h-11 items-center gap-1 self-start font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('View summary')}
          <ChevronRight aria-hidden="true" className="size-[18px]" />
        </Link>
      </article>
    );
  }
  return (
    <article className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div>
        <h2 className="text-[28px] leading-tight font-extrabold">{name}</h2>
        <p className="mt-0.5 text-muted-foreground">{t('{{count}} exercises', { count })}</p>
      </div>
      <Thumbnails urls={item.workout?.thumbnailUrls ?? []} name={name} />
      <Button className="w-full" disabled={starting} onClick={onStart}>
        <PlayDiamond />
        {t('Start')}
      </Button>
    </article>
  );
}
