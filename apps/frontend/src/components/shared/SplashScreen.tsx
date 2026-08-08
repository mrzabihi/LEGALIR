"use client";

// ============================================================
// LEGALIR — Splash Screen (4s on every full page load)
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/stores/auth-store";

const MIN_SPLASH_MS = 4000;
const EXIT_TRANSITION_MS = 500;

interface SplashScreenProps {
  onDone: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const isAuthed = session !== null && session.sessionId.length > 0;

  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting" | "done">("entering");

  // Detect reduced-motion preference
  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    // Phase 1 — animate in
    const raf = requestAnimationFrame(() => {
      setPhase("visible");
    });

    // Phase 2 — wait 4 seconds, then exit
    const timer = setTimeout(() => {
      setPhase("exiting");
      setTimeout(() => {
        setPhase("done");
        onDone();

        // Navigate to appropriate page if needed
        const publicPaths = ["/", "/features", "/pricing", "/about", "/contact", "/login", "/register"];
        const currentPath = window.location.pathname;
        const isPublicPath = publicPaths.some(
          (p) => currentPath === p || currentPath.startsWith(p + "/")
        );

        if (
          currentPath !== "/dashboard" &&
          !currentPath.startsWith("/dashboard/") &&
          !isPublicPath
        ) {
          const target = isAuthed ? "/dashboard" : "/auth/mobile";
          if (currentPath !== target) {
            router.replace(target);
          }
        }
      }, EXIT_TRANSITION_MS);
    }, MIN_SPLASH_MS);

    // Fail-safe: never block longer than 12s
    const failSafe = setTimeout(() => {
      setPhase("exiting");
      setTimeout(() => {
        setPhase("done");
        onDone();
      }, EXIT_TRANSITION_MS);
    }, 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(failSafe);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After exiting, render nothing
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
      {/* Decorative background rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[520px] h-[520px] border border-secondary-600/10 rounded-full -top-40 left-1/2 -translate-x-1/2"
          style={{ animation: motion ? "splash-ring-spin 80s linear infinite" : "none" }}
        />
        <div
          className="absolute w-[360px] h-[360px] border border-secondary-600/8 rounded-full -bottom-24 left-1/2 -translate-x-1/2"
          style={{ animation: motion ? "splash-ring-spin 60s linear infinite reverse" : "none" }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 40%, rgba(163,124,60,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-6 z-10 px-8">
        <div
          className="relative w-40 h-40 transition-all duration-700 ease-emphasized"
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "scale(1)" : "scale(0.85)",
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

      {/* Loading dots */}
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
