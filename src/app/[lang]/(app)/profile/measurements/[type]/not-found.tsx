import { Ruler } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';

export default async function MeasurementNotFound() {
  const { t } = await getI18n();
  return (
    <EmptyState
      icon={Ruler}
      title={t('Measurement not found')}
      action={
        <Button asChild variant="secondary">
          <Link href="/profile">{t('Profile')}</Link>
        </Button>
      }
    />
  );
}
