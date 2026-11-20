'use client';

import {
  hashKey,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { liveQuery } from 'dexie';
import { useEffect } from 'react';
import type { PampojoDb } from './db';

export interface LocalQueryOptions<T> {
  queryKey: QueryKey;
  db: PampojoDb | null;
  read: (db: PampojoDb) => Promise<T>;
  /** The network query to use when there is no local database. */
  remote: () => Promise<T>;
  enabled?: boolean;
  initialData?: T;
}

/**
 * A TanStack query whose data comes from Dexie and follows every local change, so hooks keep
 * their result shape while the device holds the data.
 */
export function useLocalQuery<T>({
  queryKey,
  db,
  read,
  remote,
  enabled = true,
  initialData,
}: LocalQueryOptions<T>): UseQueryResult<T> {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);

  const result = useQuery({
    queryKey,
    queryFn: db ? () => read(db) : remote,
    networkMode: db ? 'always' : 'online',
    staleTime: db ? Infinity : undefined,
    enabled,
    initialData,
  });

  useEffect(() => {
    if (!db || !enabled) return;
    const subscription = liveQuery(() => read(db)).subscribe({
      next: (value) => queryClient.setQueryData(queryKey, value),
      error: (error: unknown) => console.warn('[local-db] live query failed', error),
    });
    return () => subscription.unsubscribe();
    // `keyHash` stands for `queryKey`; `read` changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, enabled, keyHash, queryClient]);

  return result;
}
