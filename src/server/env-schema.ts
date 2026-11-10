import { z } from 'zod';

// No `server-only` here: next.config.ts imports this file to validate env before the server starts.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'Must be a postgres:// or postgresql:// URL',
    }),
    BETTER_AUTH_SECRET: z.string().min(32, 'Must be at least 32 characters'),
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    SUPABASE_URL: z.url().optional(),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    VERCEL_URL: z.string().min(1).optional(),
    VERCEL_BRANCH_URL: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // Without it the auth base URL would fall back to localhost and break every production sign-in.
    if (env.VERCEL_ENV === 'production' && !env.BETTER_AUTH_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_URL'],
        message: 'Required on Vercel production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // `vercel pull` writes unavailable system variables (VERCEL_URL, …) as empty strings outside Vercel.
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(defined);
  if (result.success) return result.data;

  // Only names and Zod messages are printed; values may hold credentials.
  const lines = result.error.issues.map(
    (issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(
    ['Invalid environment variables:', ...lines, 'Check .env.local (see .env.example).'].join('\n'),
  );
}
