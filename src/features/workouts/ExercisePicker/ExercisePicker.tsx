'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EXERCISE_SEARCH_MAX } from '@/constants/exercise';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { cn } from '@/lib/utils';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { FilterSheet } from '@/features/exercises/FilterSheet';
import type { ExerciseListItem } from '@/shared/schemas/exercise';
import { CatalogScopeChips } from '../CatalogScopeChips';
import { CatalogSectionHeading } from '../CatalogSectionHeading';
import { useExerciseLine } from '../hooks/useExerciseLine';
import { usePickerCatalog } from '../hooks/usePickerCatalog';
import { useLocalCatalog } from '@/api/exercises';
import { OfflineCatalogHint, OfflineSearchEmpty } from '@/features/exercises/OfflineCatalog';

export interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many more exercises fit in the workout. */
  room: number;
  onAdd: (items: ExerciseListItem[]) => void;
  /** Extra classes for the sheet, such as the session theme. */
  className?: string;
}

export function ExercisePicker({
  open,
  onOpenChange,
  room,
  onAdd,
  className,
}: ExercisePickerProps) {
  const { t } = useTranslation();
  const viewport = useVisualViewport();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // The keyboard shrinks only the visual viewport, so the sheet follows the visible part.
        style={
          viewport
            ? { height: viewport.height, top: viewport.offsetTop, bottom: 'auto' }
            : undefined
        }
        side="bottom"
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className={cn(
          'h-dvh max-h-dvh gap-0 rounded-none bg-background motion-reduce:animate-none',
          className,
        )}
      >
        {open ? <PickerBody room={room} onAdd={onAdd} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function PickerBody({ room, onAdd }: Pick<ExercisePickerProps, 'room' | 'onAdd'>) {
  const { t } = useTranslation();
  const { sentinel, ...catalog } = usePickerCatalog();
  const line = useExerciseLine();
  const localCatalog = useLocalCatalog();
  const [picked, setPicked] = useState<ExerciseListItem[]>([]);

  function toggle(item: ExerciseListItem) {
    setPicked((current) =>
      current.some((pick) => pick.id === item.id)
        ? current.filter((pick) => pick.id !== item.id)
        : [...current, item],
    );
  }

  const full = picked.length >= room;

  function blurSearch() {
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
  }

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-1">
        <SheetTitle className="text-[22px] font-extrabold">{t('Add exercises')}</SheetTitle>
      </SheetHeader>
      <div className="flex gap-2 px-4 pt-2 pb-3">
        <Input
          type="search"
          value={catalog.search}
          maxLength={EXERCISE_SEARCH_MAX}
          placeholder={localCatalog ? t('Search saved exercises') : t('Search exercises')}
          aria-label={t('Search exercises')}
          className="min-w-0 flex-1 [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => catalog.setSearch(event.target.value)}
        />
        <FilterSheet
          muscles={catalog.filters.muscles}
          equipment={catalog.filters.equipment}
          activeCount={catalog.activeCount}
          scopeChips={<CatalogScopeChips catalog={catalog} />}
          onToggleMuscle={catalog.toggleMuscle}
          onEquipmentChange={catalog.setEquipment}
          onClear={catalog.resetFilters}
        />
      </div>
      <div
        // iOS keeps the keyboard over the list and does not scroll it, so a drag closes the keyboard.
        onTouchMove={blurSearch}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pb-28"
      >
        {localCatalog ? <OfflineCatalogHint className="mb-1" /> : null}
        {localCatalog &&
        catalog.query.data &&
        catalog.sections.every((group) => group.items.length === 0) &&
        catalog.filters.q !== '' ? (
          <OfflineSearchEmpty onClear={() => catalog.setSearch('')} />
        ) : null}
        {!localCatalog && catalog.query.fetchStatus === 'paused' && !catalog.query.data ? (
          <OfflineNotice>
            {t("You're offline. Connect to the internet to load exercises.")}
          </OfflineNotice>
        ) : null}
        {catalog.sections.map((group) => (
          <div key={group.key} className="flex flex-col gap-2.5">
            {group.section ? <CatalogSectionHeading section={group.section} /> : null}
            <ul className="divide-y divide-border rounded-lg bg-card">
              {group.items.map((item) => {
                const order = picked.findIndex((pick) => pick.id === item.id);
                const selected = order >= 0;
                return (
                  <li key={item.id} className="flex min-h-[72px] items-center">
                    <Link
                      href={`/library/exercises/${item.id}`}
                      aria-label={t('How to do {{name}}', { name: item.name })}
                      className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pl-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <ExerciseImage
                        src={item.thumbnailUrl}
                        name={item.name}
                        alt=""
                        compact
                        className="size-[52px] shrink-0 rounded-sm"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base font-bold">{item.name}</span>
                        <span className="text-sm text-muted-foreground">{line(item)}</span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={item.name}
                      aria-pressed={selected}
                      disabled={!selected && full}
                      onClick={() => toggle(item)}
                      className="flex size-14 shrink-0 items-center justify-center self-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50"
                    >
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="flex size-6 rotate-45 items-center justify-center rounded-[4px] bg-primary text-primary-foreground"
                        >
                          <span className="-rotate-45 text-xs font-extrabold">{order + 1}</span>
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="size-5 rotate-45 rounded-[4px] border-[1.5px] border-planned"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div ref={sentinel} />
        {full && room > 0 ? (
          <p className="text-sm text-muted-foreground">{t('Up to 30 exercises in a workout.')}</p>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 border-t border-border-strong bg-background px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          className="w-full"
          size="lg"
          disabled={picked.length === 0}
          onClick={() => onAdd(picked)}
        >
          {t('Add {{count}} exercises', { count: picked.length })}
        </Button>
      </div>
    </>
  );
}
