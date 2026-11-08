import type { DeepPartial } from '@/types/utils';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = merge(base[key], value);
  }
  return result;
}

// Mock factories for API and domain shapes build on this; arrays in an override replace the base.
export function mergeMock<T>(base: T, override?: DeepPartial<T>): T {
  return merge(base, override) as T;
}
