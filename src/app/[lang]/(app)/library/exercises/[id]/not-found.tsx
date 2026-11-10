import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';

export default async function ExerciseNotFound() {
  const { t } = await getI18n();
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
