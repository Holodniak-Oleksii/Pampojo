import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getSession } from './session';

// One lookup per request, shared by the (app) layout gate and the page.
export const getRequestSession = cache(async () => getSession(await headers()));
