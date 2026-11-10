import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HEIGHT_CM,
  HEIGHT_FT_IN,
  UNIT_SYSTEM,
  WEIGHT_KG,
  WEIGHT_LB,
  type UnitSystem,
} from '@/constants/profile';
import { useFormat } from '@/i18n/client';
import { formatFeetInches } from '@/lib/units';
import { PROFILE_FIELD_ERROR } from '@/shared/schemas/profile';

export function useProfileFieldError() {
  const { t } = useTranslation();
  const format = useFormat();
  return useCallback(
    (code: string | undefined, unitSystem: UnitSystem): string | undefined => {
      const metric = unitSystem === UNIT_SYSTEM.METRIC;
      switch (code) {
        case undefined:
          return undefined;
        case PROFILE_FIELD_ERROR.NAME_REQUIRED:
          return t('Enter your name');
        case PROFILE_FIELD_ERROR.NAME_TOO_LONG:
          return t('Name must be at most 40 characters');
        case PROFILE_FIELD_ERROR.SEX_REQUIRED:
          return t('Choose one');
        case PROFILE_FIELD_ERROR.DATE_INVALID:
          return t('Enter a valid date');
        case PROFILE_FIELD_ERROR.TOO_YOUNG:
          return t('You must be at least 16 to use Pampojo');
        case PROFILE_FIELD_ERROR.TOO_OLD:
          return t('Age must be 100 or less');
        case PROFILE_FIELD_ERROR.HEIGHT_RANGE:
          return metric
            ? t('Enter a height between {{min}} and {{max}}', {
                min: `${format.number(HEIGHT_CM.min)} ${t('cm')}`,
                max: `${format.number(HEIGHT_CM.max)} ${t('cm')}`,
              })
            : t('Enter a height between {{min}} and {{max}}', {
                min: formatFeetInches(HEIGHT_FT_IN.min),
                max: formatFeetInches(HEIGHT_FT_IN.max),
              });
        case PROFILE_FIELD_ERROR.WEIGHT_RANGE: {
          const [min, max, unit] = metric
            ? [WEIGHT_KG.min, WEIGHT_KG.max, t('kg')]
            : [WEIGHT_LB.min, WEIGHT_LB.max, t('lb')];
          return t('Enter a weight between {{min}} and {{max}}', {
            min: `${format.number(min)} ${unit}`,
            max: `${format.number(max)} ${unit}`,
          });
        }
        default:
          return t('Something went wrong. Try again.');
      }
    },
    [t, format],
  );
}
