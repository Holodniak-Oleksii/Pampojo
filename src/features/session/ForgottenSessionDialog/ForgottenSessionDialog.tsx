'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/i18n/client';

export interface ForgottenSessionDialogProps {
  open: boolean;
  name: string;
  startedAt: string;
  sets: number;
  onFinish: () => void;
  onDiscard: () => void;
}

/** A session left in progress for more than 12 hours: finish it or discard it, nothing else. */
export function ForgottenSessionDialog({
  open,
  name,
  startedAt,
  sets,
  onFinish,
  onDiscard,
}: ForgottenSessionDialogProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    new Date(startedAt),
  );
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="gap-5 rounded-lg bg-card p-5 text-foreground sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">
            {t('Unfinished workout from {{date}}', { date })}
          </DialogTitle>
          <DialogDescription>
            {t('{{name}}, {{count}} sets. Finish it at the time of the last set or discard it.', {
              name,
              count: sets,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={onFinish}>{t('Finish', { context: 'session' })}</Button>
          <Button variant="secondary" className="text-destructive-text" onClick={onDiscard}>
            {t('Delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
