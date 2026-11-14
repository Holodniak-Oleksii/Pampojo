'use client';

import { cn } from '@/lib/utils';
import { useFormat } from '@/i18n/client';

const SEGMENTS = 10;
const CENTER = 100;
const RADIUS = 78;
const SEGMENT_WIDTH = 16;
const SEGMENT_LENGTH = 30;

// Blocks sit on a half circle from left (180°) to right (0°), long side along the radius.
const segments = Array.from({ length: SEGMENTS }, (_, index) => {
  const angle = 180 - (index + 0.5) * (180 / SEGMENTS);
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(radians),
    y: CENTER - RADIUS * Math.sin(radians),
    rotation: 90 - angle,
  };
});

export interface SegmentedGaugeProps {
  value: number;
  label: string;
  className?: string;
}

export function SegmentedGauge({ value, label, className }: SegmentedGaugeProps) {
  const format = useFormat();
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const filled = Math.round(clamped / (100 / SEGMENTS));
  const text = format.percent(clamped);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={text}
      className={cn('relative w-full max-w-[240px]', className)}
    >
      <svg viewBox="0 0 200 120" className="w-full" aria-hidden="true">
        {segments.map((segment, index) => (
          <rect
            key={index}
            data-testid="gauge-block"
            data-filled={index < filled ? 'true' : 'false'}
            x={segment.x - SEGMENT_WIDTH / 2}
            y={segment.y - SEGMENT_LENGTH / 2}
            width={SEGMENT_WIDTH}
            height={SEGMENT_LENGTH}
            rx={6}
            transform={`rotate(${segment.rotation} ${segment.x} ${segment.y})`}
            className={index < filled ? 'fill-accent' : 'fill-border'}
          />
        ))}
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 text-center text-3xl font-extrabold tabular-nums"
      >
        {text}
      </span>
    </div>
  );
}
