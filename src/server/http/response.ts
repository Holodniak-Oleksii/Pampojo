import 'server-only';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'private, no-store');
  return Response.json(data, { ...init, headers });
}
