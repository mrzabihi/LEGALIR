// ============================================================
// LEGALIR — ReadingProgress
// ============================================================
// A 3px bar pinned under the sticky header that fills as the reader
// moves through the article. It is deliberately quiet: no label, no
// percentage, no colour change — just a sense of place.
//
// It reads scroll position on a passive listener and writes a CSS
// transform, so it never re-renders React on scroll. Motion is a
// 150ms transform transition, which the global reduced-motion rule
// collapses to ~0.
// ============================================================

"use client";

import { useEffect, useRef } from "react";

export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const ratio = scrollable > 0 ? doc.scrollTop / scrollable : 0;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="no-print fixed inset-x-0 top-0 z-30 h-[3px] bg-transparent"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-right bg-secondary-500 transition-transform duration-medium1 ease-standard"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
