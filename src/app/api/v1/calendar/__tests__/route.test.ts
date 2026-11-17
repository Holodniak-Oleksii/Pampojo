import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import type { Tx } from '@/server/plan/queries';
import { addDays } from '@/shared/plan/occurrences';
import { deleteUsersByEmail } from '@/test/db';
import { newHistoryUser } from '@/test/history-fixtures';
import { GET } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const PREFIX = 'test-calendar-route';
let userId: string;

const get = (from: string, to: string) =>
  GET(new Request(`http://localhost/api/v1/calendar?from=${from}&to=${to}`), {
    params: Promise.resolve({}),
  });

beforeAll(async () => {
  userId = await newHistoryUser(getDb() as unknown as Tx, PREFIX);
});

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

describe('GET /api/v1/calendar', () => {
  const today = todayIn('UTC');

  it('returns every day of a 62-day range', async () => {
    const response = await get(addDays(today, -61), today);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { today: string; days: unknown[] };
    expect(body.days).toHaveLength(62);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects 63 days and a reversed range', async () => {
    expect((await get(addDays(today, -62), today)).status).toBe(400);
    expect((await get(today, addDays(today, -1))).status).toBe(400);
  });

  it('needs a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await get(today, today)).status).toBe(401);
  });
});
