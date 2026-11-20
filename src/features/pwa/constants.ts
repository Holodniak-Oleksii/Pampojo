// No browser-only code here: the service worker bundle imports this file too.

export const INSTALL_CARD_HIDDEN_UNTIL_KEY = 'pampojo:install-card-hidden-until';
export const STORAGE_PERSIST_KEY = 'pampojo:storage-persist-requested';
export const INSTALL_CARD_SNOOZE_DAYS = 7;
export const PAGES_CACHE = 'pampojo-pages';
export const IMAGES_CACHE = 'pampojo-images';
export const IMAGES_CACHE_MAX_ENTRIES = 600;
/** The exercise image URLs of Supabase Storage, public and signed. */
export const STORAGE_OBJECT_PATH = '/storage/v1/object/';
export const SW_URL = '/sw.js';
export const OFFLINE_PATH = '/offline';

/** App pages the service worker caches network-first. */
export const APP_PAGE_PREFIXES = [
  '/today',
  '/calendar',
  '/library',
  '/session',
  '/progress',
  '/profile',
] as const;

/**
 * The session page that the service worker serves for a session it has no copy of.
 * The page then reads the session id from the address bar.
 */
export const SESSION_SHELL_ID = '00000000-0000-0000-0000-000000000000';
export const SESSION_SHELL_PATH = `/session/${SESSION_SHELL_ID}`;

/** Pages that the app loads in the background, so they open offline before the first visit. */
export const WARM_PAGE_PATHS = [
  '/today',
  '/calendar',
  '/progress',
  '/library/workouts',
  '/library/exercises',
  '/profile',
  SESSION_SHELL_PATH,
] as const;

const SESSION_PAGE = /^\/session\/[0-9a-f-]{36}$/i;

export function isSessionPagePath(pathname: string): boolean {
  return SESSION_PAGE.test(pathname);
}

export function isAppPagePath(pathname: string): boolean {
  return APP_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
