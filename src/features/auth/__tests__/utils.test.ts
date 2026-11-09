import { describe, expect, it } from 'vitest';
import { nameFromEmail, safeNext } from '../utils';

describe('safeNext', () => {
  it.each(['/today', '/today?tab=week', '/session/123'])('accepts %s', (value) => {
    expect(safeNext(value)).toBe(value);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/api/v1/health',
    '/api',
    'javascript:alert(1)',
    'today',
    '',
    `/${'a'.repeat(600)}`,
    undefined,
    42,
    ['/today'],
  ])('rejects %s', (value) => {
    expect(safeNext(value)).toBeNull();
  });
});

describe('nameFromEmail', () => {
  it('uses the local part', () => {
    expect(nameFromEmail('john.smith@example.com')).toBe('john.smith');
  });
});
