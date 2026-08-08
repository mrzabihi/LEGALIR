"use client";

// ============================================================
// LEGALIR — AppSplashGate
//
// Thin client wrapper that gates the entire application behind
// the SplashScreen on initial load. Once the splash completes
// (persisted via splashShown in theme-store), children render
// immediately on all subsequent visits.
// ============================================================

import { useState, useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";
import { SplashScreen } from "./SplashScreen";

export function AppSplashGate({ children }: { children: React.ReactNode }) {
  const splashShown = useThemeStore((s) => s.splashShown);
  const [showSplash, setShowSplash] = useState(!splashShown);

  // Sync with persisted flag — if splash was shown in a previous
  // mount (e.g. after redirect), skip the animation immediately.
  useEffect(() => {
    if (splashShown) {
      setShowSplash(false);
    }
  }, [splashShown]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
