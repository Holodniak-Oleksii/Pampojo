'use client';

import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { flushAllLocalDbs } from '@/services/local-db';
import { signOutAndClear } from '../sign-out';

export interface LogOutButtonProps {
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
}

export function LogOutButton({ variant = 'secondary', size, className }: LogOutButtonProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [warning, setWarning] = useState(false);

  const logOut = async () => {
    if (pending) return;
    setPending(true);
    // Unsent workout data would be lost with the local database, so the user decides.
    if ((await flushAllLocalDbs()) > 0) {
      setPending(false);
      setWarning(true);
      return;
    }
    await signOut();
  };

  const signOut = async () => {
    setPending(true);
    if (!(await signOutAndClear())) setPending(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={logOut}
      >
        {t('Log out')}
      </Button>
      <ConfirmDialog
        open={warning}
        onOpenChange={setWarning}
        stacked
        destructive
        title={t('Log out?')}
        description={t(
          'Unsynced workout data will be lost. Connect to the internet so it can sync.',
        )}
        confirmLabel={t('Log out')}
        cancelLabel={t('Cancel')}
        pending={pending}
        onConfirm={() => {
          setWarning(false);
          void signOut();
        }}
      />
    </>
  );
}
