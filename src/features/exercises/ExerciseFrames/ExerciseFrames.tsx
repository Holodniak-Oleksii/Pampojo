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

const FRAME_CLASS = 'aspect-[4/3] w-full rounded-[20px]';

/** Start and end positions alternate like a slow animation; with reduced motion a tap switches them. */
export function ExerciseFrames({ name, frames }: ExerciseFramesProps) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const animated = frames.length > 1 && !reducedMotion;

  useEffect(() => {
    if (!animated) return;
    const timer = setInterval(
      () => setIndex((current) => (current === 0 ? 1 : 0)),
      FRAME_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [animated]);

  if (frames.length === 0) return <ExerciseImage src={null} name={name} className={FRAME_CLASS} />;

  const positions = [t('Start position'), t('End position')];
  const current = frames.length > 1 ? index : 0;
  const stack = (
    <div className={cn('relative', FRAME_CLASS)}>
      {frames.slice(0, 2).map((frame, frameIndex) => (
        // Both frames stay rendered so the switch does not flash while an image loads.
        <ExerciseImage
          key={frame.fullUrl}
          src={frame.fullUrl}
          sizes="(min-width: 1024px) 456px, 100vw"
          name={name}
          alt={frameIndex === current ? `${name}, ${positions[frameIndex] ?? ''}` : ''}
          className={cn(
            'absolute inset-0 rounded-[20px] transition-opacity duration-300 motion-reduce:transition-none',
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
        aria-pressed={current === 1}
        onClick={() => setIndex((value) => (value === 0 ? 1 : 0))}
        className="block w-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {stack}
      </button>
    );
  }
  return <figure>{stack}</figure>;
}
