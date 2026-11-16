// @ts-check
import { randomUUID } from 'node:crypto';
import { serwist } from '@serwist/next/config';

// Built after `next build` (see the build script) into public/sw.js, so the worker is a static file
// on every host instead of a route that needs the source and esbuild at request time.
export default serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // App pages are per-user and cached at runtime; only static files are precached.
  precachePrerendered: false,
  // The offline page changes with each deploy; the commit is its revision on Vercel.
  additionalPrecacheEntries: [
    { url: '/offline', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID() },
  ],
});
