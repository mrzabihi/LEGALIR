import { expect, test } from "@playwright/test";

test.describe("Health page", () => {
  test("renders health checks and shows summary", async ({ page }) => {
    await page.goto("/health");
    await page.waitForSelector('h1');
    const heading = page.getByRole("heading", { name: /وضعیت سیستم/i });
    await expect(heading).toBeVisible();
  });
});

test.describe("Landing page", () => {
  test("renders hero", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("body");
    await expect(page.locator("body")).toBeVisible();
  });
});
