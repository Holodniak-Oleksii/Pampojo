import { RecordIcon, SetDoneIcon } from '@/components/BrandIcons';
import { StatusPill } from '@/components/StatusPill';
import { getI18n } from '@/i18n/server';
import { cn } from '@/lib/utils';

/** A live-looking slice of the workout screen; decorative, so the landing keeps one heading order. */
export async function HeroWorkoutCard({ className }: { className?: string }) {
  const { t } = await getI18n();
  const sets = [
    { number: 1, done: true },
    { number: 2, done: true },
    { number: 3, done: false },
  ];
  return (
    <div aria-hidden="true" data-testid="hero-workout" className={cn('relative pb-8', className)}>
      <div className="ml-auto max-w-[440px] rounded-lg bg-card p-[22px] shadow-[0_24px_48px_-24px_rgb(36_34_31/0.25)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-3xl font-extrabold">{t('Bench Press')}</span>
          <StatusPill status="offline" />
        </div>
        <div className="mt-4">
          <div className="flex min-h-16 items-center gap-3 border-t border-border">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-bold">{t('Bench Press')}</span>
              <span className="text-sm text-muted-foreground">
                {t('Set {{current}} of {{total}}', { current: 3, total: 4 })}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{t('80 kg × 8')}</span>
          </div>
          {sets.map((set) => (
            <div
              key={set.number}
              className="flex min-h-14 items-center gap-3 border-t border-border last:border-b"
            >
              <SetDoneIcon
                done={set.done}
                className={cn('size-5', set.done ? 'text-foreground' : 'text-planned')}
              />
              <span className={cn('flex-1 font-semibold', !set.done && 'text-muted-foreground')}>
                {t('Set {{number}}', { number: set.number })}
              </span>
              <span
                className={cn('tabular-nums', set.done ? 'font-semibold' : 'text-muted-foreground')}
              >
                {t('80 kg × 8')}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3.5 text-sm text-muted-foreground">{t('3 sets saved, will sync later')}</p>
      </div>
      <span className="absolute bottom-0 left-[8%] inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3.5 text-sm font-semibold text-card">
        <RecordIcon className="size-[18px] text-accent" />
        {t('Record: +5 kg')}
      </span>
    </div>
  );
}
