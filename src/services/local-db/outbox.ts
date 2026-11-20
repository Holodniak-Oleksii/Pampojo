import type { OutboxEntry, PampojoDb } from './db';

export type NewOutboxEntry = Pick<OutboxEntry, 'type' | 'entityId' | 'payload'>;

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

/** Tells the sync runner that new entries are waiting. */
export function notifyOutbox(): void {
  events.dispatchEvent(new Event('enqueued'));
}

export function onOutboxEnqueued(listener: () => void): () => void {
  events.addEventListener('enqueued', listener);
  return () => events.removeEventListener('enqueued', listener);
}

export function pendingCount(db: PampojoDb): Promise<number> {
  return db.outbox.count();
}

/** Ids of the rows that have a change waiting in the outbox; pull must not overwrite them. */
export async function pendingEntityIds(db: PampojoDb): Promise<Set<string>> {
  return new Set((await db.outbox.orderBy('entityId').uniqueKeys()) as string[]);
}
