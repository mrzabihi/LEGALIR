/**
 * ============================================================
 * LEGALIR — blog cover thumbnail capture
 * ============================================================
 * Captures the tenant-rights-guide and check-bounced-legal-action cards
 * on /blog to confirm the real cover art renders in place of the
 * gradient fallback.
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

test("divorce-process-iran card shows the mutual-divorce cover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blog");

  const card = page
    .locator("article")
    .filter({ hasText: "مراحل طلاق توافقی" })
    .first();
  await card.waitFor({ timeout: 15_000 });

  const img = card.locator('img[src="/assets/blog/mutual-divorce.jpg"]');
  await expect(img).toBeVisible();

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.screenshot({ path: "e2e/__shots__/blog-card-mutual-divorce.png" });
});

test("check-bounced-legal-action card shows the cheque cover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blog");

  const card = page
    .locator("article")
    .filter({ hasText: "چک برگشتی" })
    .first();
  await card.waitFor({ timeout: 15_000 });

  const img = card.locator('img[src="/assets/blog/cheque.jpg"]');
  await expect(img).toBeVisible();

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.screenshot({ path: "e2e/__shots__/blog-card-cheque.png" });
});
