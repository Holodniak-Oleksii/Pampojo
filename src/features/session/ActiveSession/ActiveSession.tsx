'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchSession } from '@/api/sessions';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { SESSION_SHELL_ID } from '@/features/pwa/constants';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocalSession, useSessionRepository } from '@/services/local-db';
import { SessionNotFound } from './SessionNotFound';
import { SessionSkeleton } from './SessionSkeleton';
import { SessionSummary } from './SessionSummary';
import { SessionView } from './SessionView';

const noSubscribe = () => () => {};
const idFromAddress = () => window.location.pathname.split('/').pop() ?? SESSION_SHELL_ID;
const shellId = () => SESSION_SHELL_ID;

/**
 * Offline, the service worker serves the shared session page for a session it has no copy of.
 * That page renders with the shell id, so the real id comes from the address bar.
 */
function useSessionId(routeId: string): string {
  const addressId = useSyncExternalStore(noSubscribe, idFromAddress, shellId);
  return routeId === SESSION_SHELL_ID ? addressId : routeId;
}

/** `/session/[id]`: the session from the device, or from the server when this device lacks it. */
export function ActiveSession({ sessionId: routeId }: { sessionId: string }) {
  const sessionId = useSessionId(routeId);
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const repository = useSessionRepository(userId);
  const data = useLocalSession(userId, sessionId);
  const [remote, setRemote] = useState<'idle' | 'missing'>('idle');
  const local = data?.session ?? null;

  useEffect(() => {
    if (data === undefined || data.session !== null || remote !== 'idle' || !online) return;
    let cancelled = false;
    fetchSession(sessionId)
      .then(async (session) => {
        if (cancelled) return;
        if (session) await repository.importRemote(session);
        else setRemote('missing');
      })
      .catch(() => {
        if (!cancelled) setRemote('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [data, online, remote, repository, sessionId]);

  const inProgress = local?.status === SESSION_STATUS.IN_PROGRESS;
  useEffect(() => {
    if (inProgress) void repository.activate(sessionId);
  }, [inProgress, repository, sessionId]);

  // Offline, a session the device does not have cannot be fetched, so it is not found.
  const missing = remote === 'missing' || !online;
  let content;
  if (data === undefined || (local === null && !missing)) content = <SessionSkeleton />;
  else if (!local || local.status === SESSION_STATUS.ABANDONED) content = <SessionNotFound />;
  else if (local.status === SESSION_STATUS.COMPLETED)
    content = <SessionSummary session={local} setLogs={data.setLogs} />;
  else content = <SessionView session={local} setLogs={data.setLogs} />;

  return <div className="min-h-dvh bg-background text-foreground">{content}</div>;
}
