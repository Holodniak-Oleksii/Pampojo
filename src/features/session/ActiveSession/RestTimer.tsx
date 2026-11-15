'use client';

import { SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RestRing } from '@/components/RestRing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RestState } from '../utils';
import { formatClock } from '../utils';

export interface RestTimerProps {
  rest: RestState | null;
  durationSec: number;
  /** 1-based row the rest leads to, for "Час на підхід N". */
  nextSet: number | null;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
}

function timeText(rest: RestState) {
  return rest.over ? `+${formatClock(rest.overSec)}` : formatClock(rest.remainingSec);
}

/** Mobile: a bar docked to the bottom while a rest runs. */
export function RestBar({ rest, durationSec, nextSet, onAdjust, onSkip }: RestTimerProps) {
  const { t } = useTranslation();
  if (!rest) return null;
  const time = timeText(rest);
  return (
    <section
      aria-label={t('Rest')}
      className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 rounded-t-xl bg-card px-4 pt-3.5 pb-[max(26px,env(safe-area-inset-bottom))] shadow-soft lg:hidden"
    >
      <RestRing size={56} strokeWidth={4} progress={rest.progress} over={rest.over} />
      <div role="timer" aria-live="off" className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-[28px] leading-tight font-extrabold tabular-nums',
            rest.over && 'text-accent',
          )}
        >
          {time}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {rest.over && nextSet !== null
            ? t('Time for set {{n}}', { n: nextSet })
            : t('Rest {{time}}', { time: formatClock(durationSec) })}
        </span>
      </div>
      {rest.over ? (
        <Button size="sm" onClick={onSkip}>
          {t('Skip')}
        </Button>
      ) : (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="w-[52px] px-0"
            aria-label={t('Minus 15 seconds')}
            onClick={() => onAdjust(-15)}
          >
            −15
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-[52px] px-0"
            aria-label={t('Plus 15 seconds')}
            onClick={() => onAdjust(15)}
          >
            +15
          </Button>
          <Button size="icon" aria-label={t('Skip rest')} onClick={onSkip}>
            <SkipForward aria-hidden="true" />
          </Button>
        </>
      )}
    </section>
  );
}

/** Desktop: a panel in the right column, idle when no rest runs. */
export function RestPanel({ rest, durationSec, nextSet, onAdjust, onSkip }: RestTimerProps) {
  const { t } = useTranslation();
  const time = rest ? timeText(rest) : formatClock(durationSec);
  return (
    <section
      aria-label={t('Rest')}
      className="flex flex-col items-center gap-[18px] rounded-lg bg-card px-5 py-6"
    >
      <div className="relative size-[168px]">
        <RestRing
          size={168}
          strokeWidth={6}
          progress={rest?.progress ?? 0}
          over={rest?.over}
          plain
        />
        <div
          role="timer"
          aria-live="off"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span
            className={cn(
              'text-[28px] font-extrabold tabular-nums',
              rest?.over && 'text-accent-foreground',
            )}
          >
            {time}
          </span>
          <span
            className={cn(
              'text-sm tabular-nums',
              rest?.over ? 'text-accent-foreground' : 'text-muted-foreground',
            )}
          >
            {!rest
              ? t('Rest')
              : rest.over && nextSet !== null
                ? t('Time for set {{n}}', { n: nextSet })
                : t('of {{time}}', { time: formatClock(durationSec) })}
          </span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!rest || rest.over}
          aria-label={t('Minus 15 seconds')}
          onClick={() => onAdjust(-15)}
        >
          {t('−15 s')}
        </Button>
        <Button
          variant="secondary"
          disabled={!rest || rest.over}
          aria-label={t('Plus 15 seconds')}
          onClick={() => onAdjust(15)}
        >
          {t('+15 s')}
        </Button>
        <Button className="col-span-2" disabled={!rest} onClick={onSkip}>
          {t('Skip')}
        </Button>
      </div>
    </section>
  );
}
