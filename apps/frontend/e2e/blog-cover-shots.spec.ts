/**
 * ============================================================
 * LEGALIR — blog cover thumbnail capture
 * ============================================================
 * Captures the tenant-rights-guide card on /blog to confirm the real
 * cover art renders in place of the gradient fallback.
 */

import { test, expect } from "@playwright/test";

test("tenant-rights-guide card shows the rent-house cover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blog");

  const card = page
    .locator("article")
    .filter({ hasText: "راهنمای جامع حقوق مستأجر" })
    .first();
  await card.waitFor({ timeout: 15_000 });

  const img = card.locator('img[src="/assets/blog/rent-house.jpg"]');
  await expect(img).toBeVisible();

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.screenshot({ path: "e2e/__shots__/blog-card-rent-house.png" });
});
