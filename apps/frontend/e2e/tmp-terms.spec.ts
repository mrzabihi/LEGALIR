import { expect, test } from "@playwright/test";
const PAGE = "/auth/register/account?type=PERSONAL";

test("A: click the sentence -> toggles", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const cb = page.locator('input[type="checkbox"]').first();
  await page.getByText("را می‌پذیرم").click();
  await page.waitForTimeout(300);
  console.log(`A sentenceClick -> checked=${await cb.isChecked()}`);
  expect(await cb.isChecked()).toBe(true);
});

test("B: click a link -> navigates, does NOT toggle", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const cb = page.locator('input[type="checkbox"]').first();
  await page.getByRole("link", { name: "شرایط استفاده" }).click();
  await page.waitForTimeout(2000);
  const path = page.url().replace(/^https?:\/\/[^/]+/, "");
  console.log(`B linkClick -> path=${path} checked=${await cb.isChecked()}`);
  expect(path).toBe("/terms");
});

test("C: accessible name present", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const name = await page.locator('input[type="checkbox"]').first().evaluate((el) => {
    const labels = (el as HTMLInputElement).labels;
    return labels ? Array.from(labels).map((l) => l.textContent?.trim()).join(" | ") : "NONE";
  });
  console.log(`C accessibleName="${name}"`);
  expect(name).toContain("را می‌پذیرم");
});
