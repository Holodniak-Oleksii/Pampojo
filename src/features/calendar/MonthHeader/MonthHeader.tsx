import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { monthTitle } from '@/features/plan';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';

// Offline the accent action turns quiet instead of a faded orange (Offline board).
const OFFLINE_DISABLED = 'disabled:bg-card disabled:text-planned disabled:opacity-100';

export interface MonthHeaderProps {
  month: string;
  /** The visible month is not the current one, so "Today" can bring it back. */
  showToday: boolean;
  online: boolean;
  onMove: (delta: number) => void;
  onToday: () => void;
  onSchedule: () => void;
}

export function MonthHeader({
  month,
  showToday,
  online,
  onMove,
  onToday,
  onSchedule,
}: MonthHeaderProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <div className="flex items-center gap-1 lg:gap-2">
      <h2
        aria-live="polite"
        // With "Today" in the row a 20px title would not fit 390px, so it steps down on phones.
        className={cn(
          'min-w-0 flex-1 truncate font-extrabold lg:text-3xl',
          showToday ? 'text-lg' : 'text-xl',
        )}
      >
        {monthTitle(locale, month)}
      </h2>
      {showToday ? (
        <Button
          variant="secondary"
          size="sm"
          className="h-9 px-2 lg:h-10 lg:px-3.5"
          onClick={onToday}
        >
          {t('Today')}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-10"
        aria-label={t('Previous month')}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-10"
        aria-label={t('Next month')}
        onClick={() => onMove(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button
        variant="accent"
        size="icon"
        className={cn('size-11 lg:hidden', OFFLINE_DISABLED)}
        aria-label={t('Schedule workout')}
        disabled={!online}
        onClick={onSchedule}
      >
        <Plus aria-hidden="true" strokeWidth={2.4} />
      </Button>
      <Button
        variant="accent"
        size="sm"
        className={cn('ml-2 h-10 max-lg:hidden', OFFLINE_DISABLED)}
        disabled={!online}
        onClick={onSchedule}
      >
        <Plus aria-hidden="true" strokeWidth={2.4} />
        {t('Schedule workout')}
      </Button>
    </div>
  );
}
