import { defineConfig, devices } from "@playwright/test";

// Two families of spec live in `e2e/` and they are not the same thing:
//
//   • the contract suite — the files with ordinary names. Each one asserts a
//     behaviour the product is supposed to have, and each one is expected to
//     be green on every run.
//   • the working files — `_*.spec.ts` (ad-hoc verification and audits) and
//     `*-shot(s).spec.ts` (screenshot capture, which asserts almost nothing).
//     These are a drawer of tools, not a gate. Several of them spend multiple
//     seconds per test in `waitForTimeout` purely so a chart has painted
//     before the shutter fires, and several of them need a seeded account.
//
// Running the drawer on every loop costs the whole suite ~2x its real size —
// measured at 564 tests across 75 files, of which 281 tests come from the
// `_`-prefixed files alone — and buries a real regression in screenshot
// noise. So the DEFAULT run is the contract suite; `npm run test:e2e:all`
// swaps in `playwright.all.config.ts`, which reuses this config with the
// ignore list emptied.
const WORKING_FILES = ["**/_*.spec.ts", "**/*-shot.spec.ts", "**/*-shots.spec.ts"];

export default defineConfig({
  testDir: "./e2e",
  testIgnore: WORKING_FILES,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npx next dev --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
