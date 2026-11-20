import { applyRuleDelete } from '@/shared/plan/rule-delete';
import type { ScheduleRule, ScheduleRuleListResponse } from '@/shared/schemas/plan';
import type { LocalScheduleRule, PampojoDb } from './db';

/** Non-deleted rules by start date, each with the summary of its workout, as `GET /schedule-rules`. */
export async function listLocalRules(db: PampojoDb): Promise<ScheduleRuleListResponse> {
  const rules = (await db.scheduleRules.toArray()).sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
  );
  const workouts = await db.workouts.bulkGet([...new Set(rules.map((rule) => rule.workoutId))]);
  const byId = new Map(workouts.flatMap((row) => (row ? [[row.id, row] as const] : [])));
  return {
    items: rules.map((rule) => {
      const workout = byId.get(rule.workoutId);
      return {
        ...rule,
        workout: {
          id: rule.workoutId,
          name: workout?.name ?? '',
          exerciseCount: workout?.exercises.length ?? 0,
          deleted: !workout || workout.deletedAt !== null,
        },
      };
    }),
  };
}

const toLocal = (rule: ScheduleRule): LocalScheduleRule => ({
  id: rule.id,
  workoutId: rule.workoutId,
  startDate: rule.startDate,
  endDate: rule.endDate,
  weekdays: rule.weekdays,
  intervalWeeks: rule.intervalWeeks,
  updatedAt: rule.updatedAt,
});

export async function putLocalRules(db: PampojoDb, items: readonly ScheduleRule[]): Promise<void> {
  await db.scheduleRules.bulkPut(items.map(toLocal));
}

/** The local result of `DELETE /schedule-rules/{id}`: a started rule ends yesterday, a future one goes. */
export async function applyLocalRuleDelete(
  db: PampojoDb,
  id: string,
  today: string,
): Promise<void> {
  await db.transaction('rw', [db.scheduleRules, db.workouts], async () => {
    const { items } = await listLocalRules(db);
    const next = applyRuleDelete(items, id, today);
    if (!next.some((rule) => rule.id === id)) {
      await db.scheduleRules.delete(id);
      return;
    }
    const changed = next.find((rule) => rule.id === id);
    if (changed) await db.scheduleRules.put(toLocal(changed));
  });
}
