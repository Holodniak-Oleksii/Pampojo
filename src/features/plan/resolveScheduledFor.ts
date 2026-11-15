import { SESSION_STATUS, type SessionStatus } from '@/constants/session';
import { occursOn, type RuleShape } from '@/shared/plan/occurrences';

export interface PlannedRule extends RuleShape {
  workoutId: string;
}

export interface ScheduledSession {
  id: string;
  workoutId: string | null;
  scheduledFor: string | null;
  status: SessionStatus;
}

/**
 * The planned date a new session of this workout fulfils: today, when the workout is planned today
 * and today's occurrence has no running or finished session yet. Otherwise null.
 */
export function resolveScheduledFor({
  workoutId,
  rules,
  today,
  sessions,
}: {
  workoutId: string;
  rules: readonly PlannedRule[];
  today: string;
  sessions: readonly ScheduledSession[];
}): string | null {
  const planned = rules.some((rule) => rule.workoutId === workoutId && occursOn(rule, today));
  if (!planned) return null;
  const taken = sessions.some(
    (session) =>
      session.workoutId === workoutId &&
      session.scheduledFor === today &&
      session.status !== SESSION_STATUS.ABANDONED,
  );
  return taken ? null : today;
}
