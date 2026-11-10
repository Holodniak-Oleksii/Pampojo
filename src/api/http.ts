import { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, status = 0, message: string = code, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const NETWORK_ERROR = 'NETWORK';

interface HttpOptions<S extends z.ZodType | undefined> {
  method?: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  schema?: S;
}

type Result<S> = S extends z.ZodType ? z.infer<S> : unknown;

const MAX_RETRIES = 2;
const RETRY_STATUSES = new Set([408, 503]);

// Only writes that are safe to repeat may be retried (docs/development/request-safety.md).
function isRetryable(method: string, headers: Record<string, string>): boolean {
  return method === 'GET' || method === 'PUT' || 'Idempotency-Key' in headers;
}

function backoff(attempt: number): Promise<void> {
  const delay = 200 * 2 ** attempt + Math.random() * 100;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

async function toApiError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null);
  const parsed = errorEnvelopeSchema.safeParse(data);
  if (!parsed.success) return new ApiError(`HTTP_${response.status}`, response.status);
  const { code, message, details } = parsed.data.error;
  return new ApiError(code, response.status, message ?? code, details);
}

export async function http<S extends z.ZodType | undefined = undefined>(
  path: string,
  { method = 'GET', body, headers = {}, schema }: HttpOptions<S> = {},
): Promise<Result<S>> {
  const retryable = isRetryable(method, headers);
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      if (retryable && attempt < MAX_RETRIES) {
        await backoff(attempt);
        continue;
      }
      throw new ApiError(NETWORK_ERROR);
    }
    if (response.ok) {
      const data: unknown = await response.json();
      return (schema ? schema.parse(data) : data) as Result<S>;
    }
    if (retryable && RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await backoff(attempt);
      continue;
    }
    throw await toApiError(response);
  }
}
