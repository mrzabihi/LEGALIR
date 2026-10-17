// ============================================================
// LEGALIR — Landing page reveal engine (single client island)
// ============================================================
// The landing page is a server component. Rather than wrapping every
// section in its own client component (which would break the card
// grids with extra DOM), the page marks elements with `data-reveal`
// and this one island reveals them.
//
// Safety contract — content is NEVER lost:
//   • The CSS only hides [data-reveal] while <html> has `reveal-ready`
//     AND the node lacks `.is-revealed`. We add `reveal-ready` in the
//     same task that resolves the initial viewport, so above-the-fold
//     nodes are never painted hidden.
//   • Everything already on screen is marked revealed immediately.
//   • Anything without an IntersectionObserver, or with JS disabled,
//     simply never gets `reveal-ready` — the page renders fully.
//   • Under `prefers-reduced-motion` we reveal everything at once and
//     stop watching.
//   • Elements are observed by attribute (not by React refs), so cards
//     rendered from data arrays are covered with zero per-item code.
// The whole run is one observer and disconnects after the last node.

"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-reveal]";

export function LandingReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)
    );
    if (nodes.length === 0) return;

    const revealAll = () => {
      for (const node of nodes) node.classList.add("is-revealed");
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    // Mark what is already on screen before hiding anything, so the
    // HERO and the stats bar never animate from hidden.
    const vh = window.innerHeight;
    const pending: HTMLElement[] = [];
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) node.classList.add("is-revealed");
      else pending.push(node);
    }

    root.classList.add("reveal-ready");
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      // A touch of lead time so the fade finishes as the card settles
      // into the comfortable reading band rather than after it.
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );
    for (const node of pending) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return null;
}
