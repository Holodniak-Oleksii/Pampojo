import { z } from 'zod';

export function enumOf<const T extends Record<string, string>>(
  values: T,
  params?: { error: string },
) {
  return z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]], params);
}
