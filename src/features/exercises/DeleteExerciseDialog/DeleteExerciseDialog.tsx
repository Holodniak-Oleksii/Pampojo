'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeleteExerciseMutation } from '@/api/exercises';
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
      />
    </>
  );
}
