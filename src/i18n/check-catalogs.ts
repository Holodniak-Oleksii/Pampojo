// Plain module without imports: scripts/i18n-check.ts runs it directly with Node.
type Catalog = Record<string, string>;

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

export function checkCatalogs(en: Catalog, uk: Catalog): string[] {
  const problems: string[] = [];
  const ukForms = new Intl.PluralRules('uk').resolvedOptions().pluralCategories;
  const pluralBases = new Set<string>();

  for (const key of Object.keys(en)) {
    const match = key.match(PLURAL_SUFFIX);
    if (match) {
      pluralBases.add(key.slice(0, -match[0].length));
      continue;
    }
    if (!(key in uk)) problems.push(`uk is missing "${key}"`);
    else if (!uk[key]?.trim()) problems.push(`uk has an empty value for "${key}"`);
  }

  for (const base of pluralBases) {
    for (const form of ukForms) {
      const key = `${base}_${form}`;
      if (!(key in uk)) problems.push(`uk is missing plural form "${key}"`);
      else if (!uk[key]?.trim()) problems.push(`uk has an empty value for "${key}"`);
    }
  }

  return problems;
}
