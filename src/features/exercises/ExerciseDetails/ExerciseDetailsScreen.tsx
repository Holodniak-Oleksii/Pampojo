'use client';

import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useExerciseQuery } from '@/api/exercises';
import { EmptyState } from '@/components/EmptyState';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { useIsOnline } from '@/hooks/useIsOnline';
import { ExerciseDetailsSkeleton } from '../ExerciseDetailsSkeleton';
import { ExerciseDetails } from './ExerciseDetails';

/** `/library/exercises/[id]`: the device copy, so the page works offline (spec 17). */
export function ExerciseDetailsScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const query = useExerciseQuery(id);

  if (query.data) return <ExerciseDetails exercise={query.data} />;
  if (query.data === null && online) {
    return (
      <EmptyState
        icon={Dumbbell}
        title={t('Exercise not found')}
        action={
          <Button asChild variant="secondary">
            <Link href="/library/exercises">{t('Back to exercises')}</Link>
          </Button>
        }
      />
    );
  }
  if (!online && (query.data === null || query.fetchStatus === 'paused' || query.isError)) {
    return <OfflineNotice>{t('Needs internet')}</OfflineNotice>;
  }
  return <ExerciseDetailsSkeleton />;
}
