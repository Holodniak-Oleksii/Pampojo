import 'server-only';
import type { ProgressRange } from '@/constants/progress';
import type { Locale } from '@/i18n/config';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { resolveFrames } from '@/server/exercises/media';
import { findExerciseRow } from '@/server/exercises/queries';
import { knownTrackingType } from '@/server/exercises/service';
import { DomainError } from '@/server/http/errors';
import { findProfileRow } from '@/server/profile/queries';
import type { Executor } from '@/server/sessions/queries';
import {
  bestsOf,
  pointOf,
  rangeStart,
  recordsOf,
  type MetricSession,
} from '@/shared/progress/metrics';
import type {
  Bests,
  ExerciseProgressResponse,
  ProgressExercisesResponse,
} from '@/shared/schemas/progress';
import {
  findMonthTotalsRow,
  listExerciseSetRows,
  listExerciseSetRowsFor,
  listTrainedExerciseRows,
  type ExerciseSetRow,
} from './queries';

const toNumber = (value: string | number | null) => (value === null ? null : Number(value));
const iso = (value: Date | string) =>
  (value instanceof Date ? value : new Date(value)).toISOString();

async function profileZone(db: Executor, userId: string): Promise<string> {
  const profile = await findProfileRow(db, userId);
  if (!profile) throw new DomainError('PROFILE_NOT_FOUND', 'Profile not found');
  return profile.timeZone;
}

/** Groups set rows (already in start order) into sessions with their start date in the zone. */
function sessionsOf(rows: readonly ExerciseSetRow[], timeZone: string): MetricSession[] {
  const sessions: (MetricSession & { sets: MetricSession['sets'][number][] })[] = [];
  for (const row of rows) {
    let last = sessions.at(-1);
    if (last?.sessionId !== row.session_id) {
      const startedAt = row.started_at instanceof Date ? row.started_at : new Date(row.started_at);
      last = { sessionId: row.session_id, date: todayIn(timeZone, startedAt), sets: [] };
      sessions.push(last);
    }
    last.sets.push({
      weightKg: toNumber(row.weight_kg),
      reps: row.reps,
      durationSec: row.duration_sec,
      distanceM: row.distance_m,
    });
  }
  return sessions;
}

/** The selector list and this month's numbers. Three queries for any number of exercises. */
export async function listProgressExercises(
  userId: string,
  locale: Locale,
  db: Executor = getDb(),
): Promise<ProgressExercisesResponse> {
  const timeZone = await profileZone(db, userId);
  const today = todayIn(timeZone);
  const rows = await listTrainedExerciseRows(db, userId, locale);
  const month = await findMonthTotalsRow(db, {
    userId,
    timeZone,
    from: `${today.slice(0, 8)}01`,
    to: today,
  });
  const frames = await resolveFrames(rows);
  return {
    items: rows.map((row, index) => ({
      exerciseId: row.id,
      name: row.name,
      trackingType: knownTrackingType(row.tracking_type),
      thumbnailUrl: frames[index]?.[0]?.thumbUrl ?? null,
      lastTrainedAt: iso(row.last_trained_at),
    })),
    month: {
      workouts: Number(month.workouts),
      volumeKg: Math.round((toNumber(month.volume_kg) ?? 0) * 100) / 100,
    },
  };
}

/** Chart points in the range and all-time records of one exercise. Three queries. */
export async function getExerciseProgress(
  userId: string,
  locale: Locale,
  exerciseId: string,
  range: ProgressRange,
  db: Executor = getDb(),
): Promise<ExerciseProgressResponse> {
  const timeZone = await profileZone(db, userId);
  const exercise = await findExerciseRow(db, { userId, locale, id: exerciseId });
  if (!exercise) throw new DomainError('EXERCISE_NOT_FOUND', 'Exercise not found');
  const trackingType = knownTrackingType(exercise.tracking_type);
  const sessions = sessionsOf(await listExerciseSetRows(db, userId, exerciseId), timeZone);
  const from = rangeStart(todayIn(timeZone), range);
  return {
    trackingType,
    points: sessions
      .filter((session) => from === null || session.date >= from)
      .map((session) => ({
        sessionId: session.sessionId,
        date: session.date,
        ...pointOf(trackingType, session.sets),
      })),
    records: recordsOf(trackingType, sessions),
  };
}

/** The all-time bests of an exercise for the "last time" response; null with no history. */
export async function findBests(
  db: Executor,
  userId: string,
  exerciseId: string,
): Promise<Bests | null> {
  const rows = await listExerciseSetRows(db, userId, exerciseId);
  // The time zone does not matter here: bests ignore dates.
  return bestsOf(
    null,
    sessionsOf(rows, 'UTC').map((session) => session.sets),
  );
}

/** `findBests` for several exercises in one query; an exercise with no counted set maps to null. */
export async function findBestsFor(
  db: Executor,
  userId: string,
  exerciseIds: readonly string[],
): Promise<Map<string, Bests | null>> {
  const byExercise = new Map<string, typeof rows>();
  const rows = await listExerciseSetRowsFor(db, userId, exerciseIds);
  for (const row of rows) {
    byExercise.set(row.exercise_id, [...(byExercise.get(row.exercise_id) ?? []), row]);
  }
  return new Map(
    exerciseIds.map((id) => [
      id,
      bestsOf(
        null,
        sessionsOf(byExercise.get(id) ?? [], 'UTC').map((session) => session.sets),
      ),
    ]),
  );
}
