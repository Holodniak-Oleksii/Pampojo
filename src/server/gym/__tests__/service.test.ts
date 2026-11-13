import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { gymProfile, user } from '@/server/db/schema';
import { withRollback } from '@/test/db';
import { findGym, getGym, saveGym } from '../service';

// Every case talks to the remote database.
vi.setConfig({ testTimeout: 30_000 });

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function createUser(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `test-gym-service-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

describe('gym service', () => {
  it('has no gym before the first save', async () => {
    await withRollback(async (tx) => {
      const userId = await createUser(tx);
      expect(await findGym(userId, tx)).toBeNull();
      await expect(getGym(userId, tx)).rejects.toMatchObject({ code: 'GYM_PROFILE_NOT_FOUND' });
    });
  });

  it('saves the same list twice into one row', async () => {
    await withRollback(async (tx) => {
      const userId = await createUser(tx);
      const first = await saveGym(userId, ['barbell', 'flat_bench'], tx);
      const second = await saveGym(userId, ['barbell', 'flat_bench'], tx);
      expect(second.equipment).toEqual(first.equipment);
      const rows = await tx.select().from(gymProfile).where(eq(gymProfile.userId, userId));
      expect(rows).toHaveLength(1);
      expect((await getGym(userId, tx)).equipment).toEqual(['barbell', 'flat_bench']);
    });
  });

  it('accepts an empty gym and replaces the list', async () => {
    await withRollback(async (tx) => {
      const userId = await createUser(tx);
      await saveGym(userId, ['barbell'], tx);
      expect((await saveGym(userId, [], tx)).equipment).toEqual([]);
      expect((await getGym(userId, tx)).equipment).toEqual([]);
    });
  });

  it("never touches another user's gym", async () => {
    await withRollback(async (tx) => {
      const a = await createUser(tx);
      const b = await createUser(tx);
      await saveGym(b, ['dumbbells'], tx);
      await saveGym(a, ['barbell'], tx);
      expect((await getGym(b, tx)).equipment).toEqual(['dumbbells']);
      expect((await getGym(a, tx)).equipment).toEqual(['barbell']);
    });
  });
});
