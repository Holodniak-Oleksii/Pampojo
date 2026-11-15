'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function RetryButton() {
  const { t } = useTranslation();
  return (
    <Button className="mt-2 w-full" onClick={() => window.location.reload()}>
      {t('Try again')}
    </Button>
  );
}
