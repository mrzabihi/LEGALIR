import { describe, it, expect, beforeEach } from "vitest";
import {
  detectPlatform,
  detectBrowser,
  isIosSafari,
  getIosGuideVariant,
  getAndroidGuideVariant,
  isDismissed,
  readDismissedAt,
  writeDismissedAt,
  clearDismissed,
  shouldShowInstallBanner,
  PWA_DISMISS_KEY,
  PWA_DISMISS_DAYS,
} from "@/lib/pwa/install";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
  ipadDesktopClass:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

describe("detectPlatform", () => {
  it("detects iOS from iPhone/iPad UAs", () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe("ios");
    expect(detectPlatform(UA.iphoneChrome)).toBe("ios");
  });

  it("treats a desktop-class Macintosh UA with touch as iPadOS", () => {
    expect(detectPlatform(UA.ipadDesktopClass, 5)).toBe("ios");
    // A real Mac has no touch points → desktop.
    expect(detectPlatform(UA.ipadDesktopClass, 0)).toBe("desktop");
  });

  it("detects Android and desktop", () => {
    expect(detectPlatform(UA.androidChrome)).toBe("android");
    expect(detectPlatform(UA.windowsChrome)).toBe("desktop");
  });

  it("returns other for an empty UA", () => {
    expect(detectPlatform("")).toBe("other");
  });
});

describe("detectBrowser", () => {
  it("distinguishes spoofing browsers from Chrome", () => {
    expect(detectBrowser(UA.androidSamsung)).toBe("samsung");
    expect(detectBrowser(UA.androidFirefox)).toBe("firefox");
    expect(detectBrowser(UA.androidChrome)).toBe("chrome");
    expect(detectBrowser(UA.iphoneSafari)).toBe("safari");
    expect(detectBrowser(UA.iphoneChrome)).toBe("chrome");
  });
});

describe("isIosSafari", () => {
  it("is true only for Safari on iOS", () => {
    expect(isIosSafari(UA.iphoneSafari)).toBe(true);
    expect(isIosSafari(UA.iphoneChrome)).toBe(false);
    expect(isIosSafari(UA.androidChrome)).toBe(false);
  });

  it("maps to the correct iOS guide variant", () => {
    expect(getIosGuideVariant(UA.iphoneSafari)).toBe("safari");
    expect(getIosGuideVariant(UA.iphoneChrome)).toBe("other-browser");
  });
});

describe("getAndroidGuideVariant", () => {
  it("maps browsers to their menu wording", () => {
    expect(getAndroidGuideVariant(UA.androidChrome)).toBe("chrome");
    expect(getAndroidGuideVariant(UA.androidFirefox)).toBe("firefox");
    expect(getAndroidGuideVariant(UA.androidSamsung)).toBe("samsung");
  });
});

describe("dismissal persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is not dismissed when nothing is stored", () => {
    expect(readDismissedAt()).toBeNull();
    expect(isDismissed(Date.now())).toBe(false);
  });

  it("snoozes for 7 days after a dismissal", () => {
    const now = 1_700_000_000_000;
    writeDismissedAt(now);
    expect(readDismissedAt()).toBe(now);
    expect(isDismissed(now)).toBe(true);
    // 6 days later — still snoozed.
    expect(isDismissed(now + 6 * 24 * 60 * 60 * 1000)).toBe(true);
    // 7 days later — the window has closed.
    expect(isDismissed(now + PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("clears the snooze", () => {
    writeDismissedAt(Date.now());
    clearDismissed();
    expect(localStorage.getItem(PWA_DISMISS_KEY)).toBeNull();
    expect(isDismissed(Date.now())).toBe(false);
  });

  it("ignores a corrupt stored value", () => {
    localStorage.setItem(PWA_DISMISS_KEY, "not-a-number");
    expect(readDismissedAt()).toBeNull();
    expect(isDismissed(Date.now())).toBe(false);
  });
});

describe("shouldShowInstallBanner", () => {
  const base = {
    standalone: false,
    installed: false,
    dismissed: false,
    platform: "android" as const,
    canPrompt: false,
  };

  it("shows on Android and iOS when not installed/dismissed", () => {
    expect(shouldShowInstallBanner(base)).toBe(true);
    expect(shouldShowInstallBanner({ ...base, platform: "ios" })).toBe(true);
  });

  it("never shows when standalone, installed, or dismissed", () => {
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, installed: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissed: true })).toBe(false);
  });

  it("stays off on desktop (mobile-only affordance)", () => {
    expect(shouldShowInstallBanner({ ...base, platform: "desktop" })).toBe(false);
    expect(
      shouldShowInstallBanner({ ...base, platform: "desktop", canPrompt: true })
    ).toBe(false);
  });
});
