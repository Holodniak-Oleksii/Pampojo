import { StatusPill } from '@/components/StatusPill';
import { getI18n } from '@/i18n/server';

export async function OfflineBanner() {
  const { t } = await getI18n();
  return (
    <section
      data-section="offline"
      aria-labelledby="offline-heading"
      className="grid h-full content-center items-center gap-6 rounded-[24px] bg-gradient-to-br from-accent-soft to-card p-6 shadow-soft sm:grid-cols-[auto_1fr] md:p-8 lg:grid-cols-1 lg:text-center xl:grid-cols-[auto_1fr] xl:text-left"
    >
      <div
        aria-hidden="true"
        className="mx-auto w-[180px] rounded-[32px] bg-primary p-2 shadow-soft"
      >
        <div className="flex flex-col items-center gap-3 rounded-[26px] bg-card p-4">
          <StatusPill status="offline" />
          <p className="text-center font-semibold">{t('3 sets saved, will sync later')}</p>
        </div>
      </div>
      <h2
        id="offline-heading"
        className="text-2xl font-extrabold md:text-3xl lg:text-2xl xl:text-3xl"
      >
        {t("Train in the basement. Sync when you're back online.")}
      </h2>
    </section>
  );
}
