import type { TFunction } from 'i18next';
import { Diamond } from '@/components/Diamond';
import { OCCURRENCE_STATUS, SESSION_KIND, type OccurrenceStatus } from '@/constants/plan';
import { cn } from '@/lib/utils';

/** An occurrence status, or an extra session that fulfils no plan. */
export type MarkerStatus = OccurrenceStatus | typeof SESSION_KIND.EXTRA;

const SIZE = { sm: 'sm', md: 'xs', lg: 'md' } as const;

export interface StatusMarkerProps {
  status: MarkerStatus;
  /** 7px in rows and the mobile grid, 8px on desktop cells, 10px in the adherence and week rows. */
  size?: keyof typeof SIZE;
  className?: string;
}

/** The status diamonds from the design system; the label always sits next to it. */
export function StatusMarker({ status, size = 'sm', className }: StatusMarkerProps) {
  const outline = size === 'lg' ? 'border-2' : 'border-[1.5px]';
  const shared = { size: SIZE[size] } as const;
  switch (status) {
    case OCCURRENCE_STATUS.ON_TIME:
      return <Diamond {...shared} tone="accent" className={className} />;
    case OCCURRENCE_STATUS.LATE:
      return (
        <Diamond {...shared} tone="accent" variant="outline" className={cn(outline, className)} />
      );
    case OCCURRENCE_STATUS.MISSED:
      return (
        <Diamond
          {...shared}
          tone="destructive"
          variant="outline"
          className={cn(outline, className)}
        />
      );
    case OCCURRENCE_STATUS.PLANNED:
      return (
        <Diamond {...shared} tone="planned" variant="outline" className={cn(outline, className)} />
      );
    default:
      return <Diamond {...shared} tone="muted" className={className} />;
  }
}

/** "Вчасно", "Із запізненням", "Пропущено", "Заплановано", "Додаткове". */
export function statusLabel(t: TFunction, status: MarkerStatus): string {
  switch (status) {
    case OCCURRENCE_STATUS.ON_TIME:
      return t('On time');
    case OCCURRENCE_STATUS.LATE:
      return t('Done late');
    case OCCURRENCE_STATUS.MISSED:
      return t('Missed');
    case OCCURRENCE_STATUS.PLANNED:
      return t('Planned', { context: 'status' });
    default:
      return t('Extra');
  }
}
