import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/stubs/**'],

  maxFailures: process.env.CI ? 0 : 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: process.env.CI
    ? [['json', { outputFile: 'test-results.json' }], ['github']]
    : [
        ['json', { outputFile: 'test-results.json' }],
        ['line'],
        ['html', { open: 'never' }],
      ],

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: 'http://localhost:3004',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  outputDir: './test-results',

  webServer: [
    {
      command: 'cd ../../services/api-ts && bun dev',
      port: 7213,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'bun dev',
      port: 3004,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
