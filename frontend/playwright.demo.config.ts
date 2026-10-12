import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-demo',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.BEACON_DEMO_URL ?? 'http://127.0.0.1:4173', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // This serves built static assets with the actual Pages security headers.
  // There is deliberately no API process, development proxy, or HMR connection.
  webServer: process.env.BEACON_DEMO_URL ? undefined : {
    command: 'node scripts/serve-demo.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false,
  },
});
