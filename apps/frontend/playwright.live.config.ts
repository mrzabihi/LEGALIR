import { defineConfig, devices } from "@playwright/test";

// Reuses an already-running dev server, so Playwright never has to boot one
// and never probes `/` to decide that it is up. This is the config to iterate
// against a live session with:
//
//   npx playwright test <spec> -c playwright.live.config.ts
//
// Deliberately not the default: there is no `webServer`, so it fails loudly
// when nothing is listening on :3000 instead of quietly starting a second
// server and running the specs against that.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env["PW_BASE_URL"] ?? "http://localhost:3000",
    trace: "off",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: undefined,
});
