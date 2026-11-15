import { cn } from '@/lib/utils';

export interface RestRingProps {
  /** Outer size in px. */
  size: number;
  strokeWidth: number;
  /** Share of the rest still left, 1 → 0. */
  progress: number;
  /** The rest is over: the ring fills and the diamond turns dark. */
  over?: boolean;
  /** Hide the centre diamond, for rings that hold text. */
  plain?: boolean;
  trackClassName?: string;
  className?: string;
}

/** The rest timer ring: drains linearly in the accent, with no animation between ticks. */
export function RestRing({
  size,
  strokeWidth,
  progress,
  over = false,
  plain = false,
  trackClassName = 'stroke-border',
  className,
}: RestRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  const diamond = Math.round(size * 0.18);
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
    >
      {over ? (
        <circle cx={centre} cy={centre} r={radius + strokeWidth / 2} className="fill-accent" />
      ) : (
        <>
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={trackClassName}
          />
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
            transform={`rotate(-90 ${centre} ${centre})`}
            className="stroke-accent"
          />
        </>
      )}
      {plain ? null : (
        <rect
          x={centre - diamond / 2}
          y={centre - diamond / 2}
          width={diamond}
          height={diamond}
          rx={2}
          transform={`rotate(45 ${centre} ${centre})`}
          className={over ? 'fill-accent-foreground' : 'fill-accent'}
        />
      )}
    </svg>
  );
}
