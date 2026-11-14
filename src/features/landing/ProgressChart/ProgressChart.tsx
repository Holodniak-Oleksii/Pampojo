const POINTS: [number, number][] = [
  [0, 112],
  [50, 104],
  [100, 106],
  [150, 88],
  [200, 92],
  [250, 66],
  [300, 58],
  [350, 44],
  [400, 30],
];

const line = POINTS.map(([x, y]) => `${x},${y}`).join(' ');

export interface ProgressChartProps {
  label: string;
  startLabel: string;
  endLabel: string;
}

/** A static line chart for the landing; the last point is the accent diamond. */
export function ProgressChart({ label, startLabel, endLabel }: ProgressChartProps) {
  return (
    <svg viewBox="0 0 410 140" role="img" aria-label={label} className="h-[150px] w-full">
      <path d="M0 120H400M0 70H400M0 20H400" className="stroke-border" strokeWidth={1} />
      <polyline
        points={line}
        className="fill-none stroke-foreground"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M400 22 408 30 400 38 392 30Z" className="fill-accent" />
      <text x="0" y="136" className="fill-muted-foreground text-xs">
        {startLabel}
      </text>
      <text x="400" y="14" textAnchor="end" className="fill-foreground text-xs font-bold">
        {endLabel}
      </text>
    </svg>
  );
}
