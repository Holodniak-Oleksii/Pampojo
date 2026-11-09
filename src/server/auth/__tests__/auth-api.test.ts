import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db/client';
import { session, user } from '@/server/db/schema';
import { getEnv } from '@/server/env';
import { deleteRateLimitsByKey, deleteUsersByEmail } from '@/test/db';
import { createAuth, getAuth } from '../auth';
import { getSession } from '../session';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Each test file owns an email prefix, because files run in parallel and clean up by pattern.
const testEmail = () => `test-auth-${randomUUID()}@example.com`;
const testIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

function post(path: string, body: unknown, ip = testIp()) {
  return getAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );
}

function sessionCookie(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(/((?:__Secure-)?better-auth\.session_token=[^;]+)/);
  if (!match?.[1]) throw new Error('No session cookie');
  return match[1];
}

async function signUp(email = testEmail()) {
  const response = await post('/sign-up/email', { email, password: PASSWORD, name: 'test' });
  return { email, response };
}

afterAll(async () => {
  await deleteUsersByEmail('test-auth-%@example.com');
  await deleteRateLimitsByKey('%203.0.113.%');
});

describe('email sign-up', () => {
  it('creates a user and a session cookie', async () => {
    const { email, response } = await signUp();

    expect(response.status).toBe(200);
    const rows = await getDb().select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(sessionCookie(response)).toMatch(/^better-auth\.session_token=/);
  });

  it('sets HttpOnly, SameSite=Lax and a 30-day Max-Age', async () => {
    const { response } = await signUp();
    const header = response.headers.get('set-cookie') ?? '';

    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    const maxAge = Number(header.match(/Max-Age=(\d+)/)?.[1]);
    expect(Math.abs(maxAge - 2_592_000)).toBeLessThanOrEqual(60);
    expect(header).not.toMatch(/;\s*Secure/i);
  });

  it('marks the cookie Secure in production', async () => {
    const productionAuth = createAuth({ ...getEnv(), NODE_ENV: 'production' });
    const response = await productionAuth.handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: ORIGIN,
          'x-forwarded-for': testIp(),
        },
        body: JSON.stringify({ email: testEmail(), password: PASSWORD, name: 'test' }),
      }),
    );

    expect(response.headers.get('set-cookie') ?? '').toMatch(/;\s*Secure/i);
  });

  it('refuses an email that already exists', async () => {
    const { email } = await signUp();
    const before = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(user);

    const response = await post('/sign-up/email', { email, password: PASSWORD, name: 'test' });

    expect(response.status).toBe(422);
    expect((await response.json()).code).toMatch(/^USER_ALREADY_EXISTS/);
    const after = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(user);
    expect(after[0]?.count).toBe(before[0]?.count);
  });
});

describe('email sign-in', () => {
  it('answers a wrong password and an unknown email identically', async () => {
    const { email } = await signUp();

    const wrongPassword = await post('/sign-in/email', { email, password: 'not-the-password' });
    const unknownEmail = await post('/sign-in/email', {
      email: testEmail(),
      password: 'not-the-password',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  it('limits sign-in to 10 requests per minute per IP', async () => {
    const ip = testIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await post('/sign-in/email', { email: testEmail(), password: 'x' }, ip);
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
  });
});

describe('sessions', () => {
  it('extends a session that is used again after two days', async () => {
    const { response } = await signUp();
    const cookie = sessionCookie(response);
    const current = await getSession(new Headers({ cookie }));
    if (!current) throw new Error('Expected a session');

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await getDb()
      .update(session)
      .set({ updatedAt: twoDaysAgo, expiresAt: new Date(twoDaysAgo.getTime() + THIRTY_DAYS_MS) })
      .where(eq(session.id, current.session.id));

    const refreshed = await getSession(new Headers({ cookie }));

    expect(refreshed).not.toBeNull();
    const expiresAt = new Date(refreshed?.session.expiresAt ?? 0).getTime();
    expect(Math.abs(expiresAt - (Date.now() + THIRTY_DAYS_MS))).toBeLessThan(60 * 60 * 1000);
  });
});

describe('account linking', () => {
  it('is disabled until email verification exists (spec 27)', () => {
    expect(getAuth().options.account?.accountLinking?.enabled).toBe(false);
  });
});
