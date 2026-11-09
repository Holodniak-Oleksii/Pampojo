'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { logInInputSchema, signUpInputSchema, type LogInInput } from '@/shared/schemas/auth';
import { useFieldErrorMessage, type AuthError } from '../useAuthErrorMessage';

export interface CredentialsFormProps {
  mode: 'login' | 'signup';
  disabled: boolean;
  /** Resolves with an error to show, or null after it has navigated away. */
  onSubmit: (values: LogInInput) => Promise<AuthError | null>;
  onError: (error: AuthError) => void;
  onPendingChange?: (pending: boolean) => void;
  /** The server error alert, rendered right above the submit. */
  alert?: ReactNode;
}

const DESKTOP_QUERY = '(min-width: 1024px)';
// Masked-looking dots read the same in every locale, so this is not a translation key.
const PASSWORD_PLACEHOLDER = '••••••••';

export function CredentialsForm({
  mode,
  disabled,
  onSubmit,
  onError,
  onPendingChange,
  alert,
}: CredentialsFormProps) {
  const { t } = useTranslation();
  const fieldError = useFieldErrorMessage();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === 'signup';

  const form = useForm<LogInInput>({
    resolver: zodResolver(isSignUp ? signUpInputSchema : logInInputSchema),
    // Errors appear only after the first submit, then follow typing (`reValidateMode` onChange).
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;
  const { setFocus } = form;

  // Desktop only: focusing on a phone would pop the keyboard over the card. An alert present on
  // load (a Google callback error) keeps the focus instead.
  const alertOnMount = useRef(Boolean(alert));
  useEffect(() => {
    if (!alertOnMount.current && window.matchMedia(DESKTOP_QUERY).matches) setFocus('email');
  }, [setFocus]);

  const handleValid = async (values: LogInInput) => {
    // A ref, not state, so a fast double click cannot start a second request before re-render.
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    onPendingChange?.(true);
    let error: AuthError | null;
    try {
      error = await onSubmit(values);
    } catch {
      // The auth client rejects on network failures instead of returning an error.
      error = {};
    }
    if (error) {
      inFlight.current = false;
      setPending(false);
      onPendingChange?.(false);
      onError(error);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => form.handleSubmit(handleValid)(event);

  const emailError = fieldError(errors.email?.message);
  const passwordError = fieldError(errors.password?.message);

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <Field data-invalid={Boolean(emailError)}>
        <FieldLabel htmlFor={`${mode}-email`}>{t('Email')}</FieldLabel>
        <Input
          id={`${mode}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('you@example.com')}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? `${mode}-email-error` : undefined}
          {...form.register('email')}
        />
        {emailError ? <FieldError id={`${mode}-email-error`}>{emailError}</FieldError> : null}
      </Field>

      <Field data-invalid={Boolean(passwordError)}>
        <FieldLabel htmlFor={`${mode}-password`}>{t('Password')}</FieldLabel>
        <PasswordInput
          id={`${mode}-password`}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          placeholder={PASSWORD_PLACEHOLDER}
          showLabel={t('Show password')}
          hideLabel={t('Hide password')}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? `${mode}-password-error` : undefined}
          {...form.register('password')}
        />
        {passwordError ? (
          <FieldError id={`${mode}-password-error`}>{passwordError}</FieldError>
        ) : null}
      </Field>

      {alert}

      <Button type="submit" size="lg" className="w-full" disabled={disabled || pending}>
        {isSignUp
          ? pending
            ? t('Creating account…')
            : t('Create account')
          : pending
            ? t('Logging in…')
            : t('Log in')}
      </Button>

      {isSignUp ? (
        <p className="text-center text-sm text-muted-foreground">
          {t('By signing up you agree to the')}{' '}
          <Link
            href="/terms"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            {t('Terms (in the signup note)')}
          </Link>{' '}
          {t('and')}{' '}
          <Link
            href="/privacy"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            {t('Privacy policy (in the signup note)')}
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
