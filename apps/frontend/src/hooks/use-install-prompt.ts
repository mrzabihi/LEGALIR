// ============================================================
// LEGALIR — useInstallPrompt
// ============================================================
// Owns the live PWA-install state for the banner:
//   • captures `beforeinstallprompt` (Chromium) and holds it until the user
//     taps «نصب لیگالیر» — we never auto-prompt,
//   • reacts to `appinstalled` by hiding the banner for good,
//   • tracks `display-mode: standalone` so an installed app never shows it,
//   • persists a 7-day snooze when the user taps «بعداً».
//
// The pure rules live in @/lib/pwa/install; this hook only wires them to the
// browser. All listeners are cleaned up on unmount.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  detectBrowser,
  detectPlatform,
  getAndroidGuideVariant,
  getIosGuideVariant,
  isDismissed,
  isStandalone,
  shouldShowInstallBanner,
  writeDismissedAt,
  type AndroidGuideVariant,
  type IosGuideVariant,
  type PwaBrowser,
  type PwaPlatform,
} from "@/lib/pwa/install";

/** The non-standard Chromium event. Not in lib.dom, so we declare it. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export interface UseInstallPromptResult {
  /** The banner should be visible right now. */
  visible: boolean;
  platform: PwaPlatform;
  browser: PwaBrowser;
  /** A captured native prompt is ready to fire. */
  canPrompt: boolean;
  iosGuideVariant: IosGuideVariant;
  androidGuideVariant: AndroidGuideVariant;
  /** Fire the native prompt (Android/desktop). No-op when unavailable. */
  promptInstall: () => Promise<InstallOutcome>;
  /** Snooze the banner for 7 days. */
  dismiss: () => void;
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [platform, setPlatform] = useState<PwaPlatform>("other");
  const [browser, setBrowser] = useState<PwaBrowser>("other");
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // ---- Detect platform / browser / standalone on mount ----------------
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const touch = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
    setPlatform(detectPlatform(ua, touch));
    setBrowser(detectBrowser(ua));
    setStandalone(isStandalone());
    setDismissed(isDismissed(Date.now()));
  }, []);

  // ---- Capture beforeinstallprompt ------------------------------------
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Suppress the browser's own mini-infobar; we surface our own banner.
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      deferredPrompt.current = null;
      setCanPrompt(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ---- Track display-mode changes (e.g. installed then reopened) ------
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(isStandalone());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    const evt = deferredPrompt.current;
    if (!evt) return "unavailable";
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      // A prompt can only be used once.
      deferredPrompt.current = null;
      setCanPrompt(false);
      if (outcome === "accepted") {
        setInstalled(true);
        return "accepted";
      }
      return "dismissed";
    } catch {
      deferredPrompt.current = null;
      setCanPrompt(false);
      return "unavailable";
    }
  }, []);

  const dismiss = useCallback(() => {
    writeDismissedAt(Date.now());
    setDismissed(true);
  }, []);

  const visible = useMemo(
    () =>
      shouldShowInstallBanner({
        standalone,
        installed,
        dismissed,
        platform,
        canPrompt,
      }),
    [standalone, installed, dismissed, platform, canPrompt]
  );

  const iosGuideVariant = useMemo(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const touch = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
    return getIosGuideVariant(ua, touch);
  }, []);

  const androidGuideVariant = useMemo(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    return getAndroidGuideVariant(ua);
  }, []);

  return {
    visible,
    platform,
    browser,
    canPrompt,
    iosGuideVariant,
    androidGuideVariant,
    promptInstall,
    dismiss,
  };
}
