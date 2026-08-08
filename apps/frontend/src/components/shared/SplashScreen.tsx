"use client";

// ============================================================
// LEGALIR — Polished Splash Screen
//
// Full-screen overlay with deep navy gradient, animated logo,
// gold accent, and auth-aware redirect after a minimum display
// duration of 2.5 seconds.
//
// Shows once per persisted session (splashShown flag). On
// subsequent mounts, navigates immediately without animation.
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore } from "@/stores/theme-store";

const MIN_SPLASH_MS = 4000;
const EXIT_TRANSITION_MS = 500;

function prefersReducedMotion(): boolean {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

export function SplashScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { splashShown, setSplashShown } = useThemeStore();

  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting" | "done">(
    splashShown ? "done" : "entering"
  );
  const hasFinished = useRef(false);

  const isAuthed =
    session !== null && session.sessionId.length > 0;

  // Detect reduced-motion preference
  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const navigate = useCallback(() => {
    // Don't redirect from public pages — let users see the landing page
    const publicPaths = ["/", "/features", "/pricing", "/about", "/contact", "/login", "/register"];
    const currentPath = window.location.pathname;
    const isPublicPath = publicPaths.some(p => currentPath === p || currentPath.startsWith(p + "/"));

    if (currentPath === "/dashboard" || currentPath.startsWith("/dashboard/")) {
      return; // already on dashboard, stay
    }

    // Only redirect if user is NOT on a public page and NOT already on correct page
    if (!isPublicPath) {
      const target = isAuthed ? "/dashboard" : "/auth/mobile";
      if (currentPath !== target) {
        router.replace(target);
      }
    }
    // If on a public page, just dismiss splash — let the page show
  }, [router, isAuthed]);

  const finish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    setPhase("exiting");

    setTimeout(() => {
      setPhase("done");
      setSplashShown(true);
      navigate();
    }, EXIT_TRANSITION_MS);
  }, [navigate, setSplashShown]);

  useEffect(() => {
    // If splash was already shown in a previous visit, redirect immediately
    if (splashShown) {
      navigate();
      return;
    }

    // Phase 1 — Entering (start invisible, animate in)
    setPhase("entering");
    const raf = requestAnimationFrame(() => {
      setPhase("visible");
    });

    // Phase 2 — Wait minimum duration, then exit
    const timer = setTimeout(finish, MIN_SPLASH_MS);

    // Fail-safe: never block longer than 10 seconds total
    const failSafe = setTimeout(finish, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(failSafe);
      cancelAnimationFrame(raf);
    };
    // Run once on mount — splashShown / isAuthed are stable via store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After exiting + navigation, render nothing
  if (phase === "done") return null;

  const isExiting = phase === "exiting";
  const showAnimated = phase === "visible" || phase === "exiting";
  const motion = !reducedMotion;

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex flex-col items-center justify-center",
        "bg-gradient-to-b from-primary-900 via-primary-800 to-primary-700",
        "overflow-hidden select-none",
        isExiting ? "animate-fade-out pointer-events-none" : "",
      ].join(" ")}
      role="progressbar"
      aria-label="در حال بارگذاری LEGALIR"
      aria-busy={true}
      dir="rtl"
    >
      {/* ========================================================
           Decorative background elements — slow-spinning rings
           ======================================================== */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Outer ring */}
        <div
          className="absolute w-[520px] h-[520px] border border-secondary-600/10 rounded-full -top-40 left-1/2 -translate-x-1/2"
          style={{ animation: motion ? "splash-ring-spin 80s linear infinite" : "none" }}
        />
        {/* Inner ring */}
        <div
          className="absolute w-[360px] h-[360px] border border-secondary-600/8 rounded-full -bottom-24 left-1/2 -translate-x-1/2"
          style={{ animation: motion ? "splash-ring-spin 60s linear infinite reverse" : "none" }}
        />
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 40%, rgba(163,124,60,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ========================================================
           Main content — Logo, brand, tagline, gold accent
           ======================================================== */}
      <div className="relative flex flex-col items-center gap-6 z-10 px-8">
        {/* Logo image with scale+fade entrance */}
        <div
          className="relative w-40 h-40 transition-all duration-700 ease-emphasized"
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "scale(1)" : "scale(0.85)",
            transitionDelay: motion ? "0ms" : "0ms",
          }}
        >
          <Image
            src="/legalir-logo.png"
            alt="LEGALIR"
            fill
            className="object-contain"
            priority
            sizes="160px"
          />
        </div>

        {/* Brand name "LEGALIR" */}
        <h1
          className={[
            "text-2xl font-bold tracking-[0.15em] text-white text-center",
            motion ? "transition-all duration-500 ease-emphasized" : "",
          ].join(" ")}
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "translateY(0)" : "translateY(6px)",
            transitionDelay: motion ? "350ms" : "0ms",
          }}
        >
          LEGALIR
        </h1>

        {/* Gold accent line */}
        <div
          className="h-[2px] rounded-full bg-secondary-600/60"
          style={{
            width: "48px",
            opacity: showAnimated ? 0.7 : 0,
            transform: showAnimated ? "scaleX(1)" : "scaleX(0)",
            transition: motion
              ? "opacity 500ms ease-emphasized, transform 500ms ease-emphasized"
              : "none",
            transitionDelay: motion ? "550ms" : "0ms",
          }}
        />

        {/* Persian tagline */}
        <p
          className={[
            "text-sm text-white/60 text-center font-light leading-relaxed",
            motion ? "transition-all duration-500 ease-emphasized" : "",
          ].join(" ")}
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "translateY(0)" : "translateY(4px)",
            transitionDelay: motion ? "750ms" : "0ms",
          }}
        >
          دستیار هوشمند حقوقی ایران
        </p>
      </div>

      {/* ========================================================
           Loading indicator — three sequential dots at bottom
           ======================================================== */}
      <div className="absolute bottom-12 flex items-center gap-2 z-10" aria-hidden="true">
        {reducedMotion ? (
          <span className="text-white/40 text-sm">در حال بارگذاری...</span>
        ) : (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[7px] h-[7px] rounded-full bg-white/45"
                style={{
                  animation: `splash-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </>
        )}
      </div>

    </div>
  );
}
