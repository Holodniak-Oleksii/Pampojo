import { authClient } from '@/api/auth';
import { deletePageCaches } from '@/features/pwa';
import { deleteAllLocalDbs } from '@/services/local-db';
import { navigateAfterAuth } from './utils';

// Drafts may hold body data; they must not outlive the session on a shared device.
const DRAFT_KEY_PREFIX = 'pampojo:onboarding:';

function clearOnboardingDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFT_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode); there is nothing to clear then.
  }
}

/**
 * Ends the session and deletes the local data of this device. Returns false on a network failure:
 * the cookie is still there, so `/` would bounce straight back, and the caller allows a retry.
 */
export async function signOutAndClear(): Promise<boolean> {
  try {
    await authClient.signOut();
  } catch {
    return false;
  }
  // After a server answer the session is gone (Better Auth clears the cookie even on an error).
  clearOnboardingDrafts();
  await Promise.all([deleteAllLocalDbs(), deletePageCaches()]);
  navigateAfterAuth('/');
  return true;
}
