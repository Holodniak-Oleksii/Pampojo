'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import googleG from '@/assets/google-g.svg';
import { useIsOnline } from '@/hooks/useIsOnline';
import type { AuthError } from '../useAuthErrorMessage';
import { safeNext } from '../utils';

export interface GoogleSignInButtonProps {
  next: string | null;
  disabled?: boolean;
  className?: string;
  onPendingChange?: (pending: boolean) => void;
  onError?: (error: AuthError) => void;
}

export function GoogleSignInButton({
  next,
  disabled,
  className,
  onPendingChange,
  onError,
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const [pending, setPending] = useState(false);

  const start = async () => {
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    let failure: AuthError | null;
    try {
      // Loaded on click: the button also sits on the static landing page, which should not ship the auth client.
      const { authClient } = await import('@/api/auth');
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: safeNext(next) ?? '/today',
        errorCallbackURL: '/login',
      });
      failure = error ? { status: error.status, code: error.code } : null;
    } catch {
      // A network failure rejects the chunk import or the request instead of returning an error.
      failure = {};
    }
    // On success the browser is already leaving for Google, so the button stays pending.
    if (failure) {
      setPending(false);
      onPendingChange?.(false);
      onError?.(failure);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className={className}
      disabled={disabled || pending || !online}
      onClick={start}
    >
      <Image src={googleG} alt="" width={20} height={20} />
      {t('Continue with Google')}
    </Button>
  );
}
