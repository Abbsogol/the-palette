import { defineConfig, devices } from '@playwright/test'
import { testEnv } from './tests/helpers/test-env.mjs'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: testEnv.NEXT_PUBLIC_APP_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'node scripts/with-test-env.mjs node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: `${testEnv.NEXT_PUBLIC_APP_URL}/help`,
    reuseExistingServer: false,
    timeout: 60000,
    env: testEnv,
  },
})
