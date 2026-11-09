import { createAuthClient } from 'better-auth/react';

// Same-origin client; the only place the UI talks to /api/auth.
export const authClient = createAuthClient();
