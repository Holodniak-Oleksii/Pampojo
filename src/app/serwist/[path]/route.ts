import { randomUUID } from 'node:crypto';
import { createSerwistRoute } from '@serwist/turbopack';
import { OFFLINE_PATH } from '@/features/pwa/constants';

// The offline page changes with each deploy; the commit is its revision on Vercel.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    // Files in public/ (the brand images the offline page uses) are precached by default.
    additionalPrecacheEntries: [{ url: OFFLINE_PATH, revision }],
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
  },
);
