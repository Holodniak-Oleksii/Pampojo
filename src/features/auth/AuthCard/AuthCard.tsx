'use client';

import { WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { LogInForm } from '../LogInForm';
import { SignUpForm } from '../SignUpForm';
import { useAuthErrorMessage, type AuthError } from '../useAuthErrorMessage';

export interface AuthCardProps {
  mode: 'login' | 'signup';
  next: string | null;
  googleEnabled: boolean;
  initialError?: string;
}

export function AuthCard({ mode, next, googleEnabled, initialError }: AuthCardProps) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toMessage = useAuthErrorMessage();
  const [message, setMessage] = useState<string | null>(
    initialError ? toMessage(initialError) : null,
  );
  // One sign-in at a time: email and Google disable each other while one is in flight.
  const [busy, setBusy] = useState<'credentials' | 'google' | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) alertRef.current?.focus();
  }, [message]);

  const onError = (error: AuthError) => setMessage(toMessage(error));
  const pendingHandler = (source: 'credentials' | 'google') => (pending: boolean) => {
    setBusy(pending ? source : null);
    if (pending) setMessage(null);
  };
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  const tabs = [
    { mode: 'login', href: `/login${query}`, label: t('Log in') },
    { mode: 'signup', href: `/signup${query}`, label: t('Sign up') },
  ] as const;

  const formProps = {
    next,
    disabled: !online || busy === 'google',
    onError,
    onPendingChange: pendingHandler('credentials'),
    alert: message ? (
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm font-semibold text-destructive outline-none"
      >
        {message}
      </div>
    ) : null,
  };

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-card p-6 md:p-8 lg:[@media(max-height:760px)]:gap-4 lg:[@media(max-height:760px)]:p-6">
      <nav className="grid grid-cols-2 gap-1 rounded-md bg-background p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.mode}
            href={tab.href}
            aria-current={tab.mode === mode ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center justify-center rounded-md text-sm font-semibold transition-colors',
              tab.mode === mode ? 'bg-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">
          {mode === 'login' ? t('Welcome back') : t('Create your account')}
        </h1>
        <p className="text-muted-foreground">
          {mode === 'login'
            ? t('Log in to continue your training.')
            : t('Free. Takes less than a minute.')}
        </p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleSignInButton
            next={next}
            className="w-full"
            disabled={busy === 'credentials'}
            onPendingChange={pendingHandler('google')}
            onError={onError}
          />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t('or')}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      {!online ? (
        <p className="flex items-center gap-2 rounded-md bg-background px-4 py-3 text-sm font-semibold">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          {t("You're offline. Connect to the internet to log in.")}
        </p>
      ) : null}

      {mode === 'login' ? <LogInForm {...formProps} /> : <SignUpForm {...formProps} />}
    </div>
  );
}
