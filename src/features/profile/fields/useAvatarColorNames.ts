import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvatarColor } from '@/constants/avatar';

export function useAvatarColorNames(): Record<AvatarColor, string> {
  const { t } = useTranslation();
  // `color` context: "Peach" is also an avatar emoji name with a different translation.
  return useMemo(
    () => ({
      1: t('Peach', { context: 'color' }),
      2: t('Apricot', { context: 'color' }),
      3: t('Butter', { context: 'color' }),
      4: t('Sage', { context: 'color' }),
      5: t('Mint', { context: 'color' }),
      6: t('Sky', { context: 'color' }),
      7: t('Lavender', { context: 'color' }),
      8: t('Rose', { context: 'color' }),
    }),
    [t],
  );
}
