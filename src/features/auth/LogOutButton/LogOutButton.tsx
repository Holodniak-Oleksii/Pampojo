'use client';

import { WifiOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { OnlineOnly } from '@/features/offline/OnlineOnly';
import { useRequiresOnline } from '@/features/offline/hooks/useRequiresOnline';
import { flushAllLocalDbs } from '@/services/local-db';
import { signOutAndClear } from '../sign-out';

export interface LogOutButtonProps {
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
}

/**
 * Logs out after the outbox is empty. Unsent workout data would be lost with the local database,
 * so there is no way to log out past pending changes (spec 17).
 */
export function LogOutButton({ variant = 'secondary', size, className }: LogOutButtonProps) {
  const { t } = useTranslation();
  const { blocked } = useRequiresOnline();
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setPending(true);
    if (!(await signOutAndClear())) setPending(false);
  };

  const logOut = async () => {
    if (pending) return;
    setPending(true);
    const left = await flushAllLocalDbs();
    if (left > 0) {
      setPending(false);
      setFailed(false);
      setRemaining(left);
      return;
    }
    await signOut();
  };

  const syncAndLogOut = async () => {
    setPending(true);
    const left = await flushAllLocalDbs();
    if (left > 0) {
      setPending(false);
      setFailed(true);
      setRemaining(left);
      return;
    }
    setRemaining(0);
    await signOut();
  };

  return (
    <>
      <OnlineOnly label={t('Log out')} kind="label">
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={!blocked && pending}
          onClick={() => void logOut()}
        >
          {blocked ? <WifiOff aria-hidden="true" /> : null}
          {t('Log out')}
        </Button>
      </OnlineOnly>
      <ConfirmDialog
        open={remaining > 0}
        onOpenChange={(open) => {
          if (!open) setRemaining(0);
        }}
        stacked
        title={t('Sync your changes first')}
        description={t(
          '{{count}} changes are not on the server yet. Workouts that did not sync will be lost if you log out.',
          { count: remaining },
        )}
        confirmLabel={t('Sync now')}
        cancelLabel={t('Cancel')}
        pending={pending}
        onConfirm={() => void syncAndLogOut()}
      >
        {failed ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {t("Couldn't sync. Try again.")}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
