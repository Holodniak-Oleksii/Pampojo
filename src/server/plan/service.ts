import 'server-only';
import { SCHEDULE } from '@/constants/plan';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import { findWorkoutRow } from '@/server/workouts/queries';
import {
  addDays,
  addYears,
  firstCommonDate,
  nextOccurrence,
  nthOccurrence,
  type RuleShape,
} from '@/shared/plan/occurrences';
import type {
  ParsedPatchScheduleRuleInput,
  ParsedScheduleRuleSettings,
  ScheduleRule,
  ScheduleRuleListResponse,
} from '@/shared/schemas/plan';
import { PLAN_ERROR } from './errors';
import {
  countActiveRules,
  countWorkoutExercises,
  endRule,
  insertRule,
  listRuleRows,
  listWorkoutRules,
  lockPlanOwner,
  lockRuleRow,
  softDeleteRule,
  updateRuleColumns,
  type Executor,
  type RuleListRow,
  type Tx,
} from './queries';
import { userToday } from './today';

function notFound(): DomainError {
  return new DomainError(PLAN_ERROR.NOT_FOUND, 'Schedule rule not found');
}

function invalid(path: (string | number)[], message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 'Validation failed', [
    { code: 'custom', path, message },
  ]);
}

function toRule(row: RuleListRow): ScheduleRule {
  return {
    id: row.id,
    workoutId: row.workout_id,
    startDate: row.start_date,
    endDate: row.end_date,
    weekdays: row.weekdays.map(Number),
    intervalWeeks: Number(row.interval_weeks),
    updatedAt: new Date(row.updated_at).toISOString(),
    workout: {
      id: row.workout_id,
      name: row.workout_name,
      exerciseCount: Number(row.exercise_count),
      deleted: row.workout_deleted,
    },
  };
}

async function readRules(db: Executor, userId: string, ids: string[]): Promise<ScheduleRule[]> {
  const rows = await listRuleRows(db, userId, ids);
  // Keep the order of `ids`: the edited rule first, then the one split from it.
  return ids.flatMap((id) => rows.filter((row) => row.id === id).map(toRule));
}

interface ResolvedRule extends RuleShape {
  workoutId: string;
  workoutName: string;
}

/** Applies the rules that need the database or today's date, and turns `endAfter` into a date. */
async function resolveSettings(
  tx: Tx,
  userId: string,
  input: ParsedScheduleRuleSettings,
  today: string,
): Promise<ResolvedRule> {
  if (input.startDate < today) throw invalid(['startDate'], 'The start is in the past');
  const shape: RuleShape = {
    startDate: input.startDate,
    endDate: input.endDate,
    weekdays: input.weekdays,
    intervalWeeks: input.intervalWeeks,
  };
  if (input.endAfter !== undefined) {
    const end = nthOccurrence({ ...shape, endDate: null }, input.endAfter);
    if (end === null) throw invalid(['endAfter'], 'The last workout is too far ahead');
    shape.endDate = end;
  }
  if (shape.endDate !== null && shape.endDate > addYears(shape.startDate, SCHEDULE.horizonYears)) {
    throw invalid(['endDate'], 'The end is too far ahead');
  }
  const workout = await findWorkoutRow(tx, userId, input.workoutId);
  if (!workout || (await countWorkoutExercises(tx, workout.id)) === 0) {
    throw invalid(['workoutId'], 'Unknown or empty workout');
  }
  if (nextOccurrence(shape, addDays(shape.startDate, -1)) === null) {
    throw invalid(['endDate'], 'The rule has no workouts');
  }
  return { ...shape, workoutId: workout.id, workoutName: workout.name };
}

async function assertNoOverlap(
  tx: Tx,
  userId: string,
  rule: ResolvedRule,
  exceptId: string | null,
): Promise<void> {
  const others = await listWorkoutRules(tx, userId, rule.workoutId, rule.startDate);
  for (const other of others) {
    if (other.id === exceptId) continue;
    if (firstCommonDate(rule, other) !== null) {
      throw new DomainError(PLAN_ERROR.OVERLAP, 'The workout is already planned on these days', {
        workoutName: rule.workoutName,
      });
    }
  }
}

function columns(rule: ResolvedRule) {
  return {
    workoutId: rule.workoutId,
    startDate: rule.startDate,
    endDate: rule.endDate,
    weekdays: [...rule.weekdays],
    intervalWeeks: rule.intervalWeeks,
  };
}

export async function listRules(
  userId: string,
  db: Executor = getDb(),
): Promise<ScheduleRuleListResponse> {
  return { items: (await listRuleRows(db, userId)).map(toRule) };
}

/** Idempotent create with a client id: a repeat returns the stored rule unchanged. */
export async function putRule(
  userId: string,
  id: string,
  input: ParsedScheduleRuleSettings,
  db: Executor = getDb(),
): Promise<{ items: ScheduleRule[]; created: boolean }> {
  let created = false;
  await db.transaction(async (tx) => {
    await lockPlanOwner(tx, userId);
    const existing = await lockRuleRow(tx, id);
    if (existing) {
      if (existing.userId !== userId || existing.deletedAt) throw notFound();
      return;
    }
    const today = await userToday(tx, userId);
    const rule = await resolveSettings(tx, userId, input, today);
    await assertNoOverlap(tx, userId, rule, null);
    if ((await countActiveRules(tx, userId, today)) >= SCHEDULE.activeRulesMax) {
      throw new DomainError(PLAN_ERROR.LIMIT_REACHED, 'Schedule limit reached', {
        max: SCHEDULE.activeRulesMax,
      });
    }
    await insertRule(tx, { id, userId, ...columns(rule) });
    created = true;
  });
  return { items: await readRules(db, userId, [id]), created };
}

/**
 * Changes a rule from today on. A rule that already started ends yesterday and `newId` takes the
 * new settings, so past occurrences stay as they were; a repeat with the same `newId` is a no-op.
 */
export async function patchRule(
  userId: string,
  id: string,
  input: ParsedPatchScheduleRuleInput,
  db: Executor = getDb(),
): Promise<{ items: ScheduleRule[] }> {
  let ids = [id];
  await db.transaction(async (tx) => {
    await lockPlanOwner(tx, userId);
    const row = await lockRuleRow(tx, id);
    if (!row || row.userId !== userId || row.deletedAt) throw notFound();
    const split = await lockRuleRow(tx, input.newId);
    if (split) {
      if (split.userId !== userId) throw notFound();
      ids = [id, input.newId];
      return;
    }
    const today = await userToday(tx, userId);
    if (row.endDate !== null && row.endDate < today) throw invalid(['id'], 'The rule has ended');
    const rule = await resolveSettings(tx, userId, input, today);
    await assertNoOverlap(tx, userId, rule, id);
    if (row.startDate < today) {
      await endRule(tx, userId, id, addDays(today, -1));
      await insertRule(tx, { id: input.newId, userId, ...columns(rule) });
      ids = [id, input.newId];
    } else {
      await updateRuleColumns(tx, userId, id, columns(rule));
    }
  });
  return { items: await readRules(db, userId, ids) };
}

/** Removes a rule from today on. Repeats and ended rules are no-ops. */
export async function deleteRule(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockPlanOwner(tx, userId);
    const row = await lockRuleRow(tx, id);
    if (!row || row.userId !== userId) throw notFound();
    if (row.deletedAt) return;
    const today = await userToday(tx, userId);
    if (row.endDate !== null && row.endDate < today) return;
    if (row.startDate < today) await endRule(tx, userId, id, addDays(today, -1));
    else await softDeleteRule(tx, userId, id);
  });
}
