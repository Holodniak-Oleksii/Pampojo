import { CalendarDays, Share2 } from 'lucide-react';
import { SetDoneIcon, WorkoutIcon } from '@/components/BrandIcons';
import { getI18n } from '@/i18n/server';

export async function Features() {
  const { t } = await getI18n();
  const features = [
    {
      icon: <WorkoutIcon className="size-7" />,
      title: t('Build your own workouts'),
      text: t('Pick exercises from the catalog and set sets, reps and weight.'),
    },
    {
      icon: <CalendarDays aria-hidden="true" className="size-7" />,
      title: t('Plan with a calendar'),
      text: t("Repeat workouts on your days and always see what's next."),
    },
    {
      icon: <SetDoneIcon className="size-7" />,
      title: t('Works offline in the gym'),
      text: t('Log sets in a basement with no signal. Everything syncs later.'),
    },
    {
      icon: <Share2 aria-hidden="true" className="size-7" />,
      title: t('Share workouts with friends'),
      text: t('Send a link or a file. Your friend gets their own copy.'),
    },
  ];

  return (
    <section
      id="features"
      data-section="features"
      aria-labelledby="features-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <h2 id="features-heading" className="text-3xl font-extrabold">
        {t('Features')}
      </h2>
      <ul className="grid border-t-2 border-foreground sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon, title, text }) => (
          <li key={title} className="min-w-0 border-b border-border-strong py-6 pr-6">
            {icon}
            <h3 className="mt-3.5 mb-1.5 text-lg font-extrabold break-words">{title}</h3>
            <p className="text-[15px] text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
