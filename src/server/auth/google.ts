interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  VERCEL_ENV?: string;
}

// Google OAuth needs exact redirect URIs, and every Vercel preview has its own domain.
export function isGoogleEnabled(env: GoogleEnv = processGoogleEnv()): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) && env.VERCEL_ENV !== 'preview';
}

function processGoogleEnv(): GoogleEnv {
  return {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
}
