import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { formatSyncTime, rejectionReason } from '../utils';

const t = ((key: string, values?: Record<string, string>) =>
  key.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values?.[name] ?? '')) as unknown as TFunction;

describe('formatSyncTime (spec 17 AC3)', () => {
  const now = new Date(2026, 10, 20, 18, 0, 30);

  it('says not synced yet without a time', () => {
    expect(formatSyncTime(t, 'en', null, now)).toBe('Not synced yet');
  });

  it('says just now under a minute', () => {
    expect(formatSyncTime(t, 'en', new Date(2026, 10, 20, 18, 0, 0).toISOString(), now)).toBe(
      'just now',
    );
  });

  it('gives the time today and the date on other days', () => {
    expect(formatSyncTime(t, 'uk', new Date(2026, 10, 20, 17, 42).toISOString(), now)).toBe(
      'today at 17:42',
    );
    expect(formatSyncTime(t, 'uk', new Date(2026, 10, 18, 9, 5).toISOString(), now)).toBe(
      '18 листопада at 09:05',
    );
  });
});

describe('rejectionReason (spec 17 AC3)', () => {
  it.each([
    [
      'SESSION_NOT_FOUND',
      'The workout was deleted on another device, so the server did not accept the change.',
    ],
    ['SESSION_NOT_IN_PROGRESS', 'The workout was already finished on another device.'],
    ['MEASUREMENT_NOT_FOUND', 'The measurement was deleted on another device.'],
    ['VALIDATION_FAILED', 'The server did not accept the data of the change.'],
    ['SOMETHING_ELSE', 'The server did not accept the change.'],
  ])('explains %s', (code, reason) => {
    expect(rejectionReason(t, code)).toBe(reason);
  });
});
