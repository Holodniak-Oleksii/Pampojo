import 'server-only';

export class DomainError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string = code, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

// Domain specs add their codes here, so every status mapping lives in one table.
export const ERROR_STATUS: Record<string, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  PROFILE_NOT_FOUND: 404,
  EXERCISE_NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function errorBody(code: string, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function statusForCode(code: string): number {
  return ERROR_STATUS[code] ?? 500;
}
