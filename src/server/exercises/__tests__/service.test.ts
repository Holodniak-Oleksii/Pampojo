import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSearch } from '@/lib/search';
import * as schema from '@/server/db/schema';
import { exercise, exerciseTranslation } from '@/server/db/schema';
import { listExercisesQuerySchema } from '@/shared/schemas/exercise';
import { getEnv } from '@/server/env';
import { withRollback } from '@/test/db';
import type { Tx } from '../queries';
import { findExercise, listExercises } from '../service';

// Every case talks to the remote database.
vi.setConfig({ testTimeout: 30_000 });

const USER = randomUUID();
const query = (input: Record<string, unknown> = {}) => listExercisesQuerySchema.parse(input);

interface Fixture {
  name: string;
  uk?: string;
  aliases?: string[];
  ukAliases?: string[];
  primary: string[];
  secondary?: string[];
  equipment?: string[];
  popularity?: number;
  ownerId?: string;
}

async function insert(tx: Tx, fixture: Fixture): Promise<string> {
  const [row] = await tx
    .insert(exercise)
    .values({
      ownerId: fixture.ownerId ?? null,
      slug: fixture.ownerId ? null : `test-${randomUUID()}`,
      primaryMuscles: fixture.primary,
      secondaryMuscles: fixture.secondary ?? [],
      equipment: fixture.equipment ?? ['band'],
      trackingType: 'weight_reps',
      popularity: fixture.ownerId ? null : (fixture.popularity ?? 50),
      media: { frames: [{ thumb: 't.webp', full: 'f.webp' }] },
    })
    .returning({ id: exercise.id });
  if (!row) throw new Error('No exercise');
  const translations = [{ locale: 'en', name: fixture.name, aliases: fixture.aliases ?? [] }];
  if (fixture.uk)
    translations.push({ locale: 'uk', name: fixture.uk, aliases: fixture.ukAliases ?? [] });
  await tx.insert(exerciseTranslation).values(
    translations.map((t) => ({
      exerciseId: row.id,
      locale: t.locale,
      name: t.name,
      aliases: t.aliases,
      description: `${t.name} description`,
      instructions: ['Step'],
      commonMistakes: ['Mistake'],
      searchName: normalizeSearch(t.name),
      searchAliases: t.aliases.map(normalizeSearch).join('\n'),
    })),
  );
  return row.id;
}

async function insertUser(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(schema.user)
    .values({ name: 'test', email: `test-exercises-${randomUUID()}@example.com` })
    .returning({ id: schema.user.id });
  if (!row) throw new Error('No user');
  return row.id;
}

function only<T extends { id: string }>(ids: string[], items: T[]): T[] {
  return items.filter((item) => ids.includes(item.id));
}

