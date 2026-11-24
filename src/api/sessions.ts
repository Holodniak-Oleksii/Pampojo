import { useInfiniteQuery } from '@tanstack/react-query';
import { listLocalSessions, useLocalQuery, useOptionalLocalDb } from '@/services/local-db';
import { HISTORY_PAGE_SIZE } from '@/constants/plan';
import { SESSION_STATUS } from '@/constants/session';
import {
  lastPerformanceResponseSchema,
  sessionListResponseSchema,
  sessionSchema,
  type LastPerformanceResponse,
  type Session,
  type SessionListQuery,
  type SessionListResponse,
} from '@/shared/schemas/session';
import { ApiError, http } from './http';

const SESSIONS_PATH = '/api/v1/sessions';
const NOT_FOUND = 'SESSION_NOT_FOUND';

export const sessionKeys = {
  all: ['sessions'] as const,
  list: (filters: SessionListQuery) => [...sessionKeys.all, 'list', filters] as const,
  detail: (id: string) => [...sessionKeys.all, 'detail', id] as const,
  history: () => [...sessionKeys.all, 'history'] as const,
  lastPerformance: (exerciseId: string) =>
    [...sessionKeys.all, 'last-performance', exerciseId] as const,
};

export const sessionPath = (id: string) => `${SESSIONS_PATH}/${id}`;
export const setPath = (id: string) => `/api/v1/sets/${id}`;

function listQuery(filters: SessionListQuery): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.exerciseId) params.set('exerciseId', filters.exerciseId);
  if (filters.scheduledFor) params.set('scheduledFor', filters.scheduledFor);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.cursor) params.set('cursor', filters.cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fetchSessions(filters: SessionListQuery): Promise<SessionListResponse> {
  return http(`${SESSIONS_PATH}${listQuery(filters)}`, { schema: sessionListResponseSchema });
}

/** `null` for a missing, abandoned or foreign session. */
export async function fetchSession(id: string): Promise<Session | null> {
  try {
    return await http(sessionPath(id), { schema: sessionSchema });
  } catch (error) {
    if (error instanceof ApiError && error.code === NOT_FOUND) return null;
    throw error;
  }
}

/** Removes a session from the history; a repeat also succeeds. */
export async function deleteSession(id: string): Promise<void> {
  await http(sessionPath(id), { method: 'DELETE' });
}

export async function fetchLastPerformance(exerciseId: string): Promise<LastPerformanceResponse> {
  return http(`/api/v1/exercises/${exerciseId}/last-performance`, {
    schema: lastPerformanceResponseSchema,
  });
}

export function useSessionsQuery(
  filters: SessionListQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const db = useOptionalLocalDb();
  // The 30-day window holds every in-progress session and every session of a planned date.
  const local = filters.status === SESSION_STATUS.IN_PROGRESS || filters.scheduledFor !== undefined;
  return useLocalQuery({
    queryKey: [...sessionKeys.list(filters), local && db ? 'local' : 'remote'],
    db: local ? db : null,
    read: (localDb) => listLocalSessions(localDb, filters),
    remote: () => fetchSessions(filters),
    enabled,
  });
}

/** Completed sessions, newest first, a page at a time (spec 12). */
export function useSessionHistoryQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: sessionKeys.history(),
    queryFn: ({ pageParam }) =>
      fetchSessions({
        status: SESSION_STATUS.COMPLETED,
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}
