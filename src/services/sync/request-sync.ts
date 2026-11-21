const events = new EventTarget();

/** Asks the sync runner for a sync now, for example after an online write or a session finish. */
export function requestSync(): void {
  events.dispatchEvent(new Event('sync'));
}

export function onSyncRequested(listener: () => void): () => void {
  events.addEventListener('sync', listener);
  return () => events.removeEventListener('sync', listener);
}

/** Tells listeners that a sync ended with `done`, so they can load what the pull brought. */
export function notifySyncDone(): void {
  events.dispatchEvent(new Event('done'));
}

export function onSyncDone(listener: () => void): () => void {
  events.addEventListener('done', listener);
  return () => events.removeEventListener('done', listener);
}
