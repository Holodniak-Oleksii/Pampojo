import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSearch } from '@/lib/search';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, exerciseTranslation, user } from '@/server/db/schema';
import { deleteUsersByEmail } from '@/test/db';
import { GET as getDetail } from '../[id]/route';
import { GET as getList } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/exercises';

const request = (url: string, cookie?: string) =>
  new Request(url, { headers: cookie ? { cookie } : {} });

const detail = (id: string, cookie?: string) =>
  getDetail(request(`${BASE}/${id}`, cookie), { params: Promise.resolve({ id }) });

// Own exercises belong to test users and cascade away with them, so nothing leaks into the catalog.
async function createUser(): Promise<string> {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-exercises-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

function signIn(userId: string | null) {
  vi.mocked(getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as Awaited<ReturnType<typeof getSession>>) : null,
  );
}

async function ownExercise(ownerId: string, names: { en: string; uk?: string }): Promise<string> {
  const [row] = await getDb()
    .insert(exercise)
    .values({
      ownerId,
      primaryMuscles: ['chest'],
      equipment: ['barbell'],
      trackingType: 'weight_reps',
    })
    .returning({ id: exercise.id });
  if (!row) throw new Error('No exercise');
  const rows = Object.entries(names).map(([locale, name]) => ({
    exerciseId: row.id,
    locale,
    name,
    searchName: normalizeSearch(name),
  }));
  await getDb().insert(exerciseTranslation).values(rows);
  return row.id;
}

beforeEach(() => {
  vi.mocked(getSession).mockReset();
});

afterAll(async () => {
  await deleteUsersByEmail('test-exercises-route-%@example.com');
});

describe('GET /api/v1/exercises', () => {
  it('returns 401 without a session', async () => {
    signIn(null);
    expect((await getList(request(BASE))).status).toBe(401);
    expect((await detail(randomUUID())).status).toBe(401);
  });

  it('lists the catalog with repeated filters and a cursor', async () => {
    signIn(await createUser());

    const response = await getList(request(`${BASE}?muscle=chest&muscle=triceps&limit=5`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.items).toHaveLength(5);
    expect(body.nextCursor).toEqual(expect.any(String));
    expect(
      body.items.every((item: { primaryMuscles: string[] }) =>
        item.primaryMuscles.some((m) => m === 'chest' || m === 'triceps'),
      ),
    ).toBe(true);
  });

  it('returns 400 for an unknown filter value or a bad cursor', async () => {
    signIn(await createUser());
    expect((await getList(request(`${BASE}?muscle=wings`))).status).toBe(400);
    const badCursor = await getList(request(`${BASE}?cursor=xyz`));
    expect(badCursor.status).toBe(400);
    expect((await badCursor.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('answers in the language of the lang cookie', async () => {
    signIn(await createUser());
    const uk = await (await getList(request(`${BASE}?q=bench`, 'lang=uk'))).json();
    const en = await (await getList(request(`${BASE}?q=bench`, 'lang=en'))).json();
    expect(uk.items[0].name).toBe('Жим штанги лежачи');
    expect(en.items[0].name).toBe('Bench Press');
  });
});

describe('GET /api/v1/exercises/{id}', () => {
  it('returns the exercise in the cookie language, falling back to the other one', async () => {
    const owner = await createUser();
    signIn(owner);
    const both = await ownExercise(owner, { en: 'Fixture Press', uk: 'Фікстура жим' });
    const enOnly = await ownExercise(owner, { en: 'Fixture English' });

    expect((await (await detail(both, 'lang=uk')).json()).name).toBe('Фікстура жим');
    expect((await (await detail(both, 'lang=en')).json()).name).toBe('Fixture Press');
    expect((await (await detail(enOnly, 'lang=uk')).json()).name).toBe('Fixture English');
  });

  it('returns 404 for an unknown id and for another user’s exercise, 400 for a non-uuid', async () => {
    const owner = await createUser();
    const foreign = await ownExercise(owner, { en: 'Fixture Foreign' });
    signIn(await createUser());

    for (const id of [randomUUID(), foreign]) {
      const response = await detail(id);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('EXERCISE_NOT_FOUND');
    }
    expect((await detail('abc')).status).toBe(400);
  });
});
