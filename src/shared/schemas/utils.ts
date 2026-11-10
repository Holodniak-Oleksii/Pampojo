import { z } from 'zod';

export function enumOf<const T extends Record<string, string>>(
  values: T,
  params?: { error: string },
) {
  return z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]], params);
}

/** A query param that may repeat (`?muscle=a&muscle=b`): accepts one string or an array of them. */
export function repeatable<T extends z.ZodType<unknown, string>>(item: T, max: number) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(item).max(max));
}
