import { CONNECTIVITY_PING_MS } from '@/constants/sync';
import { requestSync } from '@/services/sync/request-sync';

const HEALTH_PATH = '/api/v1/health';

const listeners = new Set<() => void>();
// `navigator.onLine` can be true with no real connection, so a failed request starts a health ping.
let pingFailing = false;
let pingTimer: ReturnType<typeof setTimeout> | undefined;
let windowBound = false;

function notify() {
  for (const listener of listeners) listener();
}

function stopPing() {
  clearTimeout(pingTimer);
  pingTimer = undefined;
}

async function ping(): Promise<void> {
  pingTimer = undefined;
  try {
    // Any answer, a 503 too, means that the network works.
    await fetch(HEALTH_PATH, { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    if (pingFailing) pingTimer = setTimeout(() => void ping(), CONNECTIVITY_PING_MS);
    return;
  }
  if (!pingFailing) return;
  pingFailing = false;
  notify();
  requestSync();
}

function onBrowserOnline() {
  if (pingFailing) {
    pingFailing = false;
    stopPing();
  }
  notify();
}

function bindWindow() {
  if (windowBound || typeof window === 'undefined') return;
  windowBound = true;
  window.addEventListener('online', onBrowserOnline);
  window.addEventListener('offline', notify);
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine && !pingFailing;
}

export function subscribeConnectivity(listener: () => void): () => void {
  bindWindow();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A request failed with no answer. The app is offline until the health ping gets an answer. */
export function reportNetworkFailure(): void {
  if (pingFailing || typeof window === 'undefined') return;
  bindWindow();
  pingFailing = true;
  notify();
  void ping();
}

/** Tests share one module instance, so each test starts online. */
export function resetConnectivity(): void {
  pingFailing = false;
  stopPing();
  notify();
}
