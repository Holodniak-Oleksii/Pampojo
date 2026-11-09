import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/server/db/client';
import * as authSchema from '@/server/db/schema/auth';
import { getEnv, type Env } from '@/server/env';
import { authBaseUrl, authTrustedOrigins } from './base-url';
import { isGoogleEnabled } from './google';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const ONE_DAY_SECONDS = 60 * 60 * 24;

export function createAuth(env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: authBaseUrl(env),
    trustedOrigins: authTrustedOrigins(env),
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    socialProviders:
      isGoogleEnabled(env) && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    // Without email verification, linking Google into a password account would allow pre-hijacking (spec 27).
    account: { accountLinking: { enabled: false } },
    session: { expiresIn: THIRTY_DAYS_SECONDS, updateAge: ONE_DAY_SECONDS },
    rateLimit: {
      // In-memory counters do not survive serverless instances, so they live in Postgres.
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 10 },
      },
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: env.NODE_ENV === 'production',
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { pampojoAuth?: Auth };

// Created on first use so imports never touch env or the database during build.
export function getAuth(): Auth {
  globalForAuth.pampojoAuth ??= createAuth(getEnv());
  return globalForAuth.pampojoAuth;
}
