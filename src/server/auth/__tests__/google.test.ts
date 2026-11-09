import { describe, expect, it } from 'vitest';
import { authBaseUrl, authTrustedOrigins } from '../base-url';
import { isGoogleEnabled } from '../google';

describe('isGoogleEnabled', () => {
  const credentials = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };

  it('is on with credentials outside previews', () => {
    expect(isGoogleEnabled(credentials)).toBe(true);
    expect(isGoogleEnabled({ ...credentials, VERCEL_ENV: 'production' })).toBe(true);
  });

  it('is off on Vercel previews', () => {
    expect(isGoogleEnabled({ ...credentials, VERCEL_ENV: 'preview' })).toBe(false);
  });

  it('is off when a credential is missing', () => {
    expect(isGoogleEnabled({ GOOGLE_CLIENT_ID: 'id' })).toBe(false);
    expect(isGoogleEnabled({ GOOGLE_CLIENT_SECRET: 'secret' })).toBe(false);
  });
});

describe('authBaseUrl', () => {
  it('prefers BETTER_AUTH_URL, then the preview URL, then localhost', () => {
    expect(authBaseUrl({ BETTER_AUTH_URL: 'https://pampojo.vercel.app' })).toBe(
      'https://pampojo.vercel.app',
    );
    expect(authBaseUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'pampojo-abc.vercel.app' })).toBe(
      'https://pampojo-abc.vercel.app',
    );
    expect(authBaseUrl({})).toBe('http://localhost:3000');
  });
});

describe('authTrustedOrigins', () => {
  it('trusts the branch alias of a preview as well as its deployment URL', () => {
    expect(
      authTrustedOrigins({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'pampojo-abc.vercel.app',
        VERCEL_BRANCH_URL: 'pampojo-git-feat.vercel.app',
      }),
    ).toEqual(['https://pampojo-abc.vercel.app', 'https://pampojo-git-feat.vercel.app']);
  });

  it('trusts only the base URL outside previews', () => {
    expect(
      authTrustedOrigins({
        BETTER_AUTH_URL: 'https://pampojo.vercel.app',
        VERCEL_ENV: 'production',
        VERCEL_BRANCH_URL: 'pampojo-git-main.vercel.app',
      }),
    ).toEqual(['https://pampojo.vercel.app']);
    expect(authTrustedOrigins({})).toEqual(['http://localhost:3000']);
  });
});
