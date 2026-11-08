import { Check, ChevronLeft, Pause, Trophy } from 'lucide-react';
import { StatusPill } from '@/components/StatusPill';
import { getI18n } from '@/i18n/server';

// Decorative set rows: shapes only, so the mockup fills the screen without extra copy to translate.
const SET_ROWS = [
  { done: true, width: 'w-24' },
  { done: true, width: 'w-20' },
  { done: false, width: 'w-24' },
];

export async function HeroPhone() {
  const { t } = await getI18n();
  return (
    <div aria-hidden="true" className="relative flex justify-center py-6">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--accent-soft)_0%,transparent_70%)]" />
      <div className="relative w-[260px] rounded-[44px] bg-primary p-3 shadow-soft sm:w-[280px] lg:w-[300px] lg:rotate-6">
        <div className="flex flex-col gap-4 rounded-[34px] bg-card p-5">
          <div className="mx-auto h-5 w-20 rounded-full bg-primary" />
          <p className="flex items-center gap-2 font-extrabold whitespace-nowrap">
            <ChevronLeft className="size-5" />
            {t('Bench Press')}
          </p>
          <p className="text-4xl font-extrabold whitespace-nowrap tabular-nums">{t('80 kg × 8')}</p>
          <div className="flex flex-wrap gap-2">
            <p className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-sm font-semibold whitespace-nowrap tabular-nums">
              <Pause className="size-4" />
              {t('Rest 01:15')}
            </p>
            <p className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-sm font-semibold whitespace-nowrap">
              <Trophy className="size-4 text-accent" />
              {t('PR +5 kg')}
            </p>
            <StatusPill status="offline" />
          </div>
          <ul className="flex flex-col gap-2">
            {SET_ROWS.map((row, index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-2xl bg-background px-3 py-3"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-card text-xs font-extrabold tabular-nums">
                  {index + 1}
                </span>
                <span className={`h-2.5 rounded-full bg-muted-foreground/30 ${row.width}`} />
                <span
                  className={`ml-auto flex size-6 items-center justify-center rounded-full ${row.done ? 'bg-accent text-accent-foreground' : 'bg-card'}`}
                >
                  {row.done ? <Check className="size-4" /> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="h-12 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
