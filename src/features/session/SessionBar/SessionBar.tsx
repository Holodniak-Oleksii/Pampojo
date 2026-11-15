'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { PlayDiamond } from '@/components/PlayDiamond';
import { RestRing } from '@/components/RestRing';
import { cn } from '@/lib/utils';
import type { InProgressSummary } from '@/services/local-db';
import { sessionHref } from '../hooks/useStartSession';
import { useNow } from '../hooks/useNow';
import { formatClock, formatElapsed, restState } from '../utils';

export interface SessionBarProps {
  inProgress: InProgressSummary;
  /** `sidebar` stacks the button under the text for the 224px desktop sidebar. */
  variant?: 'bar' | 'sidebar';
  className?: string;
}

/** A session running in the background: name, rest or elapsed time, and the way back. */
export function SessionBar({ inProgress, variant = 'bar', className }: SessionBarProps) {
  const { t } = useTranslation();
  const now = useNow();
  const { session } = inProgress;
  const name = session.workoutSnapshot.name;
  const rest = session.restEndsAt
    ? restState(session.restEndsAt, session.restDurationSec, now)
    : null;
  const running = rest && !rest.over;

  const stacked = variant === 'sidebar';
  const status = (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {running ? (
        <RestRing
          size={36}
          strokeWidth={3}
          progress={rest.progress}
          trackClassName="stroke-session-track"
        />
      ) : (
        <PlayDiamond />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{name}</span>
        <span className="text-sm text-session-muted tabular-nums">
          {running
            ? t('Rest {{time}}', { time: formatClock(rest.remainingSec) })
            : formatElapsed((now - new Date(session.startedAt).getTime()) / 1000)}
        </span>
      </span>
    </span>
  );

  return (
    <Link
      href={sessionHref(session.id)}
      aria-label={t('Back to workout {{name}}', { name })}
      className={cn(
        'flex min-h-[60px] gap-3 rounded-lg border border-session-border bg-session-surface px-3.5 py-2 text-session-foreground shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-accent',
        stacked ? 'flex-col py-3' : 'items-center',
        className,
      )}
    >
      {status}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-11 items-center justify-center rounded-md bg-session-button px-3.5 font-bold text-session-button-foreground',
          stacked && 'w-full',
        )}
      >
        {t('Back to workout')}
      </span>
    </Link>
  );
}
