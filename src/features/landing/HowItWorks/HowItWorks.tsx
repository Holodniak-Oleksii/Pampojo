import { ArrowRight, CalendarCheck, ChartColumn, Plus } from 'lucide-react';
import { getI18n } from '@/i18n/server';

export async function HowItWorks() {
  const { t } = await getI18n();
  const steps = [
    { icon: Plus, title: t('Create a workout'), text: t('Choose exercises and save it once.') },
    {
      icon: CalendarCheck,
      title: t('Schedule it'),
      text: t('Put it on your calendar, once or every week.'),
    },
    {
      icon: ChartColumn,
      title: t('Train and track'),
      text: t('Log every set and watch your progress grow.'),
    },
  ];

  return (
    <section
      id="how-it-works"
      data-section="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <h2 id="how-it-works-heading" className="text-3xl font-extrabold">
        {t('How it works')}
      </h2>
      <ol className="grid gap-4 lg:grid-cols-3 lg:gap-10">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <li
            key={title}
            className="relative flex items-start gap-4 rounded-[24px] bg-card p-5 shadow-soft"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-extrabold text-accent-foreground">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="font-extrabold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            {index < steps.length - 1 ? (
              <ArrowRight
                aria-hidden="true"
                className="absolute top-1/2 -right-8 hidden size-5 -translate-y-1/2 text-muted-foreground lg:block"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
