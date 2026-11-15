import Dexie from 'dexie';
import { closeLocalDbs, LOCAL_DB_PREFIX, PampojoDb } from './db';
import { flushOutbox, pendingCount } from './outbox';

async function localDbNames(): Promise<string[]> {
  try {
    return (await Dexie.getDatabaseNames()).filter((name) => name.startsWith(LOCAL_DB_PREFIX));
  } catch {
    return [];
  }
}

/** Sends every local outbox and returns how many entries could not be sent. */
export async function flushAllLocalDbs(): Promise<number> {
  let remaining = 0;
  for (const name of await localDbNames()) {
    const db = new PampojoDb(name);
    try {
      await flushOutbox(db);
      remaining += await pendingCount(db);
    } finally {
      db.close();
    }
  }
  return remaining;
}

/** Local gym data must not outlive the account session on a shared device. */
export async function deleteAllLocalDbs(): Promise<void> {
  closeLocalDbs();
  await Promise.all((await localDbNames()).map((name) => Dexie.delete(name)));
}
