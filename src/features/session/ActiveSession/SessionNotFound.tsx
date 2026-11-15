'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SessionNotFound() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pt-[120px]">
      <span
        aria-hidden="true"
        className="mb-2 ml-1 size-[26px] rotate-45 rounded-[4px] border-2 border-planned"
      />
      <h1 className="text-[30px] leading-tight font-extrabold">{t('Workout not found')}</h1>
      <p className="text-muted-foreground">
        {t('It may have been deleted, or the link is wrong.')}
      </p>
      <Link href="/today" className={cn(buttonVariants({ size: 'md' }), 'mt-4 w-full sm:w-auto')}>
        {t('Go to Today')}
      </Link>
    </main>
  );
}
