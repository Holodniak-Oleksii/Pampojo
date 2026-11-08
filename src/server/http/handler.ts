import 'server-only';
import { connection } from 'next/server';
import { z } from 'zod';
import { DomainError, errorBody, statusForCode } from './errors';
import { json } from './response';

type Schema = z.ZodType;
type Parsed<S> = S extends Schema ? z.infer<S> : undefined;

export interface HandlerOptions<
  P extends Schema | undefined,
  Q extends Schema | undefined,
  B extends Schema | undefined,
> {
  // Spec 03 adds 'required' together with the session and userId.
  auth: 'none';
  params?: P;
  query?: Q;
  body?: B;
}

export interface HandlerContext<P, Q, B> {
  request: Request;
  params: P;
  query: Q;
  body: B;
}

interface RouteContext {
  params?: Promise<Record<string, string | string[] | undefined>>;
}

class ValidationFailed extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('Validation failed');
  }
}

function parseWith<S extends Schema | undefined>(schema: S | undefined, input: unknown): Parsed<S> {
  if (!schema) return undefined as Parsed<S>;
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationFailed(result.error.issues);
  return result.data as Parsed<S>;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationFailed([
      { code: 'custom', path: [], message: 'Body is not valid JSON', input: text },
    ]);
  }
}

export function withHandler<
  P extends Schema | undefined = undefined,
  Q extends Schema | undefined = undefined,
  B extends Schema | undefined = undefined,
>(
  options: HandlerOptions<P, Q, B>,
  fn: (ctx: HandlerContext<Parsed<P>, Parsed<Q>, Parsed<B>>) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext = {}): Promise<Response> => {
    // API responses are per request; with Cache Components this keeps handlers out of prerendering.
    await connection();
    try {
      const params = parseWith<P>(options.params, (await context.params) ?? {});
      const query = parseWith<Q>(
        options.query,
        Object.fromEntries(new URL(request.url).searchParams),
      );
      const body = parseWith<B>(options.body, options.body ? await readJson(request) : undefined);
      return await fn({ request, params, query, body });
    } catch (error) {
      if (error instanceof ValidationFailed) {
        return json(errorBody('VALIDATION_FAILED', 'Validation failed', error.issues), {
          status: 400,
        });
      }
      if (error instanceof DomainError) {
        return json(errorBody(error.code, error.message, error.details), {
          status: statusForCode(error.code),
        });
      }
      console.error('[api]', error);
      return json(errorBody('INTERNAL', 'Internal error'), { status: 500 });
    }
  };
}
