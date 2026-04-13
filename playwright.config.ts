import { defineConfig, devices } from '@playwright/test';

const maximizedViewport = {
  width: 1920,
  height: 1080,
};

export default defineConfig({
  testDir: './tests',

  /**
   * Per-test timeout — generous for a live site. Individual expect() calls
   * use the shorter `expect.timeout` below.
   */
  timeout: 60_000,

  expect: {
    timeout: 20_000,
  },

  fullyParallel: true,

  /**
   * Throttle concurrency when hitting live NASA endpoints.
   * 50% of available cores locally; capped at 2 on CI to avoid rate limiting.
   */
  workers: process.env.CI ? 2 : '50%',

  /**
   * One retry on CI to absorb transient network flakiness from the live site.
   * Disabled locally so failures surface immediately during development.
   */
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // JUnit output for CI systems (GitHub Actions, Jenkins, etc.)
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],

  use: {
    /**
     * Base URL for Playwright's `request` fixture (APIRequestContext).
     * All `this.request.get('/search', …)` calls resolve against this.
     */
    baseURL: 'https://images-api.nasa.gov',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    /** Retain artifacts only on failure to keep report size manageable. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: maximizedViewport,
        screen: maximizedViewport,
        launchOptions: {
          args: ['--start-maximized'],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: maximizedViewport,
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: maximizedViewport,
      },
    },
  ],
});
