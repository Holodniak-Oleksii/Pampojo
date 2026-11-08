const POINTS: [number, number][] = [
  [10, 110],
  [50, 98],
  [90, 102],
  [130, 80],
  [170, 86],
  [210, 60],
  [250, 48],
  [300, 40],
];

const line = POINTS.map(([x, y]) => `${x},${y}`).join(' ');
const area = `M10,130 L${POINTS.map(([x, y]) => `${x},${y}`).join(' L')} L300,130 Z`;

export function ProgressChart({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 320 140" role="img" aria-label={label} className="w-full">
      <path d={area} className="fill-accent-soft opacity-60" />
      <polyline
        points={line}
        className="fill-none stroke-accent"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {POINTS.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={4} className="fill-accent" />
      ))}
    </svg>
  );
}
