'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SYNC_DOWNLOAD_VERSION } from '@/constants/sync';
import type { PampojoDb, SyncMeta } from '@/services/local-db/db';
import type { SyncTotals } from '@/shared/schemas/sync';
import { syncNow } from './engine';
import { readSyncMeta, updateSyncMeta } from './meta';
import { addReceived, ZERO_TOTALS } from './pull';
import { notifySyncDone } from './request-sync';

export const DOWNLOAD_STEPS = [
  { key: 'profile', tables: [] },
  { key: 'workouts', tables: ['workouts', 'scheduleRules'] },
  { key: 'exercises', tables: ['exercises', 'lastPerformance'] },
  { key: 'history', tables: ['sessions', 'setLogs'] },
  { key: 'measurements', tables: ['measurements'] },
] as const satisfies readonly { key: string; tables: readonly (keyof SyncTotals)[] }[];

export type DownloadStepKey = (typeof DOWNLOAD_STEPS)[number]['key'];

export interface DownloadStep {
  key: DownloadStepKey;
  status: 'done' | 'current' | 'pending' | 'failed';
  /** The main count of the step: workouts, exercises or sessions; null for the others. */
  done: number | null;
  total: number | null;
}

export type DownloadView =
  | { state: 'loading' }
  | { state: 'done' }
  /** The download runs, but the device already has sessions to show, so the app opens. */
  | { state: 'background' }
  | {
      state: 'running' | 'error' | 'offline';
      steps: DownloadStep[];
      /** 0–100. */
      percent: number;
      failedStep: DownloadStepKey | null;
      retry: () => void;
    };

const MAIN_TABLE: Partial<Record<DownloadStepKey, keyof SyncTotals>> = {
  workouts: 'workouts',
  exercises: 'exercises',
  history: 'sessions',
};

export function needsDownload(meta: SyncMeta): boolean {
  return meta.downloadVersion !== SYNC_DOWNLOAD_VERSION || meta.download.status !== 'done';
}

/** Step states from the rows received so far. The first step is done after the first page. */
export function downloadSteps(
  received: SyncTotals,
  totals: SyncTotals | null,
  failed: boolean,
): DownloadStep[] {
  let current = false;
  return DOWNLOAD_STEPS.map((step) => {
    const main = MAIN_TABLE[step.key];
    const finished =
      totals !== null && step.tables.every((table) => received[table] >= totals[table]);
    let status: DownloadStep['status'] = 'pending';
    if (finished) status = 'done';
    else if (!current) {
      current = true;
      status = failed ? 'failed' : 'current';
    }
    return {
      key: step.key,
      status,
      done: main ? received[main] : null,
      total: main && totals ? totals[main] : null,
    };
  });
}

function percentOf(received: SyncTotals, totals: SyncTotals | null): number {
  if (!totals) return 0;
  const all = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const got = Object.entries(received).reduce(
    (sum, [key, value]) => sum + Math.min(value, totals[key as keyof SyncTotals]),
    0,
  );
  return all === 0 ? 100 : Math.round((got / all) * 100);
}

/** Runs the first full download of this device and reports its progress for the download screen. */
export function useInitialDownload(db: PampojoDb): DownloadView {
  const meta = useLiveQuery(() => readSyncMeta(db), [db]);
  // A database from before spec 16 already holds sessions and maybe unsent sets; it opens at once.
  const hasLocalData = useLiveQuery(
    async () => (await db.sessions.count()) > 0 || (await db.outbox.count()) > 0,
    [db],
  );
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const started = useRef(false);
  const [attempt, setAttempt] = useState(0);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    const current = await readSyncMeta(db);
    setFailed(false);
    if (current.download.status !== 'running') {
      // A new download version starts a fresh run, but the outbox and the local rows stay.
      const background = (await db.sessions.count()) > 0 || (await db.outbox.count()) > 0;
      await updateSyncMeta(db, {
        cursor: null,
        pageToken: null,
        download: { status: 'running', received: ZERO_TOTALS, totals: null, background },
      });
    }
    const result = await syncNow(db, {
      onPage: (changes, totals) => {
        void db.transaction('rw', db.meta, async () => {
          const now = await readSyncMeta(db);
          if (now.download.status !== 'running') return;
          await updateSyncMeta(db, {
            download: {
              ...now.download,
              received: addReceived(now.download.received, changes),
              totals: totals ?? now.download.totals,
            },
          });
        });
      },
    });
    started.current = false;
    if (result === 'done') {
      await updateSyncMeta(db, {
        download: { status: 'done' },
        downloadVersion: SYNC_DOWNLOAD_VERSION,
      });
      notifySyncDone();
    } else if (result === 'failed') {
      setFailed(true);
    } else {
      // Another tab runs the download; its progress reaches this tab through the live query.
      setTimeout(() => setAttempt((value) => value + 1), 1000);
    }
  }, [db]);

  const pending = meta !== undefined && needsDownload(meta);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    // Starts after the render, so its state updates never run inside the effect.
    if (pending && online) void Promise.resolve().then(start);
  }, [pending, online, start, attempt]);

  if (meta === undefined) return { state: 'loading' };
  if (!pending) return { state: 'done' };
  if (meta.download.status !== 'running' && hasLocalData === undefined) return { state: 'loading' };
  const background =
    meta.download.status === 'running'
      ? meta.download.background === true
      : meta.download.status === 'idle' && hasLocalData === true;
  if (background) return { state: 'background' };
  const download = meta.download.status === 'running' ? meta.download : null;
  const received = download?.received ?? ZERO_TOTALS;
  const totals = download?.totals ?? null;
  const nothingYet = totals === null;
  const steps = downloadSteps(received, totals, failed);
  const retry = () => {
    if (navigator.onLine) void start();
  };
  const state = !online && nothingYet ? 'offline' : failed ? 'error' : 'running';
  return {
    state,
    steps,
    percent: percentOf(received, totals),
    failedStep: failed ? (steps.find((step) => step.status === 'failed')?.key ?? null) : null,
    retry,
  };
}
