import { Play } from 'lucide-react';

/** The Play mark in the brand diamond, for buttons that start a workout. */
export function PlayDiamond() {
  return (
    <span
      aria-hidden="true"
      className="flex size-[18px] shrink-0 rotate-45 items-center justify-center rounded-[3px] bg-accent"
    >
      <Play className="size-2.5 -rotate-45 fill-foreground text-foreground" />
    </span>
  );
}
