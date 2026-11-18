'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { nextDateLabel, usePlanTimeZone } from '@/features/plan';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useLocale } from '@/i18n/client';
import { todayIn } from '@/lib/dates';
import { isoWeekday } from '@/shared/plan/occurrences';
import type { ProgressExerciseItem } from '@/shared/schemas/progress';

function useLastTrained() {
  const { t } = useTranslation();
  const locale = useLocale();
  const timeZone = usePlanTimeZone();
  return (iso: string) => {
    const date = todayIn(timeZone, new Date(iso));
    return t('Last trained {{date}}', { date: nextDateLabel(t, locale, date, isoWeekday(date)) });
  };
}

function Thumbnail({ item }: { item: ProgressExerciseItem }) {
  return (
    <ExerciseImage
      src={item.thumbnailUrl}
      name={item.name}
      alt=""
      compact
      className="size-12 shrink-0 rounded-[3px] object-cover"
    />
  );
}

export function ExerciseSelector({
  items,
  selected,
  onSelect,
}: {
  items: readonly ProgressExerciseItem[];
  selected: ProgressExerciseItem;
  onSelect: (exerciseId: string) => void;
}) {
  const { t } = useTranslation();
  const lastTrained = useLastTrained();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-lg bg-card p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Thumbnail item={selected} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold">{selected.name}</span>
          <span className="truncate text-sm text-muted-foreground">
            {lastTrained(selected.lastTrainedAt)}
          </span>
        </span>
        <span className="text-sm font-semibold text-muted-foreground">{t('Change')}</span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </button>
      <ExercisePickerSheet
        open={open}
        onOpenChange={setOpen}
        items={items}
        selectedId={selected.exerciseId}
        onSelect={(id) => {
          onSelect(id);
          setOpen(false);
        }}
      />
    </>
  );
}

function ExercisePickerSheet({
  open,
  onOpenChange,
  items,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly ProgressExerciseItem[];
  selectedId: string;
  onSelect: (exerciseId: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const desktop = useIsDesktop();
  const lastTrained = useLastTrained();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return needle === ''
      ? items
      : items.filter((item) => item.name.toLocaleLowerCase(locale).includes(needle));
  }, [items, query, locale]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="max-h-dvh overflow-y-auto rounded-t-xl bg-background pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none data-[side=right]:w-full data-[side=right]:rounded-none data-[side=right]:sm:max-w-[480px]"
      >
        <SheetHeader className="px-4 pt-6 lg:px-6">
          <SheetTitle className="text-2xl font-extrabold">{t('Exercise')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 lg:px-6">
          <label className="flex flex-col">
            <span className="sr-only">{t('Search exercise')}</span>
            <Input
              type="search"
              value={query}
              placeholder={t('Search exercise')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {matches.length === 0 ? (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">
              {t('Nothing found')}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg bg-card">
              {matches.map((item) => {
                const current = item.exerciseId === selectedId;
                return (
                  <li key={item.exerciseId}>
                    <button
                      type="button"
                      aria-pressed={current}
                      onClick={() => onSelect(item.exerciseId)}
                      className="flex min-h-16 w-full items-center gap-3 py-2.5 pr-3 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Thumbnail item={item} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-base font-bold">{item.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {lastTrained(item.lastTrainedAt)}
                        </span>
                      </span>
                      {current ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
