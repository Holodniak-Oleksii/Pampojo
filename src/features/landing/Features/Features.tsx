import { CalendarDays, Dumbbell, Users, WifiOff } from 'lucide-react';
import { getI18n } from '@/i18n/server';

export async function Features() {
  const { t } = await getI18n();
  const features = [
    {
      icon: Dumbbell,
      title: t('Build your own workouts'),
      text: t('Pick exercises from the catalog and set sets, reps and weight.'),
    },
    {
      icon: CalendarDays,
      title: t('Plan with a calendar'),
      text: t("Repeat workouts on your days and always see what's next."),
    },
    {
      icon: WifiOff,
      title: t('Works offline in the gym'),
      text: t('Log sets in a basement with no signal. Everything syncs later.'),
    },
    {
      icon: Users,
      title: t('Share workouts with friends'),
      text: t('Send a link or a file. Your friend gets their own copy.'),
    },
  ];

  return (
    <section
      id="features"
      data-section="features"
      aria-labelledby="features-heading"
      className="scroll-mt-24"
    >
      <h2 id="features-heading" className="sr-only">
        {t('Features')}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="flex min-w-0 items-start gap-4 rounded-[24px] bg-card p-5 shadow-soft sm:flex-col sm:gap-3"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent sm:size-14">
              <Icon aria-hidden="true" className="size-7" />
            </span>
            <div className="flex min-w-0 flex-col gap-1 sm:gap-3">
              <h3 className="font-extrabold break-words">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
