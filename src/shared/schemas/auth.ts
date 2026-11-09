import { z } from 'zod';

// Messages are codes; forms translate them, so the schema stays shared with the server.
export const AUTH_FIELD_ERROR = {
  INVALID_EMAIL: 'invalid_email',
  PASSWORD_TOO_SHORT: 'password_too_short',
  PASSWORD_TOO_LONG: 'password_too_long',
  REQUIRED: 'required',
} as const;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: AUTH_FIELD_ERROR.INVALID_EMAIL })
  .pipe(z.email({ error: AUTH_FIELD_ERROR.INVALID_EMAIL }));

export const passwordSchema = z
  .string()
  .min(8, { error: AUTH_FIELD_ERROR.PASSWORD_TOO_SHORT })
  .max(128, { error: AUTH_FIELD_ERROR.PASSWORD_TOO_LONG });

export const logInInputSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { error: AUTH_FIELD_ERROR.REQUIRED })
    .max(128, { error: AUTH_FIELD_ERROR.PASSWORD_TOO_LONG }),
});

export const signUpInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LogInInput = z.infer<typeof logInInputSchema>;
export type SignUpInput = z.infer<typeof signUpInputSchema>;
