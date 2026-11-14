import { Diamond } from '@/components/Diamond';
import { formatNumber, formatPercent } from '@/i18n/format';
import { getI18n } from '@/i18n/server';
import { ProgressChart } from '../ProgressChart';

// Twelve sessions of a sample month: two planned days were missed.
const ADHERENCE = [true, true, true, false, true, true, true, true, false, true, true, true];

export async function ProgressShowcase() {
  const { t, locale } = await getI18n();
  return (
    <section
      data-section="showcase"
      aria-labelledby="showcase-heading"
      className="flex flex-col gap-6"
    >
      <h2 id="showcase-heading" className="text-3xl font-extrabold">
        {t('Your progress at a glance')}
      </h2>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[1_1_280px] rounded-lg bg-card p-[22px]">
          <h3 className="font-bold">{t('Plan adherence')}</h3>
          <p className="mt-2.5 text-[44px] leading-none font-extrabold">
            {formatPercent(locale, 82)}
          </p>
          <div aria-hidden="true" className="mt-4 grid grid-cols-12 place-items-center gap-1.5">
            {ADHERENCE.map((done, index) =>
              done ? (
                <Diamond key={index} tone="accent" size="md" />
              ) : (
                <Diamond key={index} tone="planned" variant="outline" size="md" />
              ),
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('9 of 11 workouts this month')}</p>
        </div>
        <div className="min-w-0 flex-[2_1_420px] rounded-lg bg-card p-[22px]">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-bold">{t('Bench press progress')}</h3>
            <span className="text-sm text-muted-foreground">{t('3 months')}</span>
          </div>
          <div className="mt-3">
            <ProgressChart
              label={t('Bench press progress')}
              startLabel={t('70 kg')}
              endLabel={t('80 kg')}
            />
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_220px] rounded-lg bg-card p-[22px]">
          <h3 className="font-bold">{t('BMI')}</h3>
          <p className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
            <span className="text-[44px] leading-none font-extrabold">
              {formatNumber(locale, 24.8)}
            </span>
            <span className="text-[15px] font-semibold text-muted-foreground">
              {t('−0.6 this month')}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
