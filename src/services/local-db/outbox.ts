import { ApiError, http } from '@/api/http';
import type { OutboxEntry, PampojoDb } from './db';

export type NewOutboxEntry = Pick<OutboxEntry, 'method' | 'path' | 'body'>;

/** Call only inside a repository transaction, so the local write and its entry commit together. */
export async function enqueue(db: PampojoDb, entry: NewOutboxEntry): Promise<void> {
  await db.outbox.add({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

const events = new EventTarget();

/** Tells the outbox runner that new entries are waiting. */
export function notifyOutbox(): void {
  events.dispatchEvent(new Event('enqueued'));
}

export function onOutboxEnqueued(listener: () => void): () => void {
  events.addEventListener('enqueued', listener);
  return () => events.removeEventListener('enqueued', listener);
}

export type FlushResult = 'done' | 'failed' | 'busy';

export interface FlushOptions {
  onDropped?: (entry: OutboxEntry, error: ApiError) => void;
  onSent?: (entry: OutboxEntry) => void;
}

/** 4xx means the server will never accept the entry; 401 waits for the user to sign in again. */
function isPermanent(error: unknown): error is ApiError {
  return (
    error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401
  );
}

async function drain(db: PampojoDb, { onDropped, onSent }: FlushOptions): Promise<FlushResult> {
  for (;;) {
    const entry = await db.outbox.orderBy('seq').first();
    if (!entry || entry.seq === undefined) return 'done';
    try {
      await http(entry.path, { method: entry.method, body: entry.body });
      await db.outbox.delete(entry.seq);
      onSent?.(entry);
    } catch (error) {
      if (isPermanent(error)) {
        await db.outbox.delete(entry.seq);
        onDropped?.(entry, error);
        continue;
      }
      await db.outbox.update(entry.seq, { attempts: entry.attempts + 1 });
      return 'failed';
    }
  }
}

const flushing = new Set<string>();

/** Sends the entries in order. Single flight per database across tabs (Web Locks) and in this tab. */
export async function flushOutbox(db: PampojoDb, options: FlushOptions = {}): Promise<FlushResult> {
  const lockName = `${db.name}-outbox`;
  if (flushing.has(lockName)) return 'busy';
  flushing.add(lockName);
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) =>
        lock ? drain(db, options) : ('busy' as const),
      );
    }
    return await drain(db, options);
  } finally {
    flushing.delete(lockName);
  }
}

export function pendingCount(db: PampojoDb): Promise<number> {
  return db.outbox.count();
}
