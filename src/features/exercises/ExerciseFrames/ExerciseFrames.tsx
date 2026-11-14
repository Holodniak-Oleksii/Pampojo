'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/shared/schemas/exercise';
import { FRAME_INTERVAL_MS } from '../constants';
import { ExerciseImage } from '../ExerciseImage';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface ExerciseFramesProps {
  name: string;
  frames: Exercise['frames'];
}

const FRAME_CLASS = 'aspect-[4/3] w-full rounded-lg';

/** Frames cycle in order like a slow animation; with reduced motion a tap shows the next one. */
export function ExerciseFrames({ name, frames }: ExerciseFramesProps) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const animated = frames.length > 1 && !reducedMotion;

  useEffect(() => {
    if (!animated) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % frames.length),
      FRAME_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [animated, frames.length]);

  if (frames.length === 0) return <ExerciseImage src={null} name={name} className={FRAME_CLASS} />;

  const current = index % frames.length;
  // Two frames are the catalog's start and end positions; three or four are numbered.
  const label = (frameIndex: number) =>
    frames.length === 1
      ? name
      : frames.length === 2
        ? `${name}, ${frameIndex === 0 ? t('Start position') : t('End position')}`
        : t('{{name}}, frame {{n}} of {{total}}', {
            name,
            n: frameIndex + 1,
            total: frames.length,
          });
  const stack = (
    <div className={cn('relative', FRAME_CLASS)}>
      {frames.map((frame, frameIndex) => (
        // Every frame stays rendered so the switch does not flash while an image loads.
        <ExerciseImage
          key={frame.fullUrl}
          src={frame.fullUrl}
          sizes="(min-width: 1024px) 456px, 100vw"
          name={name}
          alt={frameIndex === current ? label(frameIndex) : ''}
          className={cn(
            'absolute inset-0 rounded-lg transition-opacity duration-300 motion-reduce:transition-none',
            frameIndex === current ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </div>
  );

  if (frames.length > 1 && reducedMotion) {
    return (
      <button
        type="button"
        aria-label={t('Switch position')}
        aria-pressed={frames.length === 2 ? current === 1 : undefined}
        onClick={() => setIndex((value) => (value + 1) % frames.length)}
        className="block w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {stack}
      </button>
    );
  }
  return <figure>{stack}</figure>;
}
