import { defineConfig, devices } from "@playwright/test"

/**
 * E2E for the web target.
 *
 * Two modes:
 * - Default: `npm run test:e2e`  — builds `dist/` and serves it statically (deterministic).
 * - Dev loop: `npm run test:e2e:dev` — reuses a running `npm run dev:web` Metro server (fast iteration).
 */
const DEV = process.env.PW_E2E_DEV === "1"
const PORT = 8082

// Optional real-account credentials live in .env.local (gitignored).
try {
  process.loadEnvFile(".env.local")
} catch {
  // No .env.local — YAZIO account specs will skip.
}

export default defineConfig({
  testDir: "./e2e",
  // Serial: the suite shares one dev/prod server and each boot is heavy on this stack.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // Phone-first: this is a mobile app; tests run at phone dimensions.
    // (Must come AFTER the device spread AND stay out of `projects` — project-level
    // `use` would re-apply the device defaults and override this.)
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  },
  webServer: DEV
    ? {
        command: `node scripts/expo-cli.cjs start --web --port ${PORT}`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : {
        command: `node scripts/serve-dist.mjs`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 30_000,
      },
})
