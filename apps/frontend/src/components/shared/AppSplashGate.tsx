"use client";

// ============================================================
// LEGALIR — AppSplashGate
// Shows splash on every full page load/reload (4s duration).
// SplashScreen calls onDone when finished.
// ============================================================

import { useState, useCallback } from "react";
import { SplashScreen } from "./SplashScreen";

export function AppSplashGate({ children }: { children: React.ReactNode }) {
  const [splashDone, setSplashDone] = useState(false);

  const handleDone = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!splashDone) {
    return <SplashScreen onDone={handleDone} />;
  }

  return <>{children}</>;
}
