'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Link from 'next/link';
import { useDeleteExerciseMutation } from '@/api/exercises';
import { useWorkoutsQuery } from '@/api/workouts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface DeleteExerciseDialogProps {
  exerciseId: string;
  disabled: boolean;
}

export function DeleteExerciseDialog({ exerciseId, disabled }: DeleteExerciseDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mutation = useDeleteExerciseMutation();
  const workouts = useWorkoutsQuery();
  const usedIn = (workouts.data?.items ?? []).filter((workout) =>
    workout.exerciseIds.includes(exerciseId),
  );

  async function confirm() {
    try {
      await mutation.mutateAsync(exerciseId);
      setOpen(false);
      toast(t('Exercise deleted'));
      router.push('/library/exercises');
    } catch {
      toast(t('Something went wrong. Try again.'));
    }
  }

  return (
    <>
      <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        {t('Delete')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('Delete this exercise?')}
        description={t("It will be removed from your catalog. This can't be undone.")}
        cancelLabel={t('Cancel')}
        confirmLabel={t('Delete')}
        pending={mutation.isPending}
        onConfirm={() => void confirm()}
      >
        {usedIn.length > 0 ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              {t('It will also be removed from these workouts:')}
            </p>
            <ul className="flex flex-col gap-1">
              {usedIn.map((workout) => (
                <li key={workout.id}>
                  <Link
                    href={`/library/workouts/${workout.id}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {workout.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
