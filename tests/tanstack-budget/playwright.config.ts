import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'budget.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  outputDir: '../../test-results/tanstack-budget',
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: '../../playwright-report/tanstack-budget',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: process.env.BUDGET_BASE_URL || 'http://127.0.0.1:8010',
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 1600, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
