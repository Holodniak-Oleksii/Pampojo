import 'server-only';
import { getAuth } from './auth';

export type SessionData = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
>;

export async function getSession(headers: Headers): Promise<SessionData | null> {
  return getAuth().api.getSession({ headers });
}
