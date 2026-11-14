import Link from 'next/link';
import { PlayDiamond } from '@/components/PlayDiamond';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';

export async function CtaBanner() {
  const { t } = await getI18n();
  return (
    <section
      data-section="cta"
      aria-labelledby="cta-heading"
      className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-card p-6 ring-1 ring-border ring-inset md:p-10"
    >
      <h2 id="cta-heading" className="text-[clamp(26px,3vw,36px)] leading-tight font-extrabold">
        {t('Log your next workout here')}
      </h2>
      <Button asChild size="lg">
        <Link href="/signup">
          <PlayDiamond />
          {t('Get started')}
        </Link>
      </Button>
    </section>
  );
}
