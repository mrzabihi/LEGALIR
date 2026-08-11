"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

// ============================================================
// LEGALIR — 4-Second Animated Splash Screen
//
// Requirements:
// - 4 seconds in normal dev flow
// - Contains motion (animated logo + brand mark)
// - Lightweight (CSS animations, no heavy JS)
// - Respects prefers-reduced-motion
// - Must not block forever (timeout + fail-safe)
// - Smooth transition to application
// - Doesn't replay on internal navigation
// - Configurable for tests (SPLASH_DURATION env / data attr)
// ============================================================

interface SplashScreenProps {
  onFinish: () => void;
  /** Override duration for tests (milliseconds) */
  duration?: number;
}

// Env-based and data-attr based duration for test configurability
function getSplashDuration(): number {
  // Allow override via data attribute on html (set by tests)
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-splash-duration");
    if (attr) {
      const parsed = parseInt(attr, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  }
  // Allow override via env variable in test mode
  if (typeof process !== "undefined" && process.env["NEXT_PUBLIC_SPLASH_DURATION_MS"]) {
    const parsed = parseInt(process.env["NEXT_PUBLIC_SPLASH_DURATION_MS"] ?? "", 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 4000; // Default: 4 seconds
}

// Reduced motion check
function prefersReducedMotion(): boolean {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

export function SplashScreen({ onFinish, duration }: SplashScreenProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting" | "done">("entering");
  const [reducedMotion, setReducedMotion] = useState(false);
  const hasFinished = useRef(false);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualDuration = duration ?? getSplashDuration();

  // Detect reduced motion
  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const finish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    setPhase("exiting");
    setTimeout(() => {
      setPhase("done");
      onFinish();
    }, 500); // Exit transition duration
  }, [onFinish]);

  // Main splash timeline
  useEffect(() => {
    if (actualDuration <= 0) {
      finish();
      return;
    }

    // Phase 1: Enter (immediate)
    setPhase("entering");
    requestAnimationFrame(() => setPhase("visible"));

    // Phase 2: Wait then exit
    const timer = setTimeout(() => {
      finish();
    }, actualDuration);

    // Fail-safe: never block more than 2× the intended duration
    failSafeTimer.current = setTimeout(() => {
      finish();
    }, Math.max(actualDuration * 2, 10000));

    return () => {
      clearTimeout(timer);
      if (failSafeTimer.current) clearTimeout(failSafeTimer.current);
    };
  }, [actualDuration, finish]);

  if (phase === "done") return null;

  const isExiting = phase === "exiting";

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex items-center justify-center",
        "bg-background overflow-hidden",
        isExiting ? "animate-fade-out pointer-events-none" : "",
      ].join(" ")}
      role="progressbar"
      aria-label="در حال بارگذاری LEGALIR"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={phase === "entering" ? 10 : phase === "visible" ? 50 : 100}
      aria-busy={true}
      dir="rtl"
    >
      {/* Background decorative elements — subtle pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] border border-primary rounded-full -top-48 -end-48"
          style={{
            animation: reducedMotion ? "none" : "spin 60s linear infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] border border-primary rounded-full -bottom-32 -start-32"
          style={{
            animation: reducedMotion ? "none" : "spin 40s linear infinite reverse",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Logo mark — scales of justice + text */}
        <div
          className={[
            "flex flex-col items-center gap-4",
            phase === "entering" && !reducedMotion ? "animate-fade-in" : "",
          ].join(" ")}
        >
          {/* Brand mark: stylized scales + Persian "ل" */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              style={{
                animation: reducedMotion ? "none" : "pulse 2s ease-in-out infinite",
              }}
            />
            {/* Scales icon */}
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              className="text-primary"
              role="img"
              aria-label="ترازوی عدالت"
              style={{
                animation: reducedMotion
                  ? "none"
                  : "splash-pulse 2s ease-in-out infinite",
              }}
            >
              {/* Balance beam */}
              <line x1="8" y1="16" x2="48" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              {/* Center pillar */}
              <line x1="28" y1="16" x2="28" y2="44" stroke="currentColor" strokeWidth="2.5" />
              {/* Base */}
              <path d="M18 44h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              {/* Left pan */}
              <path d="M14 28a4 4 0 014-4h0a4 4 0 014 4v0" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M12 18l4-2-4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Right pan */}
              <path d="M34 28a4 4 0 014-4h0a4 4 0 014 4v0" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M44 18l-4-2 4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Persian "ل" in center */}
              <text
                x="28"
                y="37"
                textAnchor="middle"
                fill="currentColor"
                fontSize="14"
                fontWeight="700"
                fontFamily="Vazir, Vazirmatn, sans-serif"
              >
                ل
              </text>
            </svg>
          </div>

          {/* Brand text */}
          <div className="flex flex-col items-center gap-1">
            <h1
              className="text-headlineLarge text-primary font-bold tracking-wide"
              style={{
                fontFamily: "Vazir, Vazirmatn, 'Noto Sans Arabic', Tahoma, sans-serif",
              }}
            >
              LEGALIR
            </h1>
            <p
              className="text-bodySmall text-muted"
              style={{
                fontFamily: "Vazir, Vazirmatn, Tahoma, sans-serif",
              }}
            >
              دستیار هوشمند حقوقی شما
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        {reducedMotion ? (
          <p className="text-caption text-muted" aria-live="polite">در حال بارگذاری...</p>
        ) : (
          <div className="flex gap-1.5" aria-hidden="true">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/30"
                style={{
                  animation: `splash-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CSS Keyframes for splash (injected via <style>)
// ============================================================

export function SplashKeyframes() {
  return (
    <style jsx global>{`
      @keyframes splash-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.02); opacity: 0.9; }
      }
      @keyframes splash-dot {
        0%, 80%, 100% { transform: scale(0.55); opacity: 0.25; }
        40% { transform: scale(1); opacity: 0.7; }
      }
      @keyframes splash-ring-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes splash-float {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-10px) scale(1.04); }
      }
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slide-in-end {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes slide-in-start {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes dialog-enter {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes progress-indeterminate {
        0% { left: -40%; }
        100% { left: 100%; }
      }
      @keyframes skeleton-wave {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      .animate-fade-in { animation: fade-in 0.3s ease-out; }
      .animate-fade-out { animation: fade-out 0.3s ease-out forwards; }
      .animate-slide-in-end { animation: slide-in-end 0.3s ease-out; }
      .animate-slide-in-start { animation: slide-in-start 0.3s ease-out; }
      .animate-slide-up { animation: slide-up 0.3s ease-out; }
      .animate-dialog-enter { animation: dialog-enter 0.25s ease-out; }
      .animate-progress-indeterminate {
        animation: progress-indeterminate 1.8s ease-in-out infinite;
      }
      .animate-skeleton-wave {
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.05) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: skeleton-wave 1.5s ease-in-out infinite;
      }

      /* RTL icon flip */
      [dir="rtl"] .rtl-flip {
        transform: scaleX(-1);
      }

      /* State layer utilities */
      .state-hover { position: relative; }
      .state-hover::after {
        content: "";
        position: absolute;
        inset: 0;
        background: currentColor;
        opacity: 0.08;
        pointer-events: none;
        border-radius: inherit;
      }
      .state-focus { position: relative; }
      .state-focus::after {
        content: "";
        position: absolute;
        inset: 0;
        background: currentColor;
        opacity: 0.12;
        pointer-events: none;
        border-radius: inherit;
      }
      .state-pressed { position: relative; }
      .state-pressed::after {
        content: "";
        position: absolute;
        inset: 0;
        background: currentColor;
        opacity: 0.12;
        pointer-events: none;
        border-radius: inherit;
      }

      /* Type scale utilities */
      .text-displayLarge { font: 400 57px/64px var(--font-family-fa); letter-spacing: -0.25px; }
      .text-displayMedium { font: 400 45px/52px var(--font-family-fa); }
      .text-displaySmall { font: 400 36px/44px var(--font-family-fa); }
      .text-headlineLarge { font: 700 32px/40px var(--font-family-fa); }
      .text-headlineMedium { font: 700 28px/36px var(--font-family-fa); }
      .text-headlineSmall { font: 700 24px/32px var(--font-family-fa); }
      .text-titleLarge { font: 500 22px/28px var(--font-family-fa); }
      .text-titleMedium { font: 500 16px/24px var(--font-family-fa); letter-spacing: 0.15px; }
      .text-titleSmall { font: 500 14px/20px var(--font-family-fa); letter-spacing: 0.1px; }
      .text-labelLarge { font: 500 14px/20px var(--font-family-fa); letter-spacing: 0.1px; }
      .text-labelMedium { font: 500 12px/16px var(--font-family-fa); letter-spacing: 0.5px; }
      .text-labelSmall { font: 500 11px/16px var(--font-family-fa); letter-spacing: 0.5px; }
      .text-bodyLarge { font: 400 16px/28px var(--font-family-fa); letter-spacing: 0.5px; }
      .text-bodyMedium { font: 400 14px/24px var(--font-family-fa); letter-spacing: 0.25px; }
      .text-bodySmall { font: 400 12px/20px var(--font-family-fa); letter-spacing: 0.4px; }

      /* RTL-aware text alignment */
      [dir="rtl"] { text-align: right; }
      [dir="ltr"] { text-align: left; font-family: var(--font-family-en); }
    `}</style>
  );
}
