// Plain module without imports: the seed runs it with Node, and the server and (later) Dexie share it.

/** Lowercase, diacritics removed, whitespace collapsed. Stored search columns and queries both use it. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
