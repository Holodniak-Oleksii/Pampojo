import type { Ref } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedControlProps<V extends string> {
  name: string;
  legend: string;
  /** Keeps the legend for screen readers only. */
  hideLegend?: boolean;
  options: readonly SegmentedControlOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

// Native radios inside labels: arrow keys, form semantics and the accessible name come for free.
export function SegmentedControl<V extends string>({
  name,
  legend,
  hideLegend,
  options,
  value,
  onChange,
  onBlur,
  inputRef,
  invalid,
  describedBy,
  className,
}: SegmentedControlProps<V>) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)} aria-describedby={describedBy}>
      <legend className={cn('mb-2 text-sm font-semibold', hideLegend && 'sr-only')}>
        {legend}
      </legend>
      <div
        className={cn(
          'grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-card p-1 shadow-soft',
          invalid && 'ring-2 ring-destructive',
        )}
      >
        {options.map((option, index) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-base font-semibold transition-colors has-checked:bg-accent-soft has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              ref={index === 0 ? inputRef : undefined}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              onBlur={onBlur}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
