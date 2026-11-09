interface BaseUrlEnv {
  BETTER_AUTH_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
}

export function authBaseUrl(env: BaseUrlEnv): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// A preview is reachable by its deployment URL and by its branch alias; both must pass the origin check.
export function authTrustedOrigins(env: BaseUrlEnv): string[] {
  const origins = [authBaseUrl(env)];
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_BRANCH_URL) {
    origins.push(`https://${env.VERCEL_BRANCH_URL}`);
  }
  return origins;
}
