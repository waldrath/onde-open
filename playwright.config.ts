import {defineConfig} from '@playwright/test';

// End-to-end tests of the critical flows (see e2e/). They run against the
// production build, without a database: the catalogue falls back to the
// bundled channels and the DB-backed APIs are mocked per test (e2e/fixtures.ts).
const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: CI,
  // One retry on CI only: a test that needs it is reported as flaky, never hidden.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  // The page-swap tests navigate through several pages of ~2 300 channels:
  // they take ~25 s on a slow laptop, so leave headroom.
  timeout: 60_000,
  expect: {timeout: 7_000},
  reporter: CI ? [['github'], ['html', {open: 'never'}]] : [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL,
    // The app detects the viewer's country from the time zone and reads its
    // locale from a cookie (French by default): pin both for stable output.
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    // The service worker would answer requests before route interception.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Untagged tests run on both layouts; a test tagged @mobile or @desktop on that one only.
  projects: [
    {
      name: 'desktop',
      grepInvert: /@mobile/,
      use: {browserName: 'chromium', viewport: {width: 1440, height: 900}},
    },
    {
      name: 'mobile',
      grepInvert: /@desktop/,
      use: {browserName: 'chromium', viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true},
    },
  ],
  webServer: {
    // Builds, then serves the production build; E2E_SKIP_BUILD=1 reuses the
    // existing .next build for faster local reruns.
    command: 'node scripts/e2e-server.mjs',
    env: {E2E_PORT: String(PORT)},
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 300_000,
    // Errors (build or server) are shown; E2E_SERVER_LOGS=1 adds the build and server output.
    stdout: process.env.E2E_SERVER_LOGS ? 'pipe' : 'ignore',
    stderr: 'pipe',
  },
});
