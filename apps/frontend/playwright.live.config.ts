import { defineConfig, devices } from "@playwright/test";

// TEMP config (not committed) — reuses the already-running dev server so
// Playwright never probes `/` (which 500s in this workspace).
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
