'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import type { ExerciseListItem as Item } from '@/shared/schemas/exercise';
import { FRAME_INTERVAL_MS } from '../constants';
import { ExerciseImage } from '../ExerciseImage';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useExerciseLabels } from '../hooks/useExerciseLabels';

export interface ExerciseListItemProps {
  item: Item;
}

/** A compact row on mobile, a card with the photo on top in the desktop grid. */
export function ExerciseListItem({ item }: ExerciseListItemProps) {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const animated = active && !reducedMotion && item.frames.length > 1;

  // Hover or keyboard focus plays the same start/end alternation as the details page.
  useEffect(() => {
    if (!animated) return;
    const timer = setInterval(
      () => setFrameIndex((current) => (current + 1) % item.frames.length),
      FRAME_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [animated, item.frames.length]);

  function start() {
    setActive(true);
    // Warm the cache for the other frames so the first switch does not flash.
    for (const frame of item.frames.slice(1)) {
      const image = new window.Image();
      image.src = frame.fullUrl;
    }
  }

  function stop() {
    setActive(false);
    setFrameIndex(0);
  }

  const muscles = item.primaryMuscles.map((muscle) => labels.muscle[muscle]).join(', ');
  const frame = item.frames[frameIndex];
  const thumb = frame?.thumbUrl ?? item.thumbnailUrl;
  const full = frame?.fullUrl ?? item.imageUrl;
  const srcSet = [thumb && `${thumb} 160w`, full && `${full} 800w`].filter(Boolean).join(', ');

  return (
    <Link
      href={`/library/exercises/${item.id}`}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className="flex min-h-14 items-center gap-3 px-3 py-2.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:h-full lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:bg-card lg:p-0 lg:ring-1 lg:ring-border lg:ring-inset"
    >
      <ExerciseImage
        src={thumb ?? full}
        srcSet={srcSet || undefined}
        sizes="(min-width: 1024px) 320px, 56px"
        name={item.name}
        alt=""
        compact
        className="size-14 shrink-0 rounded-sm lg:aspect-[4/3] lg:size-auto lg:w-full lg:rounded-none"
      />
      <span className="flex min-w-0 flex-col gap-0.5 lg:gap-1 lg:p-4">
        <span className="flex items-start gap-2">
          <span className="line-clamp-2 font-semibold">{item.name}</span>
          {item.isOwn ? (
            <span className="shrink-0 rounded-md bg-background px-2 text-xs leading-5 font-semibold text-foreground ring-1 ring-border ring-inset">
              {t('Mine', { context: 'badge' })}
            </span>
          ) : null}
        </span>
        <span className="truncate text-sm text-muted-foreground">{muscles}</span>
        <span className="flex flex-wrap gap-1">
          {item.equipment.map((equipment) => (
            <span key={equipment} className="rounded-md bg-background px-2 text-sm">
              {labels.equipment[equipment]}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
