import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTION, type Section } from './constants';

export function useSectionLabels(): Record<Section, string> {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      [SECTION.TODAY]: t('Today'),
      [SECTION.CALENDAR]: t('Calendar'),
      [SECTION.LIBRARY]: t('Library'),
      [SECTION.PROGRESS]: t('Progress'),
      [SECTION.PROFILE]: t('Profile'),
    }),
    [t],
  );
}
