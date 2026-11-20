import 'server-only';
import { DomainError } from '@/server/http/errors';

export const SYNC_ERROR = { INVALID_CURSOR: 'INVALID_CURSOR' } as const;

export function invalidCursor(): DomainError {
  return new DomainError(SYNC_ERROR.INVALID_CURSOR, 'Unknown sync cursor');
}
