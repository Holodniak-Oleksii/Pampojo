import { describe, expect, it } from 'vitest';
import { AUTH_FIELD_ERROR, logInInputSchema, signUpInputSchema } from '../auth';

describe('signUpInputSchema', () => {
  it('trims and lower-cases the email', () => {
    const parsed = signUpInputSchema.parse({ email: '  John@Example.COM ', password: 'Password1' });
    expect(parsed.email).toBe('john@example.com');
  });

  it.each([
    [{ email: 'not-an-email', password: 'Password1' }, AUTH_FIELD_ERROR.INVALID_EMAIL],
    [{ email: 'a@example.com', password: 'short' }, AUTH_FIELD_ERROR.PASSWORD_TOO_SHORT],
    [{ email: 'a@example.com', password: 'x'.repeat(129) }, AUTH_FIELD_ERROR.PASSWORD_TOO_LONG],
  ])('rejects %j with %s', (input, code) => {
    const result = signUpInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(code);
  });

  it('accepts 8 and 128 character passwords', () => {
    expect(
      signUpInputSchema.safeParse({ email: 'a@example.com', password: 'x'.repeat(8) }).success,
    ).toBe(true);
    expect(
      signUpInputSchema.safeParse({ email: 'a@example.com', password: 'x'.repeat(128) }).success,
    ).toBe(true);
  });
});

describe('logInInputSchema', () => {
  it('does not enforce the sign-up minimum', () => {
    expect(logInInputSchema.safeParse({ email: 'a@example.com', password: 'short' }).success).toBe(
      true,
    );
  });
});
