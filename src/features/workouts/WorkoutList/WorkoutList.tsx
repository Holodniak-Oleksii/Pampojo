'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  fetchWorkout,
  useDeleteWorkoutMutation,
  usePutWorkoutMutation,
  useWorkoutsQuery,
  workoutKeys,
} from '@/api/workouts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MUSCLE_FAMILY_OF } from '@/constants/exercise';
import { WORKOUT_NAME_MAX } from '@/constants/workout';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { useExerciseLabels } from '@/features/exercises/hooks/useExerciseLabels';
import { useIsOnline } from '@/hooks/useIsOnline';
import type { WorkoutListItem } from '@/shared/schemas/workout';
import { duplicateInput } from '../utils';
import { WorkoutListEmpty } from './WorkoutListEmpty';
import { WorkoutListSkeleton } from './WorkoutListSkeleton';

export function WorkoutList() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useIsOnline();
  const labels = useExerciseLabels();
  const queryClient = useQueryClient();
  const query = useWorkoutsQuery();
  const put = usePutWorkoutMutation();
  const remove = useDeleteWorkoutMutation();
  const [deleting, setDeleting] = useState<WorkoutListItem | null>(null);

  async function duplicate(item: WorkoutListItem) {
    try {
      const workout = await queryClient.fetchQuery({
        queryKey: workoutKeys.detail(item.id),
        queryFn: () => fetchWorkout(item.id),
      });
      if (!workout) throw new Error('Workout not found');
      const id = crypto.randomUUID();
      await put.mutateAsync({ id, input: duplicateInput(workout, t, WORKOUT_NAME_MAX) });
      router.push(`/library/workouts/${id}`);
    } catch {
      toast(t('Something went wrong. Try again.'));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      toast(t('Something went wrong. Try again.'));
    }
  }

  if (query.isPending) return <WorkoutListSkeleton />;
  if (query.isError && !query.data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-card p-4">
        <p className="font-semibold">{t("Couldn't load workouts.")}</p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          {t('Try again')}
        </Button>
      </div>
    );
  }
  const items = query.data.items;
  if (items.length === 0) return <WorkoutListEmpty />;

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card lg:grid lg:grid-cols-3 lg:gap-4 lg:divide-y-0 lg:overflow-visible lg:bg-transparent">
        {items.map((item) => (
          <li
            key={item.id}
            className="relative flex items-center lg:items-start lg:rounded-lg lg:bg-card"
          >
            <Link
              href={`/library/workouts/${item.id}`}
              className="flex min-w-0 flex-1 items-center gap-3.5 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-col lg:items-start lg:gap-3 lg:p-[18px] lg:pr-12"
            >
              {item.exerciseCount === 0 ? (
                <span
                  aria-hidden="true"
                  className="size-[52px] shrink-0 rounded-sm border-[1.5px] border-dashed border-planned lg:hidden"
                />
              ) : (
                <ExerciseImage
                  src={item.thumbnailUrls[0] ?? null}
                  name={item.name}
                  alt=""
                  compact
                  className="size-[52px] shrink-0 rounded-sm lg:hidden"
                />
              )}
              {/* From lg the text block dissolves so the card can put the thumbnails between count and muscles. */}
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1 lg:contents">
                <span className="text-base font-bold break-words lg:order-1 lg:text-lg lg:font-extrabold">
                  {item.name}
                </span>
                <span className="text-muted-foreground lg:order-2 lg:-mt-2.5">
                  {t('{{count}} exercises', { count: item.exerciseCount })}
                </span>
                {item.exerciseCount === 0 ? (
                  <span className="mt-1 inline-flex h-6 items-center rounded-md bg-primary px-2 text-[13px] font-bold text-primary-foreground lg:order-3">
                    {t('Add exercises tag')}
                  </span>
                ) : null}
                {item.primaryMuscles.length > 0 ? (
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold lg:order-5">
                    {item.primaryMuscles.map((muscle) => (
                      <span key={muscle} className="inline-flex items-center gap-1.5">
                        <Diamond tone="muscle" family={MUSCLE_FAMILY_OF[muscle]} />
                        {labels.muscle[muscle]}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              {item.thumbnailUrls.length > 0 ? (
                <span aria-hidden="true" className="flex gap-1.5 max-lg:hidden lg:order-4">
                  {item.thumbnailUrls.map((url) => (
                    <ExerciseImage
                      key={url}
                      src={url}
                      name={item.name}
                      alt=""
                      compact
                      className="size-14 rounded-sm"
                    />
                  ))}
                </span>
              ) : null}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!online}
                  aria-label={t('Actions for {{name}}', { name: item.name })}
                  className="mr-1.5 size-11 shrink-0 lg:absolute lg:top-2 lg:right-2 lg:mr-0"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem className="min-h-11" onSelect={() => void duplicate(item)}>
                  <Copy aria-hidden="true" />
                  {t('Duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-11"
                  onSelect={() => setDeleting(item)}
                >
                  <Trash2 aria-hidden="true" />
                  {t('Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t('Delete "{{name}}"?', { name: deleting?.name ?? '' })}
        description={t('Past workouts stay in your history.')}
        cancelLabel={t('Cancel')}
        confirmLabel={t('Delete')}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
