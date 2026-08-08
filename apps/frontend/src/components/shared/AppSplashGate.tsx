"use client";

// ============================================================
// LEGALIR — AppSplashGate
// Shows splash on every full page load/reload (4s duration).
// Skip only within same SPA navigation session.
// ============================================================

import { useState } from "react";
import { SplashScreen } from "./SplashScreen";

let _sessionSplashShown = false;

export function AppSplashGate({ children }: { children: React.ReactNode }) {
  const [showSplash] = useState(!_sessionSplashShown);

  if (showSplash && !_sessionSplashShown) {
    return <SplashScreen />;
  }

  _sessionSplashShown = true;
  return <>{children}</>;
}
