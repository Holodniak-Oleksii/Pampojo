import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvatarEmojiId } from '@/constants/avatar';

export function useAvatarEmojiNames(): Record<AvatarEmojiId, string> {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      fox: t('Fox'),
      bear: t('Bear'),
      panda: t('Panda'),
      koala: t('Koala'),
      tiger: t('Tiger'),
      lion: t('Lion'),
      frog: t('Frog'),
      monkey: t('Monkey'),
      penguin: t('Penguin'),
      owl: t('Owl'),
      octopus: t('Octopus'),
      unicorn: t('Unicorn'),
      peach: t('Peach'),
      orange: t('Orange'),
      lemon: t('Lemon'),
      watermelon: t('Watermelon'),
      avocado: t('Avocado'),
      cherries: t('Cherries'),
      weightlifter: t('Weightlifter'),
      'boxing-glove': t('Boxing glove'),
      cyclist: t('Cyclist'),
      runner: t('Runner'),
      lightning: t('Lightning'),
      fire: t('Fire'),
    }),
    [t],
  );
}
