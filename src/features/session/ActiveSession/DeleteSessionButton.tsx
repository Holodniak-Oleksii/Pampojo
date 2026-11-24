'use client';

import { Trash2, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { OnlineOnly } from '@/features/offline/OnlineOnly';
import { useRequiresOnline } from '@/features/offline/hooks/useRequiresOnline';
import { useDeleteSession } from '../hooks/useDeleteSession';

/** Deletes a finished workout from the history, calendar and progress, after a confirm. */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { blocked } = useRequiresOnline();
  const { remove, pending } = useDeleteSession();
  const [open, setOpen] = useState(false);

  async function confirm() {
    if (!(await remove(sessionId))) {
      toast(t("Couldn't delete the workout. Try again."));
      return;
    }
    setOpen(false);
    toast(t('Workout deleted'));
    router.push('/calendar');
  }

  return (
    <>
      <OnlineOnly label={t('Delete workout')} kind="label">
        <Button
          variant="secondary"
          size="md"
          className="text-destructive"
          disabled={!blocked && pending}
          onClick={() => setOpen(true)}
        >
          {blocked ? <WifiOff aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {t('Delete workout')}
        </Button>
      </OnlineOnly>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        className="bg-card text-foreground"
        stacked
        destructive
        title={t('Delete this workout?')}
        description={t('It disappears from your history, calendar and progress.')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        pending={pending}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
