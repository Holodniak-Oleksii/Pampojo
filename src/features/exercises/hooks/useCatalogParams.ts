'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import {
  EQUIPMENT_LIST,
  EXERCISE_SEARCH_MAX,
  MUSCLE_GROUPS,
  type Equipment,
  type MuscleGroup,
} from '@/constants/exercise';
import { CATALOG_PATH, CATALOG_QUERY_STORAGE_KEY } from '../constants';
import type { CatalogFilters } from '../types';

function toSearch(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const muscle of filters.muscles) params.append('muscle', muscle);
  for (const item of filters.equipment) params.append('equipment', item);
  if (filters.mine) params.set('mine', '1');
  if (filters.gym) params.set('gym', '1');
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** Search and filters live in the URL, so reload and Back restore the same list. */
export function useCatalogParams() {
  const params = useSearchParams();
  const search = params.toString();

  const filters = useMemo<CatalogFilters>(() => {
    const current = new URLSearchParams(search);
    const muscles = new Set(current.getAll('muscle'));
    const equipment = new Set(current.getAll('equipment'));
    return {
      q: (current.get('q') ?? '').trim().slice(0, EXERCISE_SEARCH_MAX),
      // Constant order, unknown values dropped, so the query key stays stable.
      muscles: MUSCLE_GROUPS.filter((muscle) => muscles.has(muscle)),
      equipment: EQUIPMENT_LIST.filter((item) => equipment.has(item)),
      mine: current.get('mine') === '1',
      gym: current.get('gym') === '1',
    };
  }, [search]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_QUERY_STORAGE_KEY, toSearch(filters));
    } catch {
      // Storage can be blocked; the back link then goes to the plain catalog.
    }
  }, [filters]);

  // The native History API updates useSearchParams without a server round trip (router.replace
  // would refetch the page on every chip tap, and fail offline).
  const replace = useCallback((next: CatalogFilters) => {
    window.history.replaceState(null, '', `${CATALOG_PATH}${toSearch(next)}`);
  }, []);

  return {
    filters,
    setQuery: useCallback((q: string) => replace({ ...filters, q: q.trim() }), [filters, replace]),
    toggleMuscle: useCallback(
      (muscle: MuscleGroup) =>
        replace({
          ...filters,
          muscles: filters.muscles.includes(muscle)
            ? filters.muscles.filter((item) => item !== muscle)
            : MUSCLE_GROUPS.filter((item) => item === muscle || filters.muscles.includes(item)),
        }),
      [filters, replace],
    ),
    setEquipment: useCallback(
      (equipment: Equipment[]) => replace({ ...filters, equipment }),
      [filters, replace],
    ),
    toggleMine: useCallback(() => replace({ ...filters, mine: !filters.mine }), [filters, replace]),
    toggleGym: useCallback(() => replace({ ...filters, gym: !filters.gym }), [filters, replace]),
    clear: useCallback(
      () => replace({ q: '', muscles: [], equipment: [], mine: false, gym: false }),
      [replace],
    ),
  };
}
