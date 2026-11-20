import { SESSION_STATUS } from '@/constants/session';
import type { TrackingType } from '@/constants/exercise';
import { todayIn } from '@/lib/dates';
import { pointOf, rangeStart, volumeOf } from '@/shared/progress/metrics';
import type { ProgressExercisesResponse, ProgressPoint } from '@/shared/schemas/progress';
import type { LocalSession, LocalSetLog, PampojoDb } from './db';
import { localExerciseName } from './exercises';

/** Exercise progress computed on the device; it has no all-time records, which need the server. */
export interface LocalExerciseProgress {
  trackingType: TrackingType;
  points: ProgressPoint[];
  records: null;
}

async function countedSets(db: PampojoDb) {
  const sessions = (
    await db.sessions.where('status').equals(SESSION_STATUS.COMPLETED).toArray()
  ).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const sets = (await db.setLogs.toArray()).filter(
    (set) => set.deletedAt === null && byId.has(set.sessionId),
  );
  return { sessions, byId, sets };
}

/** The progress list and this month's numbers from the sessions on this device. */
export async function progressExercisesLocal(
  db: PampojoDb,
  timeZone: string,
  lang: string,
): Promise<ProgressExercisesResponse> {
  const { byId, sets } = await countedSets(db);
  const today = todayIn(timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const last = new Map<string, string>();
  for (const set of sets) {
    const session = byId.get(set.sessionId) as LocalSession;
    const previous = last.get(set.exerciseId);
    if (!previous || session.startedAt > previous) last.set(set.exerciseId, session.startedAt);
  }
  const exercises = await db.exercises.bulkGet([...last.keys()]);
  const items = exercises.flatMap((exercise) =>
    exercise && exercise.deletedAt === null
      ? [
          {
            exerciseId: exercise.id,
            name: localExerciseName(exercise, lang),
            trackingType: exercise.trackingType,
            thumbnailUrl: exercise.frames[0]?.thumbUrl ?? null,
            lastTrainedAt: last.get(exercise.id) as string,
          },
        ]
      : [],
  );
  items.sort((a, b) => b.lastTrainedAt.localeCompare(a.lastTrainedAt));
  const tracking = new Map(exercises.flatMap((row) => (row ? [[row.id, row.trackingType]] : [])));
  const inMonth = (session: LocalSession) => {
    const date = todayIn(timeZone, new Date(session.startedAt));
    return date >= monthStart && date <= today;
  };
  const monthSessions = [...byId.values()].filter(inMonth);
  const monthIds = new Set(monthSessions.map((session) => session.id));
  const volume = volumeOf(
    sets.filter(
      (set) => monthIds.has(set.sessionId) && tracking.get(set.exerciseId) === 'weight_reps',
    ),
  );
  return { items, month: { workouts: monthSessions.length, volumeKg: volume ?? 0 } };
}

/** The `1m` chart points of one exercise from the sessions on this device. */
export async function exerciseProgressLocal(
  db: PampojoDb,
  exerciseId: string,
  timeZone: string,
): Promise<LocalExerciseProgress | null> {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return null;
  const { sessions, sets } = await countedSets(db);
  const today = todayIn(timeZone);
  const from = rangeStart(today, '1m') ?? today;
  const own = sets.filter((set) => set.exerciseId === exerciseId);
  const bySession = new Map<string, LocalSetLog[]>();
  for (const set of own)
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set]);
  const points = sessions.flatMap((session) => {
    const items = bySession.get(session.id);
    const date = todayIn(timeZone, new Date(session.startedAt));
    if (!items || date < from || date > today) return [];
    return [{ sessionId: session.id, date, ...pointOf(exercise.trackingType, items) }];
  });
  return { trackingType: exercise.trackingType, points, records: null };
}
