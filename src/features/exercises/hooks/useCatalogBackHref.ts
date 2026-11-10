import { useSyncExternalStore } from 'react';
import { CATALOG_PATH, CATALOG_QUERY_STORAGE_KEY } from '../constants';

function readQuery(): string {
  try {
    const value = sessionStorage.getItem(CATALOG_QUERY_STORAGE_KEY) ?? '';
    return value.startsWith('?') ? value : '';
  } catch {
    return '';
  }
}

/** The catalog URL with the last search and filters, so the back link returns to the same list. */
export function useCatalogBackHref(): string {
  const query = useSyncExternalStore(
    () => () => {},
    readQuery,
    () => '',
  );
  return `${CATALOG_PATH}${query}`;
}
