import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seedCatalogSchema } from '../seed-schema';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('exercises.json', () => {
  const parsed = seedCatalogSchema.safeParse(JSON.parse(read('exercises.json')));

  it('passes the seed schema: required metadata, both locales, steps and mistakes', () => {
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it('has about 200 exercises with unique slugs', () => {
    const entries = parsed.data ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(180);
    expect(entries.length).toBeLessThanOrEqual(220);
    expect(new Set(entries.map((entry) => entry.slug)).size).toBe(entries.length);
  });

  it('includes the staples the catalog search relies on', () => {
    const names = new Map(
      (parsed.data ?? []).map((entry) => [entry.translations.en.name, entry.translations.uk.name]),
    );
    expect(names.get('Bench Press')).toBe('Жим штанги лежачи');
    expect(names.has('Back Squat')).toBe(true);
    expect(names.has('Deadlift')).toBe(true);
  });
});

describe('seed README', () => {
  it('records the license and the pinned dataset commit', () => {
    const readme = read('README.md');
    expect(readme).toContain('Unlicense');
    expect(readme).toContain('f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5');
  });
});
