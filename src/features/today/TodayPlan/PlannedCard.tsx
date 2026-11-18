import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { PlayDiamond } from '@/components/PlayDiamond';
import { Button } from '@/components/ui/button';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import type { PlannedWorkout } from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { thumbnailSlots, tilesThatFit } from './thumbnails';

/** As many 52px tiles as fit in one row, with "+N" for the exercises left over. */
export function Thumbnails({
  urls,
  name,
  count,
}: {
  urls: readonly string[];
  name: string;
  count: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(4);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setFit(tilesThatFit(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (urls.length === 0) return null;
  const { shown, more, covers } = thumbnailSlots(urls.length, count, fit);
  const extra = more > 0;
  const covered = covers ? urls[shown] : undefined;

  return (
    <span ref={ref} className="flex gap-1.5 overflow-hidden" data-testid="thumbnails">
      <span aria-hidden="true" className="flex gap-1.5">
        {urls.slice(0, shown).map((url) => (
          <ExerciseImage
            key={url}
            src={url}
            name={name}
            alt=""
            compact
            className="size-[52px] shrink-0 rounded-sm"
          />
        ))}
        {extra ? (
          <span className="relative size-[52px] shrink-0 overflow-hidden rounded-sm bg-muted">
            {covered ? (
              <ExerciseImage
                src={covered}
                name={name}
                alt=""
                compact
                className="size-[52px] rounded-sm"
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center bg-[rgba(30,28,26,0.62)] text-base font-extrabold text-primary-foreground">
              {t('+{{value}}', { value: more })}
            </span>
          </span>
        ) : null}
      </span>
      {extra ? (
        <span className="sr-only">{t('{{count}} more exercises', { count: more })}</span>
      ) : null}
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
      <Thumbnails urls={item.workout?.thumbnailUrls ?? []} name={name} count={count} />
      <Button className="w-full" disabled={starting} onClick={onStart}>
        <PlayDiamond />
        {t('Start')}
      </Button>
    </article>
  );
}
