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
    // Setup project signs each persona in once and saves cookies to .auth/<role>.json.
    // Specs opt in via `test.use({ storageState: authStateFile('member') })` from
    // tests/e2e/auth.setup.ts. See docs/audits/E2E_TIMEOUT_ROOT_CAUSE.md §6.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
      testIgnore: [],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/mobile/**', '**/auth.setup.ts'],
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/mobile/**',
      dependencies: ['setup'],
    },
  ],
})
