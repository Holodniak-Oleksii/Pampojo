'use client';

import { useDraggable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXERCISE_SEARCH_MAX } from '@/constants/exercise';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { FilterSheet } from '@/features/exercises/FilterSheet';
import { MuscleChips } from '@/features/exercises/MuscleChips';
import { cn } from '@/lib/utils';
import type { ExerciseListItem } from '@/shared/schemas/exercise';
import { CatalogScopeChips } from '../CatalogScopeChips';
import { CatalogSectionHeading } from '../CatalogSectionHeading';
import { useExerciseLine } from '../hooks/useExerciseLine';
import { usePickerCatalog } from '../hooks/usePickerCatalog';

export const CATALOG_DRAG_PREFIX = 'catalog:';

export interface CatalogDragData {
  kind: 'catalog';
  item: ExerciseListItem;
}

export interface CatalogColumnProps {
  disabled: boolean;
  onAdd: (item: ExerciseListItem) => void;
}

function CatalogRow({
  item,
  line,
  disabled,
  onAdd,
}: {
  item: ExerciseListItem;
  line: string;
  disabled: boolean;
  onAdd: (item: ExerciseListItem) => void;
}) {
  const { t } = useTranslation();
  const data: CatalogDragData = { kind: 'catalog', item };
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `${CATALOG_DRAG_PREFIX}${item.id}`,
    data,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      // Pointer only: the row's keyboard events belong to its "+" button.
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      className={cn(
        'flex min-h-[68px] touch-none items-center gap-3 py-2 pr-1.5 pl-2.5',
        !disabled && 'cursor-grab',
        isDragging && 'opacity-40',
      )}
    >
      <ExerciseImage
        src={item.thumbnailUrl}
        name={item.name}
        alt=""
        compact
        className="size-12 shrink-0 rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">{item.name}</span>
        <span className="text-sm text-muted-foreground">{line}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        disabled={disabled}
        aria-label={t('Add {{name}}', { name: item.name })}
        onClick={() => onAdd(item)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </li>
  );
}

export function CatalogColumn({ disabled, onAdd }: CatalogColumnProps) {
  const { t } = useTranslation();
  const { sentinel, ...catalog } = usePickerCatalog();
  const line = useExerciseLine();
  return (
    <section
      aria-labelledby="catalog-column"
      className="flex flex-col gap-3 lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1"
    >
      <h2 id="catalog-column" className="text-lg font-extrabold">
        {t('Catalog')}
      </h2>
      <Input
        type="search"
        value={catalog.search}
        maxLength={EXERCISE_SEARCH_MAX}
        placeholder={t('Search exercises')}
        aria-label={t('Search exercises')}
        className="[&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => catalog.setSearch(event.target.value)}
      />
      <MuscleChips
        wrap
        selected={catalog.filters.muscles}
        onToggle={catalog.toggleMuscle}
        before={<CatalogScopeChips catalog={catalog} />}
      />
      <div>
        <FilterSheet
          side="right"
          triggerLabel={t('All filters')}
          muscles={catalog.filters.muscles}
          equipment={catalog.filters.equipment}
          activeCount={catalog.activeCount}
          scopeChips={<CatalogScopeChips catalog={catalog} />}
          onToggleMuscle={catalog.toggleMuscle}
          onEquipmentChange={catalog.setEquipment}
          onClear={catalog.resetFilters}
        />
      </div>
      {catalog.query.fetchStatus === 'paused' && !catalog.query.data ? (
        <OfflineNotice>
          {t("You're offline. Connect to the internet to load exercises.")}
        </OfflineNotice>
      ) : null}
      {catalog.sections.map((group) => (
        <div key={group.key} className="flex flex-col gap-2.5">
          {group.section ? <CatalogSectionHeading section={group.section} /> : null}
          <ul className="divide-y divide-border rounded-lg bg-card">
            {group.items.map((item) => (
              <CatalogRow
                key={item.id}
                item={item}
                line={line(item)}
                disabled={disabled}
                onAdd={onAdd}
              />
            ))}
          </ul>
        </div>
      ))}
      <div ref={sentinel} />
    </section>
  );
}
