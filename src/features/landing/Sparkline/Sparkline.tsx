export function Sparkline() {
  return (
    <svg viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true" className="h-12 w-full">
      <polyline
        points="4,14 30,18 56,16 82,24 108,22 134,30 160,32 196,38"
        className="fill-none stroke-accent"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
