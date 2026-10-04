/**
 * ============================================================
 * LEGALIR — PWA install banner E2E
 * ============================================================
 * Verifies the mobile install affordance in a real Chromium browser:
 *   • Android: a captured `beforeinstallprompt` fires only on tap,
 *   • Android without a prompt: a browser-specific menu guide is shown,
 *   • iOS Safari: the Share → Add to Home Screen guide is shown,
 *   • «بعداً» snoozes the banner for 7 days (persisted),
 *   • standalone (installed) mode never shows the banner.
 *
 * The native install dialog itself cannot be driven from Playwright — that
 * needs a real device — so we assert the *event* is fired, not the OS UI.
 */

import { test, expect, type Page } from "@playwright/test";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const BANNER = "[data-pwa-install-banner]";

/** Dispatch a synthetic beforeinstallprompt and record whether prompt() ran. */
async function fireBeforeInstallPrompt(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __promptCalled?: boolean }).__promptCalled = false;
    const e = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
    };
    e.prompt = () => {
      (window as unknown as { __promptCalled?: boolean }).__promptCalled = true;
      return Promise.resolve();
    };
    e.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(e);
  });
}

test.describe("Android install banner", () => {
  test.use({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });

  test("shows the banner and fires the native prompt only on tap", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible();
    await expect(
      banner.getByText("لیگالیر را به صفحه اصلی گوشی اضافه کنید")
    ).toBeVisible();

    await fireBeforeInstallPrompt(page);

    // Nothing fires until the user taps.
    expect(
      await page.evaluate(
        () => (window as unknown as { __promptCalled?: boolean }).__promptCalled
      )
    ).toBe(false);

    await banner.getByRole("button", { name: /نصب لیگالیر/ }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __promptCalled?: boolean }).__promptCalled
      )
    ).toBe(true);
  });

  test("shows a menu guide when no native prompt is available", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: /نصب لیگالیر/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Install app");
  });

  test("«بعداً» snoozes the banner for 7 days", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "بعداً" }).click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(() =>
      localStorage.getItem("legalir-pwa-install-dismissed")
    );
    expect(stored).not.toBeNull();

    // A reload within the snooze window keeps it hidden.
    await page.reload();
    await expect(page.locator(BANNER)).toBeHidden();
  });
});

test.describe("iOS install guide", () => {
  test.use({ userAgent: IOS_SAFARI_UA, viewport: { width: 390, height: 844 } });

  test("shows the Share → Add to Home Screen guide", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: /نصب لیگالیر/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Share");
    await expect(dialog).toContainText("Add to Home Screen");
  });
});

test.describe("standalone (installed) mode", () => {
  test.use({ userAgent: ANDROID_UA, viewport: { width: 390, height: 844 } });

  test("never shows the banner when running standalone", async ({ page }) => {
    // Force the display-mode media query to report standalone.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = ((query: string) => {
        if (query.includes("display-mode: standalone")) {
          /* eslint-disable @typescript-eslint/no-empty-function */
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList;
          /* eslint-enable @typescript-eslint/no-empty-function */
        }
        return original(query);
      }) as typeof window.matchMedia;
    });

    await page.goto("/");
    await expect(page.locator(BANNER)).toBeHidden();
  });
});
