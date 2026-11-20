const events = new EventTarget();

/** Asks the sync runner for a sync now, for example after an online write or a session finish. */
export function requestSync(): void {
  events.dispatchEvent(new Event('sync'));
}

export function onSyncRequested(listener: () => void): () => void {
  events.addEventListener('sync', listener);
  return () => events.removeEventListener('sync', listener);
}
