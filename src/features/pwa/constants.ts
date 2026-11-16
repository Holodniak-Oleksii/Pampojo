// No browser-only code here: the service worker bundle imports this file too.

export const INSTALL_CARD_HIDDEN_UNTIL_KEY = 'pampojo:install-card-hidden-until';
export const STORAGE_PERSIST_KEY = 'pampojo:storage-persist-requested';
export const INSTALL_CARD_SNOOZE_DAYS = 7;
export const PAGES_CACHE = 'pampojo-pages';
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

export function isAppPagePath(pathname: string): boolean {
  return APP_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
