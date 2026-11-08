import { z } from 'zod';

// No `server-only` here: next.config.ts imports this file to validate env before the server starts.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'Must be a postgres:// or postgresql:// URL',
  }),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  // Only names and Zod messages are printed; values may hold credentials.
  const lines = result.error.issues.map(
    (issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(
    ['Invalid environment variables:', ...lines, 'Check .env.local (see .env.example).'].join('\n'),
  );
}
