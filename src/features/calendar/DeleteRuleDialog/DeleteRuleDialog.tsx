import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeleteScheduleRuleMutation } from '@/api/plan';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { ScheduleRule } from '@/shared/schemas/plan';

export interface DeleteRuleDialogProps {
  rule: ScheduleRule | null;
  today: string;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRuleDialog({ rule, today, onOpenChange }: DeleteRuleDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteScheduleRuleMutation();
  return (
    <ConfirmDialog
      open={rule !== null}
      onOpenChange={onOpenChange}
      title={t('Remove "{{name}}" from the calendar?', { name: rule?.workout.name ?? '' })}
      description={t('Past workouts stay in your history.')}
      confirmLabel={t('Delete')}
      cancelLabel={t('Cancel')}
      pending={remove.isPending}
      destructive
      stacked
      onConfirm={() => {
        if (!rule) return;
        onOpenChange(false);
        remove.mutate(
          { id: rule.id, today },
          { onError: () => toast(t('Something went wrong. Try again.')) },
        );
      }}
    />
  );
}
