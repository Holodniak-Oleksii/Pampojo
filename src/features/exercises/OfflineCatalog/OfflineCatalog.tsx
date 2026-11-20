'use client';

import { useTranslation } from 'react-i18next';
import { useLocalExerciseCount } from '@/api/exercises';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The quiet line over an offline catalog: only the exercises on the device are listed (D16.5). */
export function OfflineCatalogHint({ className }: { className?: string }) {
  const { t } = useTranslation();
  const count = useLocalExerciseCount().data ?? 0;
  return (
    <p
      role="status"
      className={cn('flex items-start gap-2.5 text-sm leading-5 text-muted-foreground', className)}
    >
      <span
        aria-hidden="true"
        className="mt-[5px] size-[9px] shrink-0 rotate-45 rounded-[1px] border-[1.6px] border-muted-foreground"
      />
      <span>
        {t(
          'Offline, there are {{count}} exercises from your workouts and history. The rest of the catalog appears when you are online.',
          { count },
        )}
      </span>
    </p>
  );
}

/** An offline search with no local result (D16.6). */
export function OfflineSearchEmpty({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  const count = useLocalExerciseCount().data ?? 0;
  return (
    <section
      aria-labelledby="offline-search-empty"
      className="flex flex-col items-start rounded-lg bg-card px-5 py-6"
    >
      <h2 id="offline-search-empty" className="text-xl leading-[26px] font-extrabold">
        {t('No saved exercise matches')}
      </h2>
      <p className="mt-2.5 text-[15px] leading-[22px] text-muted-foreground">
        {t(
          'Offline, search covers only the {{count}} exercises from your workouts and history. The full catalog appears when you are online.',
          { count },
        )}
      </p>
      <Button variant="secondary" size="sm" className="mt-5 ring-border-strong" onClick={onClear}>
        {t('Clear search')}
      </Button>
    </section>
  );
}
