import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTH_FIELD_ERROR } from '@/shared/schemas/auth';

export interface AuthError {
  status?: number;
  code?: string;
}

export function useAuthErrorMessage() {
  const { t } = useTranslation();
  return useCallback(
    (error: AuthError | string): string => {
      if (typeof error === 'string') {
        if (error === 'account_not_linked') {
          return t('This email is registered with a password. Log in with your password.');
        }
        return t('Something went wrong. Try again.');
      }
      if (error.status === 429) return t('Too many attempts. Try again in a minute.');
      if (error.code === 'INVALID_EMAIL_OR_PASSWORD') return t('Wrong email or password');
      if (error.code?.startsWith('USER_ALREADY_EXISTS')) {
        return t('An account with this email already exists. Log in instead.');
      }
      return t('Something went wrong. Try again.');
    },
    [t],
  );
}

export function useFieldErrorMessage() {
  const { t } = useTranslation();
  return useCallback(
    (code: string | undefined): string | undefined => {
      switch (code) {
        case undefined:
          return undefined;
        case AUTH_FIELD_ERROR.INVALID_EMAIL:
          return t('Enter a valid email');
        case AUTH_FIELD_ERROR.PASSWORD_TOO_SHORT:
          return t('Password must be at least 8 characters');
        case AUTH_FIELD_ERROR.PASSWORD_TOO_LONG:
          return t('Password must be at most 128 characters');
        default:
          return t('Enter your password');
      }
    },
    [t],
  );
}
