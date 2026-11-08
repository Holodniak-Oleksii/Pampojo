import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';

export async function LegalPlaceholder({ title }: { title: string }) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <PageHeader title={title} />
      <p className="text-lg">{t('Coming soon.')}</p>
      <Button asChild variant="secondary" className="w-fit">
        <Link href="/">{t('Back to home')}</Link>
      </Button>
    </div>
  );
}
