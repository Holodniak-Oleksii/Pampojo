import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';

export async function CtaBanner() {
  const { t } = await getI18n();
  return (
    <section
      data-section="cta"
      aria-labelledby="cta-heading"
      className="flex flex-col items-center justify-between gap-4 rounded-[32px] bg-primary px-6 py-6 text-primary-foreground md:flex-row md:rounded-full md:px-10"
    >
      <h2 id="cta-heading" className="text-center text-2xl font-extrabold md:text-left md:text-3xl">
        {t('Start training smarter today')}
      </h2>
      <Button asChild variant="accent" size="lg">
        <Link href="/signup">{t('Get started')}</Link>
      </Button>
    </section>
  );
}
