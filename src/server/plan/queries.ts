import 'server-only';
import { and, count, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { scheduleRule, workoutExercise } from '@/server/db/schema';
import { touch } from '@/server/db/utils';
import type { Executor, Tx } from '@/server/exercises/queries';

export type { Executor, Tx };

export type RuleRow = typeof scheduleRule.$inferSelect;
export type RuleInsert = typeof scheduleRule.$inferInsert;

/** Serialises a user's plan writes so the overlap and limit checks cannot race. */
export async function lockPlanOwner(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`plan-owner:${userId}`}))`);
}

/** No owner filter on purpose: the service reports a foreign row as not found. */
export async function lockRuleRow(tx: Tx, id: string): Promise<RuleRow | undefined> {
  const [row] = await tx
    .select()
    .from(scheduleRule)
    .where(eq(scheduleRule.id, id))
    .for('update')
    .limit(1);
  return row;
}

export interface RuleListRow extends Record<string, unknown> {
  id: string;
  workout_id: string;
  start_date: string;
  end_date: string | null;
  weekdays: number[];
  interval_weeks: number;
  updated_at: Date | string;
  workout_name: string;
  workout_deleted: boolean;
  exercise_count: number;
}

/** The user's non-deleted rules with their workout, optionally only the given ids. */
export async function listRuleRows(
  db: Executor,
  userId: string,
  ids?: readonly string[],
): Promise<RuleListRow[]> {
  const only =
    ids && ids.length > 0
      ? sql`and r.id = any(array[${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )}]::uuid[])`
      : sql``;
  const rows = await db.execute<RuleListRow>(sql`
    select r.id, r.workout_id, r.start_date::text as start_date, r.end_date::text as end_date,
      r.weekdays, r.interval_weeks, r.updated_at, w.name as workout_name,
      (w.deleted_at is not null) as workout_deleted,
      (select count(*)::int from workout_exercise we where we.workout_id = w.id) as exercise_count
    from schedule_rule r
    join workout w on w.id = r.workout_id
    where r.user_id = ${userId} and r.deleted_at is null ${only}
    order by r.start_date, r.id`);
  return [...rows];
}

/** Non-deleted rules of one workout that are still active on or after `from`. */
export async function listWorkoutRules(
  tx: Tx,
  userId: string,
  workoutId: string,
  from: string,
): Promise<RuleRow[]> {
  return tx
    .select()
    .from(scheduleRule)
    .where(
      and(
        eq(scheduleRule.userId, userId),
        eq(scheduleRule.workoutId, workoutId),
        isNull(scheduleRule.deletedAt),
        or(isNull(scheduleRule.endDate), gte(scheduleRule.endDate, from)),
      ),
    );
}

export async function countActiveRules(tx: Tx, userId: string, today: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(scheduleRule)
    .where(
      and(
        eq(scheduleRule.userId, userId),
        isNull(scheduleRule.deletedAt),
        or(isNull(scheduleRule.endDate), gte(scheduleRule.endDate, today)),
      ),
    );
  return row?.value ?? 0;
}

export async function insertRule(tx: Tx, values: RuleInsert) {
  await tx.insert(scheduleRule).values(values);
}

export async function updateRuleColumns(
  tx: Tx,
  userId: string,
  id: string,
  fields: Pick<RuleInsert, 'workoutId' | 'startDate' | 'endDate' | 'weekdays' | 'intervalWeeks'>,
) {
  await tx
    .update(scheduleRule)
    .set({ ...fields, ...touch() })
    .where(and(eq(scheduleRule.id, id), eq(scheduleRule.userId, userId)));
}

export async function endRule(tx: Tx, userId: string, id: string, endDate: string) {
  await tx
    .update(scheduleRule)
    .set({ endDate, ...touch() })
    .where(and(eq(scheduleRule.id, id), eq(scheduleRule.userId, userId)));
}

export async function softDeleteRule(tx: Tx, userId: string, id: string) {
  await tx
    .update(scheduleRule)
    .set({ deletedAt: new Date(), ...touch() })
    .where(and(eq(scheduleRule.id, id), eq(scheduleRule.userId, userId)));
}

/**
 * Ends a deleted workout's rules: started ones end yesterday, future ones are soft deleted. Today is
 * taken from the profile time zone in SQL; a user without a profile has no rules.
 */
export async function endWorkoutRules(tx: Tx, userId: string, workoutId: string) {
  const today = sql`(select (now() at time zone p.time_zone)::date from profile p where p.user_id = ${userId})`;
  await tx.execute(sql`
    update schedule_rule set end_date = ${today} - 1, updated_at = now()
    where user_id = ${userId} and workout_id = ${workoutId} and deleted_at is null
      and start_date < ${today} and (end_date is null or end_date >= ${today})`);
  await tx.execute(sql`
    update schedule_rule set deleted_at = now(), updated_at = now()
    where user_id = ${userId} and workout_id = ${workoutId} and deleted_at is null
      and start_date >= ${today}`);
}

/** The caller has checked that the workout belongs to the user. */
export async function countWorkoutExercises(db: Executor, workoutId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId));
  return row?.value ?? 0;
}
