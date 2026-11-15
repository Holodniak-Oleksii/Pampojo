import { STORAGE_PERSIST_KEY } from './constants';

/**
 * Asks the browser to keep this site's storage, once per device. The flag is set before the call,
 * so a slow or rejected request is never repeated.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (localStorage.getItem(STORAGE_PERSIST_KEY)) return;
    if (!navigator.storage?.persist) return;
    localStorage.setItem(STORAGE_PERSIST_KEY, '1');
    await navigator.storage.persist();
  } catch {
    // Storage blocked or the request failed: nothing to show the user.
  }
}
