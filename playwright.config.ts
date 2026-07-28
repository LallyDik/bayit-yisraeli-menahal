import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load the test-user credentials (.env.e2e) into process.env for the Node side
// (supabase-test-user, auth.setup, specs). The browser app gets VITE_* via
// `vite --mode e2e`.
dotenv.config({ path: '.env.e2e' });

const AUTH_FILE = 'e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 0 locally so a flaky acceptance test surfaces immediately; retry only in CI.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
    },
  ],
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
