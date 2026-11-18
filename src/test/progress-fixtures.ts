import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { SessionStatus } from '@/constants/session';
import { getDb } from '@/server/db/client';
import { exercise, setLog, workoutSession } from '@/server/db/schema';
import type { Tx } from '@/server/plan/queries';

export interface FixtureSet {
  exerciseId: string;
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  deleted?: boolean;
}

/** The id of a seeded system exercise by slug. */
export async function systemExerciseId(slug: string): Promise<string> {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(eq(exercise.slug, slug), isNull(exercise.ownerId)));
  if (!row) throw new Error(`Run pnpm db:seed first (${slug})`);
  return row.id;
}

/** A session with explicit set values, written straight to the database. */
export async function insertSessionWithSets(
  tx: Tx,
  {
    userId,
    workoutId,
    startedAt,
    status = 'completed',
    sets,
  }: {
    userId: string;
    workoutId: string;
    startedAt: Date;
    status?: SessionStatus;
    sets: FixtureSet[];
  },
): Promise<string> {
  const id = randomUUID();
  const entry = randomUUID();
  await tx.insert(workoutSession).values({
    id,
    userId,
    workoutId,
    workoutSnapshot: { workoutId, name: 'Push Day', description: null, exercises: [] },
    exercises: [],
    status,
    startedAt,
    finishedAt: status === 'in_progress' ? null : new Date(startedAt.getTime() + 50 * 60_000),
  });
  if (sets.length > 0) {
    await tx.insert(setLog).values(
      sets.map((set, index) => ({
        id: randomUUID(),
        sessionId: id,
        sessionExerciseId: entry,
        exerciseId: set.exerciseId,
        setIndex: index,
        weightKg: set.weightKg === undefined || set.weightKg === null ? null : String(set.weightKg),
        reps: set.reps ?? null,
        durationSec: set.durationSec ?? null,
        distanceM: set.distanceM ?? null,
        completedAt: new Date(startedAt.getTime() + index * 60_000),
        deletedAt: set.deleted ? new Date() : null,
      })),
    );
  }
  return id;
}
