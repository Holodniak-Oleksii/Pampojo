import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SCHEDULE } from '@/constants/plan';
import { dayMonth, monthTitle, StatusMarker, weekdayShort } from '@/features/plan';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { addDays } from '@/shared/plan/occurrences';
import { dayLabel, monthOf, type DayMarker } from '../utils';

export interface MonthGridProps {
  month: string;
  /** The month's dates, Monday first, in whole weeks. */
  dates: readonly string[];
  today: string;
  selected: string;
  markers: ReadonlyMap<string, DayMarker[]>;
  variant: 'compact' | 'full';
  onSelect: (date: string) => void;
}

const KEY_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function MonthGrid({
  month,
  dates,
  today,
  selected,
  markers,
  variant,
  onSelect,
}: MonthGridProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const gridRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const weeks = useMemo(
    () => Array.from({ length: dates.length / 7 }, (_, i) => dates.slice(i * 7, i * 7 + 7)),
    [dates],
  );
  const full = variant === 'full';

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, month]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const step = KEY_STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    focusPending.current = true;
    onSelect(addDays(date, step));
  }

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={monthTitle(locale, month)}
      className={cn('flex flex-col', full ? 'gap-1.5' : 'gap-0.5')}
    >
      <div role="row" className={cn('grid grid-cols-7', full ? 'gap-1.5' : 'pb-1.5')}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <span
            key={day}
            role="columnheader"
            className={cn(
              'text-[13px] font-semibold text-muted-foreground capitalize',
              full ? 'pl-2 font-bold' : 'text-center',
            )}
          >
            {weekdayShort(locale, day)}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div
          key={week[0]}
          role="row"
          className={cn('grid grid-cols-7', full ? 'h-[88px] gap-1.5' : 'gap-0.5')}
        >
          {week.map((date) => {
            const all = markers.get(date) ?? [];
            const rules = all.filter((marker) => !marker.desktopOnly);
            const outside = monthOf(date) !== month;
            const isToday = date === today;
            const isSelected = date === selected;
            const label = dayMonth(locale, date);
            const common = {
              role: 'gridcell' as const,
              type: 'button' as const,
              'data-date': date,
              'aria-selected': isSelected,
              tabIndex: isSelected ? 0 : -1,
              'aria-label': dayLabel(t, date, label, all, isToday),
              onClick: () => onSelect(date),
              onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, date),
            };
            const day = Number(date.slice(8));
            if (full) {
              return (
                <button
                  key={date}
                  {...common}
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden rounded-sm p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    outside ? 'bg-transparent text-planned' : 'bg-card',
                    isSelected && 'ring-2 ring-foreground ring-inset',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center gap-1.5 tabular-nums',
                      isToday ? 'font-extrabold' : 'font-semibold',
                    )}
                  >
                    {day}
                    {isToday ? (
                      <span className="text-xs font-bold text-muted-foreground">{t('today')}</span>
                    ) : null}
                  </span>
                  {all.map((marker) => (
                    <span
                      key={marker.key}
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 text-[13px] font-semibold',
                        marker.status === 'missed' && 'text-destructive-text',
                        marker.status === 'planned' && 'text-muted-foreground',
                      )}
                    >
                      <StatusMarker status={marker.status} size="md" />
                      <span
                        className={marker.desktopOnly ? 'line-clamp-2 leading-tight' : 'truncate'}
                      >
                        {marker.name}
                      </span>
                    </span>
                  ))}
                </button>
              );
            }
            const shown = rules.slice(0, SCHEDULE.markersMax);
            return (
              <button
                key={date}
                {...common}
                className={cn(
                  'relative flex h-12 min-w-0 flex-col items-center rounded-sm pt-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  outside && 'text-planned',
                  isSelected && 'bg-card ring-1 ring-border-strong ring-inset',
                )}
              >
                <span
                  className={cn(
                    'text-[15px] leading-tight tabular-nums',
                    isToday ? 'font-extrabold' : 'font-semibold',
                  )}
                >
                  {day}
                </span>
                {isToday ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-[25px] h-0.5 w-3.5 rounded-full bg-foreground"
                  />
                ) : null}
                <span aria-hidden="true" className="mt-2 flex items-center gap-1">
                  {shown.map((marker) => (
                    <StatusMarker key={marker.key} status={marker.status} />
                  ))}
                  {rules.length > shown.length ? (
                    <span className="text-xs leading-none text-muted-foreground">
                      +{rules.length - shown.length}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
