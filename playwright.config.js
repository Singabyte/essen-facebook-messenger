/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */

module.exports = {
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 0,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'API Tests',
      testMatch: '**/*.test.js',
      use: {
        // API tests don't need browser
      },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
};