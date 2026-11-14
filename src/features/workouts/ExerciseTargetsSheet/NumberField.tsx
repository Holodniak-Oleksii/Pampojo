'use client';

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumberFieldProps {
  label: string;
  /** Visually hidden label (the from–to pair shares one legend). */
  hideLabel?: boolean;
  value: number | null;
  min: number;
  max: number;
  /** Allowed step for decimals; integers when omitted. */
  step?: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number | null) => void;
  onValidityChange: (valid: boolean) => void;
}

function parse(text: string, step: number | undefined): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 'invalid';
  if (step === undefined) return Number.isInteger(value) ? value : 'invalid';
  return Number.isInteger(value / step) ? value : 'invalid';
}

/** A numeric input that keeps the typed text and reports a value only when it is valid. */
export function NumberField({
  label,
  hideLabel,
  value,
  min,
  max,
  step,
  hint,
  disabled,
  onChange,
  onValidityChange,
}: NumberFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));
  const [error, setError] = useState(false);

  function change(next: string) {
    setText(next);
    const parsed = parse(next, step);
    const valid = parsed !== 'invalid' && (parsed === null || (parsed >= min && parsed <= max));
    setError(!valid);
    onValidityChange(valid);
    if (valid) onChange(parsed);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn('text-sm font-semibold text-muted-foreground', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <Input
        id={id}
        inputMode={step === undefined ? 'numeric' : 'decimal'}
        value={text}
        disabled={disabled}
        aria-invalid={error || undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        onChange={(event) => change(event.target.value)}
        className="tabular-nums"
      />
      {error ? (
        <p id={`${id}-note`} className="text-sm text-destructive">
          {t('From {{min}} to {{max}}', { min, max })}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
