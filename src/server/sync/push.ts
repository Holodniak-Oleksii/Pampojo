import 'server-only';
import type { z } from 'zod';
import { SYNC_MUTATION_TYPE, SYNC_PUSH_STATUS, type SyncMutationType } from '@/constants/sync';
import { getDb } from '@/server/db/client';
import { DomainError, statusForCode } from '@/server/http/errors';
import { deleteMeasurement, putMeasurement } from '@/server/measurements/service';
import { deleteSet, patchSession, patchSet, putSession, putSet } from '@/server/sessions/service';
import { putMeasurementInputSchema } from '@/shared/schemas/measurement';
import {
  patchSessionInputSchema,
  patchSetInputSchema,
  putSessionInputSchema,
  putSetInputSchema,
} from '@/shared/schemas/session';
import type { PushResult, SyncMutation } from '@/shared/schemas/sync';
import { findAppliedIds, insertApplied, type Executor, type Tx } from './queries';

interface MutationHandler {
  schema: z.ZodType | null;
  apply: (userId: string, entityId: string, payload: never, tx: Tx) => Promise<unknown>;
}

const handler = <S extends z.ZodType | null>(
  schema: S,
  apply: (
    userId: string,
    entityId: string,
    payload: S extends z.ZodType ? z.infer<S> : undefined,
    tx: Tx,
  ) => Promise<unknown>,
): MutationHandler => ({ schema, apply: apply as MutationHandler['apply'] });

/** Each type calls the same service function as its REST endpoint, so validation is the same. */
export const MUTATION_HANDLERS: Record<SyncMutationType, MutationHandler> = {
  [SYNC_MUTATION_TYPE.SESSION_PUT]: handler(putSessionInputSchema, (userId, id, payload, tx) =>
    putSession(userId, id, payload, tx),
  ),
  [SYNC_MUTATION_TYPE.SESSION_PATCH]: handler(patchSessionInputSchema, (userId, id, payload, tx) =>
    patchSession(userId, id, payload, tx),
  ),
  [SYNC_MUTATION_TYPE.SET_PUT]: handler(putSetInputSchema, (userId, id, payload, tx) =>
    putSet(userId, id, payload, tx),
  ),
  [SYNC_MUTATION_TYPE.SET_PATCH]: handler(patchSetInputSchema, (userId, id, payload, tx) =>
    patchSet(userId, id, payload, tx),
  ),
  [SYNC_MUTATION_TYPE.SET_DELETE]: handler(null, (userId, id, _payload, tx) =>
    deleteSet(userId, id, tx),
  ),
  [SYNC_MUTATION_TYPE.MEASUREMENT_PUT]: handler(
    putMeasurementInputSchema,
    (userId, id, payload, tx) => putMeasurement(userId, id, payload, tx),
  ),
  [SYNC_MUTATION_TYPE.MEASUREMENT_DELETE]: handler(null, (userId, id, _payload, tx) =>
    deleteMeasurement(userId, id, tx),
  ),
};

class Rejected extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
  return code(error) === '23505' || code((error as { cause?: unknown })?.cause) === '23505';
}

/** A domain error the client caused (4xx) rejects one mutation; anything else fails the batch. */
function rejectionCode(error: unknown): string | null {
  if (error instanceof Rejected) return error.code;
  if (error instanceof DomainError) {
    const status = statusForCode(error.code);
    return status >= 400 && status < 500 ? error.code : null;
  }
  return null;
}

async function applyOne(userId: string, mutation: SyncMutation, tx: Tx): Promise<void> {
  const { schema, apply } = MUTATION_HANDLERS[mutation.type];
  let payload: unknown = undefined;
  if (schema) {
    const parsed = schema.safeParse(mutation.payload);
    if (!parsed.success) throw new Rejected('VALIDATION_FAILED');
    payload = parsed.data;
  }
  await apply(userId, mutation.entityId, payload as never, tx);
  try {
    await insertApplied(tx, { id: mutation.id, userId, type: mutation.type });
  } catch (error) {
    // The id is taken by another user's mutation.
    if (isUniqueViolation(error)) throw new Rejected('CONFLICT');
    throw error;
  }
}

/**
 * Applies the mutations in order in one transaction, one savepoint each. A replayed id is
 * acknowledged without a second apply, and a rejected mutation does not stop the batch.
 */
export async function applyPush(
  userId: string,
  mutations: readonly SyncMutation[],
  db: Executor = getDb(),
): Promise<PushResult[]> {
  return db.transaction(async (tx) => {
    const applied = await findAppliedIds(
      tx,
      userId,
      mutations.map((item) => item.id),
    );
    const results: PushResult[] = [];
    for (const mutation of mutations) {
      if (applied.has(mutation.id)) {
        results.push({ id: mutation.id, status: SYNC_PUSH_STATUS.DUPLICATE });
        continue;
      }
      try {
        await tx.transaction((savepoint) => applyOne(userId, mutation, savepoint));
        applied.add(mutation.id);
        results.push({ id: mutation.id, status: SYNC_PUSH_STATUS.APPLIED });
      } catch (error) {
        const code = rejectionCode(error);
        if (code === null) throw error;
        results.push({ id: mutation.id, status: SYNC_PUSH_STATUS.REJECTED, error: code });
      }
    }
    return results;
  });
}
