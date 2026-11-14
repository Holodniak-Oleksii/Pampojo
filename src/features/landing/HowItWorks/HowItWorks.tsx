import { getI18n } from '@/i18n/server';
import { cn } from '@/lib/utils';

export async function HowItWorks() {
  const { t } = await getI18n();
  const steps = [
    { title: t('Create a workout'), text: t('Choose exercises and save it once.') },
    { title: t('Schedule it'), text: t('Put it on your calendar, once or every week.') },
    { title: t('Train and track'), text: t('Log every set and watch your progress grow.') },
  ];

  return (
    <section
      id="how-it-works"
      data-section="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="flex scroll-mt-24 flex-col gap-7"
    >
      <h2 id="how-it-works-heading" className="text-3xl font-extrabold">
        {t('How it works')}
      </h2>
      <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
        {steps.map(({ title, text }, index) => (
          <li key={title} className="relative pt-9">
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-[11px] -right-6 left-0 hidden h-0.5 bg-border-strong md:block"
              />
            ) : null}
            <span
              aria-hidden="true"
              data-testid="step-marker"
              className={cn(
                'absolute top-0 left-0 flex size-6 rotate-45 items-center justify-center rounded-md',
                index === 0 ? 'bg-accent text-foreground' : 'bg-foreground text-card',
              )}
            >
              <span className="-rotate-45 text-xs font-extrabold">{index + 1}</span>
            </span>
            <h3 className="mb-1.5 text-lg font-extrabold">{title}</h3>
            <p className="text-[15px] text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
