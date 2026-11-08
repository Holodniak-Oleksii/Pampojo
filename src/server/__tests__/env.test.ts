import { describe, expect, it } from 'vitest';
import { parseEnv } from '../env';

describe('parseEnv', () => {
  it('names DATABASE_URL when it is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects an empty DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('never prints the value of an invalid variable', () => {
    let message = '';
    try {
      parseEnv({ DATABASE_URL: 'mysql://user:secret@example.com:3306/db' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('secret');
  });

  it('accepts a postgres URL', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://user:password@example.com:6543/postgres',
      NODE_ENV: 'test',
    });

    expect(env).toEqual({
      DATABASE_URL: 'postgresql://user:password@example.com:6543/postgres',
      NODE_ENV: 'test',
    });
  });
});
