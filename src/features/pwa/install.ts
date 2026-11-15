import type { BeforeInstallPromptEvent, InstallPath } from './types';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
}

// Module state: `beforeinstallprompt` can fire before the components that use it mount.
let state: InstallState = { deferred: null, installed: false };
const listeners = new Set<() => void>();
let attached = false;

function set(next: Partial<InstallState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getInstallState(): InstallState {
  return state;
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Captures the install events once per page; safe to call repeatedly. */
export function attachInstallListeners(): () => void {
  if (attached) return () => {};
  attached = true;
  const onPrompt = (event: Event) => {
    event.preventDefault();
    set({ deferred: event as BeforeInstallPromptEvent });
  };
  const onInstalled = () => set({ installed: true, deferred: null });
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    attached = false;
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/** Safari on iPhone and iPad, where installing is a manual Share → Add to Home Screen. */
export function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function installPath(current: InstallState = state): InstallPath {
  if (current.installed || isStandalone()) return null;
  if (current.deferred) return 'prompt';
  return isIosBrowser() ? 'ios' : null;
}

/** Shows the browser's install dialog; an accepted install hides all install UI. */
export async function promptInstall(): Promise<void> {
  const event = state.deferred;
  if (!event) return;
  await event.prompt();
  const choice = await event.userChoice;
  set(choice.outcome === 'accepted' ? { installed: true, deferred: null } : { deferred: null });
}

/** For tests only. */
export function resetInstallState() {
  state = { deferred: null, installed: false };
  for (const listener of listeners) listener();
}
