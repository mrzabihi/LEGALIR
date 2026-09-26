// ============================================================
// LEGALIR — Scroll reveal wrapper
// ============================================================
// Plays the shared `scroll-reveal` entrance animation the first time
// an element scrolls into view.
//
// The three-phase state machine exists to avoid the classic
// "invisible content" failure: nothing is hidden until we have
// confirmed (a) we are on the client and (b) the element is actually
// below the fold. An element already on screen at mount renders
// immediately with no animation, so there is never a flash and never
// a permanently hidden banner if the observer never fires.
//
// `prefers-reduced-motion` is honoured globally in globals.css, which
// collapses the animation duration to 0.01ms.
// ============================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger the entrance, in milliseconds. */
  delayMs?: number;
}

export function Reveal({ children, className = "", delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setPhase("shown");
      return;
    }

    const rect = el.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (onScreen) {
      setPhase("shown");
      return;
    }

    setPhase("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[
        phase === "hidden" ? "opacity-0" : "",
        phase === "shown" ? "animate-scroll-reveal" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={phase === "shown" && delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
