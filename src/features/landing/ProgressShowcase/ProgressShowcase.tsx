import { SegmentedGauge } from '@/components/SegmentedGauge';
import { StatCard } from '@/components/StatCard';
import { formatNumber } from '@/i18n/format';
import { getI18n } from '@/i18n/server';
import { OfflineBanner } from '../OfflineBanner';
import { ProgressChart } from '../ProgressChart';
import { Sparkline } from '../Sparkline';

export async function ProgressShowcase() {
  const { t, locale } = await getI18n();
  return (
    <>
      <section
        data-section="showcase"
        aria-labelledby="showcase-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="showcase-heading" className="sr-only">
          {t('Your progress at a glance')}
        </h2>
        <div className="grid gap-6 rounded-[24px] bg-card p-5 shadow-soft sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="font-extrabold">{t('Plan adherence')}</h3>
            <SegmentedGauge value={82} label={t('Plan adherence')} className="mx-auto" />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="font-extrabold">{t('Bench press progress')}</h3>
            <ProgressChart label={t('Bench press progress')} />
            <p className="text-center text-sm text-muted-foreground">{t('3 months')}</p>
          </div>
        </div>
        <StatCard
          label={t('BMI')}
          value={formatNumber(locale, 24.8)}
          trend={{ direction: 'down', text: formatNumber(locale, -0.6) }}
        >
          <Sparkline />
        </StatCard>
      </section>
      <OfflineBanner />
    </>
  );
}
