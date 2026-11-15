import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { ruleSummary, type ScheduledSession } from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { useLocale } from '@/i18n/client';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { WorkoutListItem } from '@/shared/schemas/workout';

export interface PlannedRowProps {
  rule: ScheduleRule;
  workout: WorkoutListItem | undefined;
  /** Today's occurrence: "Почати", or "Виконано" once done. Other days have no action. */
  isToday: boolean;
  done: ScheduledSession | null;
  editable: boolean;
  online: boolean;
  starting: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlannedRow({
  rule,
  workout,
  isToday,
  done,
  editable,
  online,
  starting,
  onStart,
  onEdit,
  onDelete,
}: PlannedRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const name = rule.workout.name;
  return (
    <li className="flex items-center gap-3 py-2.5 pr-1.5 pl-3">
      <ExerciseImage
        src={workout?.thumbnailUrls[0] ?? null}
        name={name}
        alt=""
        compact
        className="size-12 shrink-0 rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-bold">{name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {ruleSummary(t, locale, rule)}
        </span>
      </span>
      {isToday && done ? (
        <Link
          href={sessionHref(done.id)}
          className="flex min-h-11 items-center gap-2 rounded-md px-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Diamond tone="accent" />
          {t('Done', { context: 'plan' })}
        </Link>
      ) : isToday && !rule.workout.deleted ? (
        <Button size="sm" className="px-3.5" disabled={starting} onClick={onStart}>
          {t('Start')}
        </Button>
      ) : null}
      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!online}
              aria-label={t('Actions for {{name}}', { name })}
              className="h-11 w-10 shrink-0"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem className="min-h-11 font-semibold" onSelect={onEdit}>
              <Pencil aria-hidden="true" />
              {t('Edit schedule')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="min-h-11 font-semibold"
              onSelect={onDelete}
            >
              <Trash2 aria-hidden="true" />
              {t('Remove from calendar')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
