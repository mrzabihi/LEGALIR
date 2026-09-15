"use client";

// ============================================================
// LEGALIR — Splash Screen (4s on every full page load)
// Redesigned: 2X logo scale (~320px visual), responsive
// circular composition, refined staggered entrance,
// orbital drift animation.
// ============================================================

import { useEffect, useState } from "react";
import Image from "next/image";

const MIN_SPLASH_MS = 4000;
const EXIT_TRANSITION_MS = 500;
const FAILSAFE_MS = 15000;

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting" | "done">("entering");

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPhase("visible");
    });

    const timer = setTimeout(() => {
      setPhase("exiting");
      setTimeout(() => {
        setPhase("done");
        onDone();
      }, EXIT_TRANSITION_MS);
    }, MIN_SPLASH_MS);

    const failSafe = setTimeout(() => {
      setPhase("exiting");
      setTimeout(() => {
        setPhase("done");
        onDone();
      }, EXIT_TRANSITION_MS);
    }, FAILSAFE_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(failSafe);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      aria-label="در حال بارگذاری لیگالیر"
      aria-busy={true}
      dir="rtl"
    >
      {/* Decorative background — responsive concentric rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Warm gold central glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 42%, rgba(163,124,60,0.16) 0%, transparent 62%)",
            opacity: 0.38,
          }}
        />

        {/* Ring 1 — outer, slow spin */}
        <div
          className="absolute rounded-full border border-white/[0.07]"
          style={{
            width: "min(64vw, 64vh, 600px)",
            height: "min(64vw, 64vh, 600px)",
            left: "50%",
            top: "50%",
            marginLeft: "calc(min(64vw, 64vh, 600px) / -2)",
            marginTop: "calc(min(64vw, 64vh, 600px) / -2)",
            animation: motion ? "splash-ring-spin 90s linear infinite" : "none",
          }}
        />

        {/* Ring 2 — mid, reverse, offset */}
        <div
          className="absolute rounded-full border border-white/[0.06]"
          style={{
            width: "min(48vw, 48vh, 440px)",
            height: "min(48vw, 48vh, 440px)",
            left: "50%",
            top: "50%",
            marginLeft: "calc(min(48vw, 48vh, 440px) / -2)",
            marginTop: "calc(min(48vw, 48vh, 440px) / -2)",
            animation: motion ? "splash-ring-spin 65s linear infinite reverse" : "none",
          }}
        />

        {/* Ring 3 — inner accent */}
        <div
          className="absolute rounded-full border border-white/[0.04]"
          style={{
            width: "min(34vw, 34vh, 300px)",
            height: "min(34vw, 34vh, 300px)",
            left: "50%",
            top: "50%",
            marginLeft: "calc(min(34vw, 34vh, 300px) / -2)",
            marginTop: "calc(min(34vw, 34vh, 300px) / -2)",
            animation: motion ? "splash-ring-spin 50s linear infinite" : "none",
          }}
        />

        {/* Orbiting accent — top-right */}
        <div
          className="absolute rounded-full bg-white/[0.05]"
          style={{
            width: "min(6vw, 6vh, 64px)",
            height: "min(6vw, 6vh, 64px)",
            top: "18%",
            right: "22%",
            animation: motion ? "splash-float 10s ease-in-out infinite" : "none",
          }}
        />

        {/* Orbiting accent — bottom-left */}
        <div
          className="absolute rounded-full bg-white/[0.04]"
          style={{
            width: "min(4vw, 4vh, 48px)",
            height: "min(4vw, 4vh, 48px)",
            bottom: "24%",
            left: "20%",
            animation: motion ? "splash-float 14s ease-in-out infinite 4s" : "none",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-7 z-10 px-6">
        {/* Logo — minimal float + glow pulse */}
        <div
          className="relative"
          style={{
            width: "clamp(200px, 38vw, 340px)",
            height: "clamp(200px, 38vw, 340px)",
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "scale(1)" : "scale(0.92)",
            animation: motion ? "splash-logo-float 3s ease-in-out infinite" : "none",
            transition: motion
              ? "opacity 800ms cubic-bezier(0.4, 0, 0.2, 1), transform 800ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
          }}
        >
          <Image
            src="/legalir-logo-bronze.png"
            alt="لیگالیر"
            fill
            className="object-contain drop-shadow-[0_0_32px_rgba(212,175,55,0.25)]"
            priority
            sizes="(max-width: 600px) 200px, (max-width: 1024px) 280px, 340px"
          />
        </div>

        {/* Brand name */}
        <h1
          className={[
            "text-[clamp(1.2rem,2.5vw,1.7rem)] font-bold tracking-[0.2em] text-white text-center",
            motion ? "transition-all duration-500" : "",
          ].join(" ")}
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "translateY(0)" : "translateY(8px)",
            transitionDelay: motion ? "400ms" : "0ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          لیگالیر
        </h1>

        {/* Divider */}
        <div
          className="h-[2px] rounded-full bg-white/20"
          style={{
            width: "clamp(48px, 7vw, 72px)",
            opacity: showAnimated ? 0.55 : 0,
            transform: showAnimated ? "scaleX(1)" : "scaleX(0)",
            transition: motion
              ? "opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
            transitionDelay: motion ? "600ms" : "0ms",
          }}
        />

        {/* Tagline */}
        <p
          className={[
            "text-[clamp(0.78rem,1.3vw,0.92rem)] text-white/55 text-center font-light leading-relaxed",
            motion ? "transition-all duration-500" : "",
          ].join(" ")}
          style={{
            opacity: showAnimated ? 1 : 0,
            transform: showAnimated ? "translateY(0)" : "translateY(6px)",
            transitionDelay: motion ? "800ms" : "0ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          دستیار هوشمند حقوقی ایران
        </p>
      </div>

      {/* Loading indicator */}
      <div className="absolute bottom-12 flex items-center gap-2.5 z-10" aria-hidden="true">
        {reducedMotion ? (
          <span className="text-white/40 text-sm">در حال بارگذاری...</span>
        ) : (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[7px] h-[7px] rounded-full bg-white/40"
                style={{
                  animation: `splash-dot 1.6s ease-in-out ${i * 0.25}s infinite`,
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
