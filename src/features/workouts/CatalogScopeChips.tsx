'use client';

import { useTranslation } from 'react-i18next';
import { useGymQuery } from '@/api/gym';
import { chipClass } from '@/features/exercises/MuscleChips';
import type { PickerCatalog } from './hooks/usePickerCatalog';

type ScopeCatalog = Pick<PickerCatalog, 'filters' | 'toggleMine' | 'toggleGym'>;

/** The "Mine" chip, and "Available in my gym" once a gym is saved. */
export function CatalogScopeChips({ catalog }: { catalog: ScopeCatalog }) {
  const { t } = useTranslation();
  const { data: gym } = useGymQuery();
  return (
    <>
      <button
        type="button"
        aria-pressed={catalog.filters.mine}
        onClick={catalog.toggleMine}
        className={chipClass(catalog.filters.mine)}
      >
        {t('Mine')}
      </button>
      {gym ? (
        <button
          type="button"
          aria-pressed={catalog.filters.gym}
          onClick={catalog.toggleGym}
          className={chipClass(catalog.filters.gym)}
        >
          {t('Available in my gym')}
        </button>
      ) : null}
    </>
  );
}
