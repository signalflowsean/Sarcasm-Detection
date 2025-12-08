import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for e2e tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: process.env.CI ? "github" : "html",
  /* Shared settings for all the projects below */
  use: {
    /* Base URL for navigation */
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Take screenshot on failure */
    screenshot: "only-on-failure",
    /* Grant permissions for audio recording tests */
    permissions: ["microphone"],
    /* Use fake audio/video devices in headless mode for CI */
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    /* Uncomment for additional browser coverage */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  /* Timeout settings */
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
});
