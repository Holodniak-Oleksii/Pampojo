import { existsSync } from 'node:fs';
import { vi } from 'vitest';

// CI passes real env vars; locally they come from .env.local.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// Handler tests call route handlers directly, outside the Next.js request scope `connection()` needs.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}));
