'use client';

import { authClient } from '@/api/auth';
import { CredentialsForm, type CredentialsFormProps } from '../CredentialsForm';
import type { AuthError } from '../useAuthErrorMessage';
import { navigateAfterAuth, safeNext } from '../utils';

export interface LogInFormProps {
  next: string | null;
  disabled: boolean;
  onError: (error: AuthError) => void;
  onPendingChange?: CredentialsFormProps['onPendingChange'];
  alert?: CredentialsFormProps['alert'];
}

export function LogInForm({ next, disabled, onError, onPendingChange, alert }: LogInFormProps) {
  return (
    <CredentialsForm
      mode="login"
      disabled={disabled}
      onError={onError}
      onPendingChange={onPendingChange}
      alert={alert}
      onSubmit={async ({ email, password }) => {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) return { status: error.status, code: error.code };
        navigateAfterAuth(safeNext(next) ?? '/today');
        return null;
      }}
    />
  );
}
