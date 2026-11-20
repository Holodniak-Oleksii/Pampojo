import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  // On CI an API call takes 1-5 s, and each new page first waits for a sync pull of several calls.
  timeout: isCI ? 60_000 : 30_000,
  expect: { timeout: isCI ? 20_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // The CI server is a production build with a service worker; only the PWA suite lets it run.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: isCI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
