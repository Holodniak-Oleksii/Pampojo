import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // The real package throws outside React Server Components; tests import server code directly.
  'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    globals: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          setupFiles: ['./vitest.setup.node.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            ...alias,
            'next/image': fileURLToPath(new URL('./src/test/next-image-stub.tsx', import.meta.url)),
          },
        },
        // next/image and next/link read process.env, which does not exist in the browser runner.
        define: { 'process.env': JSON.stringify({ NODE_ENV: 'test' }) },
        test: {
          name: 'browser',
          include: ['src/**/__tests__/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
