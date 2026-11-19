'use client';

import { Calendar } from 'lucide-react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useLocale } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/** "18 листопада 2026" / "November 18, 2026", without the "р." suffix of the uk long date. */
export function longDate(locale: Locale, date: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return locale === 'uk'
    ? `${part('day')} ${part('month')} ${part('year')}`
    : `${part('month')} ${part('day')}, ${part('year')}`;
}

/**
 * The native date input sits invisible over the formatted text, so the value reads in the app
 * language while the browser still gives its own date picker.
 */
export function DateField({
  id,
  value,
  max,
  error,
  registration,
}: {
  id: string;
  value: string;
  max: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        'relative flex h-13 items-center rounded-sm border-2 border-transparent bg-background px-3.5 has-[input:focus-visible]:border-foreground',
        error && 'border-destructive',
      )}
    >
      <span aria-hidden="true" className="flex-1 truncate text-base font-semibold">
        {value ? longDate(locale, value) : '—'}
      </span>
      <Calendar aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <input
        id={id}
        type="date"
        max={max}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.();
          } catch {
            // Some frames do not allow the picker; the field still takes typed input.
          }
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </span>
  );
}
