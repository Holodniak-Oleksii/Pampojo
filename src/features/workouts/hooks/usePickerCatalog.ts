import { useEffect, useRef, useState } from 'react';
import { useExercisesInfiniteQuery } from '@/api/exercises';
import type { Equipment, MuscleGroup } from '@/constants/exercise';
import { SEARCH_DEBOUNCE_MS } from '@/features/exercises/constants';
import type { CatalogFilters } from '@/features/exercises/types';
import type { ExerciseListItem } from '@/shared/schemas/exercise';

const EMPTY: CatalogFilters = { q: '', muscles: [], equipment: [], mine: false, gym: false };

export interface CatalogSection {
  key: string;
  section: MuscleGroup | null;
  items: ExerciseListItem[];
}

/** Consecutive items of one section form a group; search results are one group. */
function sections(items: readonly ExerciseListItem[], bySection: boolean): CatalogSection[] {
  if (!bySection) return [{ key: 'results', section: null, items: [...items] }];
  const groups: CatalogSection[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.section === item.section) last.items.push(item);
    else
      groups.push({
        key: `${item.section ?? 'none'}-${groups.length}`,
        section: item.section,
        items: [item],
      });
  }
  return groups;
}

/** The catalog for adding exercises to a workout: local filters, so the URL stays the editor's. */
export function usePickerCatalog() {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY);
  const [draft, setDraft] = useState('');
  const query = useExercisesInfiniteQuery(filters);
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = query;

  useEffect(() => {
    const q = draft.trim();
    if (q === filters.q) return;
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, q })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, filters.q]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage && !isFetchNextPageError)
          void fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const toggle = <T>(list: readonly T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return {
    filters,
    search: draft,
    setSearch: setDraft,
    query,
    sections: sections(items, filters.q === ''),
    sentinel,
    activeCount:
      filters.muscles.length +
      filters.equipment.length +
      (filters.mine ? 1 : 0) +
      (filters.gym ? 1 : 0),
    toggleMuscle: (muscle: MuscleGroup) =>
      setFilters((current) => ({ ...current, muscles: toggle(current.muscles, muscle) })),
    setEquipment: (equipment: Equipment[]) => setFilters((current) => ({ ...current, equipment })),
    toggleMine: () => setFilters((current) => ({ ...current, mine: !current.mine })),
    toggleGym: () => setFilters((current) => ({ ...current, gym: !current.gym })),
    resetFilters: () => setFilters((current) => ({ ...EMPTY, q: current.q })),
  };
}

export type PickerCatalog = ReturnType<typeof usePickerCatalog>;
