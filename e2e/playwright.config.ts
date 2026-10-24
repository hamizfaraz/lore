import { defineConfig, devices } from '@playwright/test';

/** pnpm e2e:smoke — two browser contexts against BASE_URL (local stack or https://ourlore.tech), section 16. */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...devices['iPhone 14'],
  },
});
