// ============================================================
// LEGALIR — PWA install detection (pure, dependency-free)
// ============================================================
// Everything here is a pure function of its inputs so it can be unit-tested
// without a browser. The React hook (use-install-prompt.ts) owns the live
// state; this module owns the *rules*.
//
// Two hard truths drive the design:
//   1. `beforeinstallprompt` only exists on Chromium (Android/desktop). iOS
//      Safari never fires it, so iOS can only ever be offered a *guide*.
//   2. There is no reliable "is this app installed?" API. We combine the
//      `display-mode: standalone` media query, iOS's `navigator.standalone`,
//      and the `appinstalled` event — and treat "installed" as best-effort.

export type PwaPlatform = "ios" | "android" | "desktop" | "other";

export type PwaBrowser =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "samsung"
  | "opera"
  | "other";

/** iOS can only be guided, never prompted. Safari is the happy path. */
export type IosGuideVariant = "safari" | "other-browser";

/** Android browsers that expose an in-menu "Install app" entry. */
export type AndroidGuideVariant = "chrome" | "firefox" | "samsung" | "other";

// ------------------------------------------------------------
// Platform / browser detection
// ------------------------------------------------------------

/**
 * Classify the platform from a user-agent string.
 *
 * iPadOS 13+ masquerades as desktop Safari ("Macintosh"), so a Macintosh UA
 * with touch points is treated as iOS. `maxTouchPoints` is passed in rather
 * than read from `navigator` to keep this pure.
 */
export function detectPlatform(ua: string, maxTouchPoints = 0): PwaPlatform {
  if (!ua) return "other";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ desktop-class UA.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}

/** Best-effort browser label. Order matters — Edge/Opera/Samsung spoof Chrome. */
export function detectBrowser(ua: string): PwaBrowser {
  if (!ua) return "other";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//i.test(ua)) return "edge";
  if (/OPR\/|Opera/i.test(ua)) return "opera";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/CriOS/i.test(ua)) return "chrome"; // Chrome on iOS
  if (/Chrome\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua)) return "safari";
  return "other";
}

/**
 * True only for Safari on iOS/iPadOS. On iOS every browser uses WebKit, but
 * only Safari exposes "Add to Home Screen" in the Share sheet — Chrome/Firefox
 * on iOS do not, so those users must be told to open Safari.
 */
export function isIosSafari(ua: string, maxTouchPoints = 0): boolean {
  if (detectPlatform(ua, maxTouchPoints) !== "ios") return false;
  // CriOS (Chrome), FxiOS (Firefox), EdgiOS (Edge), OPiOS (Opera) are not Safari.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export function getIosGuideVariant(ua: string, maxTouchPoints = 0): IosGuideVariant {
  return isIosSafari(ua, maxTouchPoints) ? "safari" : "other-browser";
}

export function getAndroidGuideVariant(ua: string): AndroidGuideVariant {
  const browser = detectBrowser(ua);
  if (browser === "chrome" || browser === "edge" || browser === "opera") return "chrome";
  if (browser === "firefox") return "firefox";
  if (browser === "samsung") return "samsung";
  return "other";
}

// ------------------------------------------------------------
// Standalone / installed detection
// ------------------------------------------------------------

/** `display-mode: standalone` — the standard signal (Android, desktop, iOS 16.4+). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

/** iOS Safari's legacy flag, still the only signal on older iOS. */
export function isIosStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** True when the app is running as an installed PWA (any platform). */
export function isStandalone(): boolean {
  return isStandaloneDisplay() || isIosStandalone();
}

// ------------------------------------------------------------
// Dismissal persistence (7-day snooze)
// ------------------------------------------------------------

export const PWA_DISMISS_KEY = "legalir-pwa-install-dismissed";
export const PWA_DISMISS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Epoch-ms of the last dismissal, or null if never dismissed / unreadable. */
export function readDismissedAt(storage?: Storage): number | null {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(PWA_DISMISS_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeDismissedAt(now: number, storage?: Storage): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(PWA_DISMISS_KEY, String(now));
  } catch {
    /* storage full / disabled — dismissal simply won't persist */
  }
}

export function clearDismissed(storage?: Storage): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.removeItem(PWA_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

/** True while the 7-day snooze window is still open. */
export function isDismissed(
  now: number,
  storage?: Storage,
  days = PWA_DISMISS_DAYS
): boolean {
  const at = readDismissedAt(storage);
  if (at === null) return false;
  return now - at < days * DAY_MS;
}

// ------------------------------------------------------------
// Banner decision
// ------------------------------------------------------------

export interface BannerDecisionInput {
  /** Running as an installed PWA. */
  standalone: boolean;
  /** `appinstalled` fired this session. */
  installed: boolean;
  /** Within the 7-day snooze window. */
  dismissed: boolean;
  platform: PwaPlatform;
  /** A captured `beforeinstallprompt` is ready to fire. */
  canPrompt: boolean;
}

/**
 * Whether the install banner should be visible.
 *
 * The banner is mobile-only (the requirement is a mobile install affordance).
 * On Android it shows when either a native prompt is ready *or* we can offer a
 * menu-based guide; on iOS it always shows a guide (never a native prompt).
 */
export function shouldShowInstallBanner(input: BannerDecisionInput): boolean {
  const { standalone, installed, dismissed, platform } = input;
  if (standalone || installed || dismissed) return false;
  if (platform === "ios") return true;
  if (platform === "android") return true; // prompt or guide — both are useful
  // Desktop/other: the requirement is a *mobile* install affordance, so the
  // banner stays off here even when a native prompt exists.
  return false;
}
