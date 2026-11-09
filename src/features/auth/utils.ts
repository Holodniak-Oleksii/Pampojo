const MAX_NEXT_LENGTH = 512;

// Only same-origin relative paths are allowed as a post-login target, to prevent open redirects.
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_NEXT_LENGTH)
    return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value === '/api' || value.startsWith('/api/') || value.startsWith('/api?')) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}

export function nameFromEmail(email: string): string {
  return (email.split('@')[0] ?? email).slice(0, 64) || 'user';
}

// A full page load after sign-in or sign-out: the session changes which server gates and cached
// RSC payloads apply, and a soft navigation can briefly keep the previous route mounted.
export function navigateAfterAuth(path: string) {
  window.location.assign(path);
}