describe('listExercises search', () => {
  it('ranks prefix over contains over alias, ignoring case and diacritics', async () => {
    await withRollback(async (tx) => {
      const token = `zq${randomUUID().slice(0, 8)}`;
      const alias = await insert(tx, {
        name: 'Alias Match',
        aliases: [`${token} alias`],
        primary: ['chest'],
        popularity: 100,
      });
      const contains = await insert(tx, {
        name: `Wide ${token} Press`,
        primary: ['chest'],
        popularity: 90,
      });
      const prefix = await insert(tx, {
        name: `${token} Élévation`,
        primary: ['chest'],
        popularity: 10,
      });

      const result = await listExercises(USER, 'en', query({ q: token.toUpperCase() }), tx);

      expect(result.items.map((item) => item.id)).toEqual([prefix, contains, alias]);
      expect(result.items.every((item) => item.section === null)).toBe(true);

      const accent = await listExercises(USER, 'en', query({ q: `${token} ELEVATION` }), tx);
      expect(accent.items.map((item) => item.id)).toEqual([prefix]);
    });
  });

  it('finds an exercise by its Ukrainian name or alias with the English locale', async () => {
    await withRollback(async (tx) => {
      const token = `жм${randomUUID().slice(0, 6)}`;
      const id = await insert(tx, {
        name: 'Token Press',
        uk: `${token} лежачи`,
        ukAliases: [`${token}-синонім`],
        primary: ['chest'],
      });

      const byName = await listExercises(USER, 'en', query({ q: token }), tx);
      const byAlias = await listExercises(USER, 'en', query({ q: `${token}-синонім` }), tx);

      expect(byName.items).toEqual([expect.objectContaining({ id, name: 'Token Press' })]);
      expect(byAlias.items.map((item) => item.id)).toEqual([id]);
    });
  });

  it('pages with a cursor without overlap and ends with null', async () => {
    await withRollback(async (tx) => {
      const token = `zp${randomUUID().slice(0, 8)}`;
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(
          await insert(tx, { name: `${token} ${i}`, primary: ['chest'], popularity: 50 - i }),
        );
      }

      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await listExercises(USER, 'en', query({ q: token, limit: '2', cursor }), tx);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor ?? undefined;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(3);
      expect(seen).toEqual(ids);
    });
  });

  it('rejects a malformed cursor with VALIDATION_FAILED', async () => {
    await expect(
      listExercises(USER, 'en', query({ cursor: 'not-a-cursor' })),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('listExercises filters and sections', () => {
  it('matches any selected primary muscle, ignores secondary ones, and ANDs equipment', async () => {
    await withRollback(async (tx) => {
      const chest = await insert(tx, { name: 'Fixture Chest', primary: ['chest'] });
      const triceps = await insert(tx, { name: 'Fixture Triceps', primary: ['triceps'] });
      const secondaryOnly = await insert(tx, {
        name: 'Fixture Secondary',
        primary: ['shoulders'],
        secondary: ['triceps'],
      });
      const wrongEquipment = await insert(tx, {
        name: 'Fixture Cable',
        primary: ['chest'],
        equipment: ['cable'],
      });
      const ids = [chest, triceps, secondaryOnly, wrongEquipment];

      const result = await listExercises(
        USER,
        'en',
        query({ muscle: ['chest', 'triceps'], equipment: ['band'], limit: '200' }),
        tx,
      );

      expect(
        only(ids, result.items)
          .map((item) => item.id)
          .sort(),
      ).toEqual([chest, triceps].sort());
    });
  });

  it('groups by the first (selected) primary muscle in muscle order, popularity inside a section', async () => {
    await withRollback(async (tx) => {
      const neckLow = await insert(tx, {
        name: 'Fixture Neck Low',
        primary: ['neck'],
        popularity: 10,
      });
      const neckHigh = await insert(tx, {
        name: 'Fixture Neck High',
        primary: ['neck'],
        popularity: 90,
      });
      const chestFirst = await insert(tx, {
        name: 'Fixture Chest Neck',
        primary: ['chest', 'neck'],
        popularity: 50,
      });
      const ids = [neckLow, neckHigh, chestFirst];

      const all = await listExercises(
        USER,
        'en',
        query({ muscle: ['chest', 'neck'], equipment: ['band'], limit: '200' }),
        tx,
      );
      expect(only(ids, all.items).map((item) => [item.id, item.section])).toEqual([
        [chestFirst, 'chest'],
        [neckHigh, 'neck'],
        [neckLow, 'neck'],
      ]);

      const neckOnly = await listExercises(
        USER,
        'en',
        query({ muscle: 'neck', equipment: ['band'], limit: '200' }),
        tx,
      );
      expect(only(ids, neckOnly.items).map((item) => [item.id, item.section])).toEqual([
        [neckHigh, 'neck'],
        [chestFirst, 'neck'],
        [neckLow, 'neck'],
      ]);
    });
  });

  it('shows own exercises to the owner only and marks them', async () => {
    await withRollback(async (tx) => {
      const owner = await insertUser(tx);
      const id = await insert(tx, { name: 'Fixture Own', primary: ['calves'], ownerId: owner });

      const mine = await listExercises(
        owner,
        'en',
        query({ muscle: 'calves', equipment: ['band'], limit: '200' }),
        tx,
      );
      const theirs = await listExercises(
        USER,
        'en',
        query({ muscle: 'calves', equipment: ['band'], limit: '200' }),
        tx,
      );

      expect(only([id], mine.items)).toEqual([expect.objectContaining({ id, isOwn: true })]);
      expect(only([id], theirs.items)).toEqual([]);
    });
  });
});

describe('listExercises query count', () => {
  it('runs exactly one query regardless of the page size', async () => {
    let queries = 0;
    const client = postgres(getEnv().DATABASE_URL, { prepare: false, max: 1 });
    const counting = drizzle(client, { schema, logger: { logQuery: () => (queries += 1) } });

    try {
      for (const limit of ['2', '50']) {
        queries = 0;
        const result = await listExercises(USER, 'en', query({ limit }), counting);
        expect(result.items).toHaveLength(Number(limit));
        expect(queries).toBe(1);
      }
    } finally {
      await client.end();
    }
  });
});

describe('findExercise', () => {
  it('returns the text in the request locale and falls back to the other locale', async () => {
    await withRollback(async (tx) => {
      const both = await insert(tx, {
        name: 'Fixture Both',
        uk: 'Фікстура обидві',
        primary: ['chest'],
      });
      const enOnly = await insert(tx, { name: 'Fixture English', primary: ['chest'] });

      expect(await findExercise(USER, 'uk', both, tx)).toMatchObject({ name: 'Фікстура обидві' });
      expect(await findExercise(USER, 'en', both, tx)).toMatchObject({ name: 'Fixture Both' });
      expect(await findExercise(USER, 'uk', enOnly, tx)).toMatchObject({ name: 'Fixture English' });
    });
  });

  it('returns null for an unknown id and for another user’s exercise', async () => {
    await withRollback(async (tx) => {
      const owner = await insertUser(tx);
      const own = await insert(tx, {
        name: 'Fixture Own Detail',
        primary: ['chest'],
        ownerId: owner,
      });

      expect(await findExercise(USER, 'en', randomUUID(), tx)).toBeNull();
      expect(await findExercise(USER, 'en', own, tx)).toBeNull();
      expect(await findExercise(owner, 'en', own, tx)).toMatchObject({ isOwn: true });
    });
  });
});
