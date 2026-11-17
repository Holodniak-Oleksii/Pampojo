import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import postgres from 'postgres';

/** Past plan data that the API refuses (it never rewrites the past), written straight to the DB. */
function connect() {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  return postgres(process.env.DATABASE_URL ?? '', { prepare: false, max: 1 });
}

async function userIdOf(sql: postgres.Sql, email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  if (!row) throw new Error(`No user ${email}`);
  return row.id;
}

/** A one-off rule on `date`. */
export async function insertPastRule(
  email: string,
  workoutId: string,
  date: string,
): Promise<void> {
  const sql = connect();
  try {
    const userId = await userIdOf(sql, email);
    await sql`
      insert into schedule_rule (id, user_id, workout_id, start_date, end_date, weekdays, interval_weeks)
      values (${randomUUID()}, ${userId}, ${workoutId}, ${date}, ${date}, '{}', 1)`;
  } finally {
    await sql.end();
  }
}

/** Completed sessions with no sets, one per start time. */
export async function insertCompletedSessions(
  email: string,
  workoutId: string,
  sessions: { startedAt: Date; scheduledFor?: string | null; name?: string }[],
): Promise<void> {
  const sql = connect();
  try {
    const userId = await userIdOf(sql, email);
    // One statement: on CI every round trip to the database costs hundreds of milliseconds.
    const rows = sessions.map((session) => ({
      id: randomUUID(),
      user_id: userId,
      workout_id: workoutId,
      scheduled_for: session.scheduledFor ?? null,
      workout_snapshot: sql.json({
        workoutId,
        name: session.name ?? 'Push Day',
        description: null,
        exercises: [],
      }),
      exercises: sql.json([]),
      status: 'completed',
      started_at: session.startedAt,
      finished_at: new Date(session.startedAt.getTime() + 50 * 60_000),
    }));
    await sql`insert into workout_session ${sql(rows)}`;
  } finally {
    await sql.end();
  }
}
