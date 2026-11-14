import type { MuscleFamily } from '@/constants/exercise';
import { cn } from '@/lib/utils';

const TONE = {
  accent: { fill: 'bg-accent', outline: 'border-accent' },
  foreground: { fill: 'bg-foreground', outline: 'border-foreground' },
  planned: { fill: 'bg-planned', outline: 'border-planned' },
  success: { fill: 'bg-success', outline: 'border-success' },
  destructive: { fill: 'bg-destructive', outline: 'border-destructive' },
} as const;

// Static class names, so Tailwind sees every muscle colour it has to generate.
const MUSCLE: Record<MuscleFamily, string> = {
  chest: 'bg-muscle-chest',
  shoulders: 'bg-muscle-shoulders',
  back: 'bg-muscle-back',
  arms: 'bg-muscle-arms',
  legs: 'bg-muscle-legs',
  core: 'bg-muscle-core',
};

const SIZE = { sm: 'size-[7px]', md: 'size-2.5' } as const;

export type DiamondProps = {
  size?: keyof typeof SIZE;
  className?: string;
} & (
  | { tone: keyof typeof TONE; variant?: 'fill' | 'outline'; family?: never }
  | { tone: 'muscle'; family: MuscleFamily; variant?: never }
);

/** The brand marker: a small rotated square used for statuses, days and muscle families. */
export function Diamond({ tone, variant = 'fill', family, size = 'sm', className }: DiamondProps) {
  let colour: string;
  if (tone === 'muscle') colour = MUSCLE[family];
  else colour = variant === 'outline' ? cn('border-2', TONE[tone].outline) : TONE[tone].fill;
  return (
    <span
      aria-hidden="true"
      data-family={family}
      data-variant={tone === 'muscle' ? undefined : variant}
      className={cn(
        'inline-block shrink-0 rotate-45 rounded-[2px] box-border',
        SIZE[size],
        colour,
        className,
      )}
    />
  );
}
