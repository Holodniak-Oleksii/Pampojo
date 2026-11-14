'use client';

import { Dumbbell, Plus, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NETWORK_ERROR } from '@/api/http';
import { useExercisesInfiniteQuery } from '@/api/exercises';
import { useGymQuery } from '@/api/gym';
import { Diamond } from '@/components/Diamond';
import { EmptyState } from '@/components/EmptyState';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXERCISE_SEARCH_MAX, MUSCLE_FAMILY_OF } from '@/constants/exercise';
import { SEARCH_DEBOUNCE_MS } from '../constants';
import { EquipmentFilter } from '../EquipmentFilter';
import { FilterSheet } from '../FilterSheet';
import { ExerciseCatalogSkeleton } from '../ExerciseCatalogSkeleton';
import { ExerciseListItem } from '../ExerciseListItem';
import { chipClass, MuscleChips } from '../MuscleChips';
import { OnlineLinkButton } from '../OnlineLinkButton';
import { useCatalogParams } from '../hooks/useCatalogParams';
import { useExerciseLabels } from '../hooks/useExerciseLabels';
import type { ExerciseListItem as Item } from '@/shared/schemas/exercise';
import type { MuscleGroup } from '@/constants/exercise';

function isNetworkError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === NETWORK_ERROR
  );
}

interface Group {
  key: string;
  section: MuscleGroup | null;
  items: Item[];
}

/** Consecutive items of one section form a group; search results are one group without a heading. */
function groupBySection(items: Item[], bySection: boolean): Group[] {
  if (!bySection) return [{ key: 'results', section: null, items }];
  const groups: Group[] = [];
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

export function ExerciseCatalog() {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  const {
    filters,
    setQuery,
    toggleMuscle,
    toggleMine,
    toggleGym,
    setEquipment,
    clear,
    resetFilters,
  } = useCatalogParams();
  const query = useExercisesInfiniteQuery(filters);
  // The chip stays hidden until the gym is saved; the API ignores gym=1 without one.
  const { data: gym } = useGymQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = query;

  // The input is local so typing stays instant; the URL follows after a short pause.
  const [draft, setDraft] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    // Back or Clear filters changed the URL; keep a trailing space the user is still typing.
    if (draft.trim() !== filters.q) setDraft(filters.q);
  }
  useEffect(() => {
    if (draft.trim() === filters.q) return;
    const timer = setTimeout(() => setQuery(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, filters.q, setQuery]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage && !isFetchNextPageError) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const narrowed = filters.q !== '' || filters.muscles.length > 0 || filters.equipment.length > 0;
  const hasFilters = narrowed || filters.mine || filters.gym;
  const activeFilters =
    filters.muscles.length +
    filters.equipment.length +
    (filters.mine ? 1 : 0) +
    (filters.gym ? 1 : 0);
  const scopeChips = (
    <>
      <button
        type="button"
        aria-pressed={filters.mine}
        onClick={toggleMine}
        className={chipClass(filters.mine)}
      >
        {t('Mine')}
      </button>
      {gym ? (
        <button
          type="button"
          aria-pressed={filters.gym}
          onClick={toggleGym}
          className={chipClass(filters.gym)}
        >
          {t('Available in my gym')}
        </button>
      ) : null}
    </>
  );
  const createButton = (
    <OnlineLinkButton href="/library/exercises/new" size="sm">
      <Plus aria-hidden="true" />
      {t('Create exercise')}
    </OnlineLinkButton>
  );
  // Offline, TanStack Query pauses the request; a fetch that fails on the way is a network error.
  const offline = query.fetchStatus === 'paused' || isNetworkError(query.error);
  const offlineNotice = (
    <OfflineNotice>{t("You're offline. Connect to the internet to load exercises.")}</OfflineNotice>
  );

  function results() {
    if (!data) {
      if (offline) return offlineNotice;
      if (query.isError) {
        return (
          <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-5">
            <p>{t("Couldn't load exercises.")}</p>
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('Retry')}
            </Button>
          </div>
        );
      }
      return <ExerciseCatalogSkeleton />;
    }

    if (items.length === 0 && filters.mine && !narrowed && !filters.gym) {
      return (
        <EmptyState
          icon={Dumbbell}
          title={t('No exercises of your own yet')}
          description={t('Create one for anything the catalog misses.')}
          action={
            <OnlineLinkButton href="/library/exercises/new">
              {t('Create exercise')}
            </OnlineLinkButton>
          }
        />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title={t('No exercises found')}
          description={t('Try another search or clear the filters.')}
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clear}>
                {t('Clear filters')}
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <>
        {offline ? offlineNotice : null}
        {groupBySection(items, filters.q === '').map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            {group.section ? (
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold">
                <Diamond tone="muscle" family={MUSCLE_FAMILY_OF[group.section]} size="md" />
                {labels.muscle[group.section]}
              </h2>
            ) : null}
            {/* One card with dividers on mobile; a grid of separate cards from lg up. */}
            <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:overflow-visible lg:rounded-none lg:bg-transparent xl:grid-cols-3 2xl:grid-cols-4">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ExerciseListItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div ref={sentinel} />
        {hasNextPage ? (
          <Button
            variant="secondary"
            className="self-center"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchNextPageError ? t('Retry') : t('Show more')}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* role="search", not <aside>: the app sidebar is the page's only complementary landmark. */}
      <div
        role="search"
        aria-label={t('Filters')}
        // Capped and scrollable on desktop: a sticky column taller than the viewport would hide its end.
        className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:-m-1 lg:max-h-[calc(100dvh-6rem)] lg:gap-5 lg:overflow-y-auto lg:p-1"
      >
        <div className="hidden lg:block">{createButton}</div>
        <div className="flex gap-2">
          <Input
            type="search"
            value={draft}
            className="min-w-0 flex-1 [&::-webkit-search-cancel-button]:appearance-none"
            maxLength={EXERCISE_SEARCH_MAX}
            placeholder={t('Search exercises')}
            aria-label={t('Search exercises')}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="lg:hidden">
            <FilterSheet
              muscles={filters.muscles}
              equipment={filters.equipment}
              activeCount={activeFilters}
              scopeChips={scopeChips}
              onToggleMuscle={toggleMuscle}
              onEquipmentChange={setEquipment}
              onClear={resetFilters}
            />
          </div>
        </div>
        <MuscleChips
          className="max-lg:hidden"
          selected={filters.muscles}
          onToggle={toggleMuscle}
          before={scopeChips}
        />
        <div className="hidden lg:block">
          <EquipmentFilter selected={filters.equipment} onChange={setEquipment} />
        </div>
      </div>
      <section aria-label={t('Exercises')} className="flex min-w-0 flex-col gap-4">
        {results()}
      </section>
    </div>
  );
}
