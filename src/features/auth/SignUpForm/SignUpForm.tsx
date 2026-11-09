'use client';

import { authClient } from '@/api/auth';
import { CredentialsForm, type CredentialsFormProps } from '../CredentialsForm';
import type { AuthError } from '../useAuthErrorMessage';
import { nameFromEmail, navigateAfterAuth, safeNext } from '../utils';

export interface SignUpFormProps {
  next: string | null;
  disabled: boolean;
  onError: (error: AuthError) => void;
  onPendingChange?: CredentialsFormProps['onPendingChange'];
  alert?: CredentialsFormProps['alert'];
}

export function SignUpForm({ next, disabled, onError, onPendingChange, alert }: SignUpFormProps) {
  return (
    <CredentialsForm
      mode="signup"
      disabled={disabled}
      onError={onError}
      onPendingChange={onPendingChange}
      alert={alert}
      onSubmit={async ({ email, password }) => {
        // Better Auth requires a name; onboarding (spec 04) replaces this placeholder.
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: nameFromEmail(email),
        });
        if (error) return { status: error.status, code: error.code };
        navigateAfterAuth(safeNext(next) ?? '/today');
        return null;
      }}
    />
  );
}
