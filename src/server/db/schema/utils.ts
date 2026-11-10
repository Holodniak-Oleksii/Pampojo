import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

// Check constraints are DDL, so the allowed values are inlined as literals rather than bound params.
export function inList(column: AnyColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ');
  return sql`${column} in (${sql.raw(literals)})`;
}

/** `column <@ array[...]`: every element of a text[] column is one of the allowed values. */
export function subsetOf(column: AnyColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ');
  return sql`${column} <@ array[${sql.raw(literals)}]::text[]`;
}
