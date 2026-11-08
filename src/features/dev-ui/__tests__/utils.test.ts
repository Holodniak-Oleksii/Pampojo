import { describe, expect, it } from 'vitest';
import { isDevUiEnabled } from '../utils';

describe('isDevUiEnabled', () => {
  it('is off on Vercel production', () => {
    expect(isDevUiEnabled({ VERCEL_ENV: 'production' })).toBe(false);
  });

  it.each(['preview', 'development', undefined])('is on for VERCEL_ENV=%s', (VERCEL_ENV) => {
    expect(isDevUiEnabled({ VERCEL_ENV })).toBe(true);
  });
});
