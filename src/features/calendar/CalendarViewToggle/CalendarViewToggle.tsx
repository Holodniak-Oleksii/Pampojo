import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/SegmentedControl';

export type CalendarView = 'month' | 'list';

export interface CalendarViewToggleProps {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
  className?: string;
}

/** "Місяць / Список": the month grid or the history list. */
export function CalendarViewToggle({ value, onChange, className }: CalendarViewToggleProps) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      name="calendar-view"
      legend={t('View')}
      hideLegend
      appearance="quiet"
      options={[
        { value: 'month', label: t('Month') },
        { value: 'list', label: t('List') },
      ]}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
