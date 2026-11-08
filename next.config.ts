import type { NextConfig } from 'next';
import { parseEnv } from './src/server/env-schema';

// `next start` only logs a failing instrumentation hook and keeps serving, so validate here to exit early.
parseEnv(process.env);

const nextConfig: NextConfig = {
  // Static pages cannot call new Date() under Cache Components; the footer copyright uses the build year.
  env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
