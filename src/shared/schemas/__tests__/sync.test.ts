import { describe, expect, it } from 'vitest';
import { SYNC_PUSH_BATCH_MAX } from '@/constants/sync';
import { pullQuerySchema, pushRequestSchema } from '../sync';

const mutation = (overrides: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  type: 'set.delete',
  entityId: '00000000-0000-4000-8000-000000000002',
  createdAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

describe('pushRequestSchema', () => {
  it('accepts a batch with an unparsed payload', () => {
    const parsed = pushRequestSchema.parse({
      mutations: [mutation({ type: 'set.patch', payload: { reps: 'not checked here' } })],
    });
    expect(parsed.mutations[0]?.payload).toEqual({ reps: 'not checked here' });
  });

  it('rejects an empty batch and a batch over the limit', () => {
    expect(pushRequestSchema.safeParse({ mutations: [] }).success).toBe(false);
    const many = Array.from({ length: SYNC_PUSH_BATCH_MAX + 1 }, () => mutation());
    expect(pushRequestSchema.safeParse({ mutations: many }).success).toBe(false);
  });

  it('rejects an unknown type and unknown keys', () => {
    expect(pushRequestSchema.safeParse({ mutations: [mutation({ type: 'x.y' })] }).success).toBe(
      false,
    );
    expect(pushRequestSchema.safeParse({ mutations: [mutation({ extra: 1 })] }).success).toBe(
      false,
    );
  });
});

describe('pullQuerySchema', () => {
  it('accepts no cursor and rejects a very long one', () => {
    expect(pullQuerySchema.parse({})).toEqual({});
    expect(pullQuerySchema.safeParse({ since: 'x'.repeat(600) }).success).toBe(false);
  });
});
