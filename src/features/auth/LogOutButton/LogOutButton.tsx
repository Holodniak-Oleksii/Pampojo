'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { authClient } from '@/api/auth';
import { navigateAfterAuth } from '../utils';

export function LogOutButton() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const logOut = async () => {
    if (pending) return;
    setPending(true);
    try {
      await authClient.signOut();
    } catch {
      // Network failure: the cookie is still there, so `/` would bounce straight back. Stay and allow a retry.
      setPending(false);
      return;
    }
    navigateAfterAuth('/');
  };

  return (
    <Button variant="secondary" disabled={pending} onClick={logOut}>
      {t('Log out')}
    </Button>
  );
}
