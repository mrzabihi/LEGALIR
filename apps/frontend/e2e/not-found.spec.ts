/**
 * ============================================================
 * LEGALIR — 404 page E2E
 * ============================================================
 * Opens a real invalid route and verifies the shipped 404:
 *   • the illustration loads from /legalir-404.png,
 *   • the exact Persian copy and both buttons render,
 *   • «صفحه خانه» goes home, «برگشت» goes back when there is history
 *     and falls back home when the bad URL was opened directly,
 *   • no horizontal scroll on mobile or desktop,
 *   • the image is capped at ~800px on desktop,
 *   • the route answers with HTTP 404.
 */

import { test, expect } from "@playwright/test";

const BAD = "/this-route-does-not-exist-404";
const IMG = /تیم حقوقی لیگالیر/;

test.describe("404 page", () => {
  test("answers with HTTP 404", async ({ page }) => {
    const res = await page.goto(BAD);
    expect(res?.status()).toBe(404);
  });

  test("renders the illustration, exact copy and both buttons", async ({ page }) => {
    await page.goto(BAD);

    const img = page.getByRole("img", { name: IMG });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", "/legalir-404.png");
    // A broken image reports naturalWidth 0.
    const natural = await img.evaluate((el) => ({
      w: (el as HTMLImageElement).naturalWidth,
      h: (el as HTMLImageElement).naturalHeight,
    }));
    expect(natural.w).toBeGreaterThan(0);
    expect(natural.h).toBeGreaterThan(0);

    await expect(
      page.getByRole("heading", { level: 1, name: "این صفحه یافت نشد" })
    ).toBeVisible();
    await expect(
      page.getByText("تیم حقوقی لیگالیر هم هنوز پیداش نکرده!")
    ).toBeVisible();
    await expect(
      page.getByText("گزینه‌های زیر رو فعلاً باید انتخاب کنی:")
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "صفحه خانه" })).toBeVisible();
    await expect(page.getByRole("button", { name: "برگشت" })).toBeVisible();
  });

  test("«صفحه خانه» navigates to the site home", async ({ page }) => {
    await page.goto(BAD);
    await page.getByRole("link", { name: "صفحه خانه" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("«برگشت» falls back to home when the bad URL was opened directly", async ({
    page,
  }) => {
    await page.goto(BAD);
    await page.getByRole("button", { name: "برگشت" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("«برگشت» returns to the previous page when there is history", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto(BAD);
    await page.getByRole("button", { name: "برگشت" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("no horizontal scroll on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BAD);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("no horizontal scroll on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BAD);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("desktop: the illustration is capped at ~800px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BAD);
    const w = await page
      .getByRole("img", { name: IMG })
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(801);
    expect(w).toBeGreaterThan(600);
  });
});
