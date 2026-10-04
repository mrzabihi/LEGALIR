/**
 * ============================================================
 * LEGALIR — tenant-rights-guide article screenshot capture
 * ============================================================
 * Captures the rich legal article at mobile and desktop widths so the
 * rendered page can be reconciled against the docx source.
 */

import { test, expect } from "@playwright/test";

const SLUG = "/blog/tenant-rights-guide";

test("capture tenant-rights-guide at mobile and desktop", async ({ page }) => {
  // Desktop — hero
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(SLUG);
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/__shots__/trg-desktop-hero.png" });

  // Desktop — table section
  await page.getByRole("table").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/trg-desktop-table.png" });

  // Desktop — FAQ + CTA
  await page.getByText("پرسش‌های متداول").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/trg-desktop-faq.png" });

  // Desktop — related sources + services
  await page.getByText("منابع مرتبط").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/trg-desktop-related.png" });

  // Mobile — hero
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SLUG);
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/__shots__/trg-mobile-hero.png" });

  // Mobile — table (must scroll only inside the box, page must not overflow)
  await page.getByRole("table").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/trg-mobile-table.png" });

  // Mobile — checklist
  await page.getByText("چک‌لیست مستأجر حرفه‌ای").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/trg-mobile-checklist.png" });

  // Mobile — the page must not overflow the viewport horizontally; only the
  // table box may scroll internally.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("blog list shows the tenant-rights-guide card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blog");
  const card = page.getByRole("link", { name: /راهنمای جامع حقوق مستأجر/ }).first();
  await card.waitFor({ timeout: 15_000 });
  await expect(card).toHaveAttribute("href", "/blog/tenant-rights-guide");
});
