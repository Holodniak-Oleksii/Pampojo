export function isDevUiEnabled(env: { VERCEL_ENV?: string }): boolean {
  return env.VERCEL_ENV !== 'production';
}
