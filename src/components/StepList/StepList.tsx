import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  label: string;
  done?: boolean;
}

export interface StepListProps {
  steps: readonly Step[];
  /** Screen-reader prefix for a finished step, e.g. "Done: ". */
  doneLabel: string;
  className?: string;
}

/** Numbered diamond steps; done steps show an accent check, the first open step leads in accent when none is done. */
export function StepList({ steps, doneLabel, className }: StepListProps) {
  const anyDone = steps.some((step) => step.done);
  return (
    <ol className={cn('border-t border-border', className)}>
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={cn(
            'flex min-h-14 items-center gap-4 border-b border-border text-[15px]',
            step.done ? 'text-muted-foreground' : 'font-semibold',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'ml-1 flex size-[22px] shrink-0 rotate-45 items-center justify-center rounded-[4px]',
              step.done || (!anyDone && index === 0)
                ? 'bg-accent text-foreground'
                : 'bg-foreground text-card',
            )}
          >
            {step.done ? (
              <Check className="size-3.5 -rotate-45" strokeWidth={3} />
            ) : (
              <span className="-rotate-45 text-xs font-extrabold">{index + 1}</span>
            )}
          </span>
          <span>
            {step.done ? <span className="sr-only">{doneLabel}</span> : null}
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
