import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { HISTORY_PAGE_SIZE } from '@/constants/plan';
import { SESSION_STATUS } from '@/constants/session';
import {
  lastPerformanceResponseSchema,
  sessionListResponseSchema,
  sessionSchema,
  type LastPerformance,
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

export async function fetchLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  const response = await http(`/api/v1/exercises/${exerciseId}/last-performance`, {
    schema: lastPerformanceResponseSchema,
  });
  return response.item;
}

export function useSessionsQuery(
  filters: SessionListQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn: () => fetchSessions(filters),
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
