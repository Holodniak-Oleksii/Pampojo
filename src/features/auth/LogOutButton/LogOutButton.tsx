'use client';

import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { deleteAllLocalDbs, flushAllLocalDbs } from '@/services/local-db';
import { authClient } from '@/api/auth';
import { navigateAfterAuth } from '../utils';

// Drafts may hold body data; they must not outlive the session on a shared device.
const DRAFT_KEY_PREFIX = 'pampojo:onboarding:';

function clearOnboardingDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFT_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode); there is nothing to clear then.
  }
}

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
    try {
      await authClient.signOut();
    } catch {
      // Network failure: the cookie is still there, so `/` would bounce straight back. Stay and allow a retry.
      setPending(false);
      return;
    }
    // After a server answer the session is gone (Better Auth clears the cookie even on an error).
    clearOnboardingDrafts();
    await deleteAllLocalDbs();
    navigateAfterAuth('/');
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
