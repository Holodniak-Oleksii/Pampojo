import { Diamond } from '@/components/Diamond';
import { getI18n } from '@/i18n/server';

export async function OfflineBanner() {
  const { t } = await getI18n();
  return (
    <section
      data-section="offline"
      aria-labelledby="offline-heading"
      className="bg-foreground text-card"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-14 md:px-6">
        <h2
          id="offline-heading"
          className="max-w-[18ch] text-[clamp(30px,4vw,44px)] leading-tight font-extrabold"
        >
          {t("Train in the basement. Sync when you're back online.")}
        </h2>
        <p className="flex items-center gap-3 rounded-md bg-band-surface px-4 py-3.5 text-[15px] font-semibold">
          <Diamond tone="accent" variant="outline" size="md" />
          {t('3 sets saved, will sync later')}
        </p>
      </div>
    </section>
  );
}
