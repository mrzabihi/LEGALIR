"use client";

// ============================================================
// LEGALIR — Landing motion (single client island)
// ============================================================
// One mount, one Lenis instance, one GSAP context. Everything is scoped to
// the `.landing` wrapper and torn down on unmount, so navigating from `/`
// into the app never leaves a scroller or a trigger behind.
//
// Division of labour:
//   • Lenis  — wheel smoothing only. No `syncTouch`, so phones keep their
//              native momentum exactly as the OS implements it.
//   • GSAP   — section reveals. One trigger per group, transform+opacity
//              only, no scroll-jacking and no pinned sections.
//   • CSS    — the hero entrance. It must run on the first painted frame
//              and must survive a failed JS bundle, so it is a keyframe on
//              `.landing-rise`, not a GSAP tween.
//
// Safety contract (content is never lost):
//   • `.ln-reveal-ready` — the class that hides `[data-ln-reveal]` — is
//     added only AFTER GSAP has registered and the reduced-motion check has
//     passed. No JS ⇒ no class ⇒ the page renders fully.
//   • `prefers-reduced-motion: reduce` ⇒ everything is revealed at once and
//     Lenis is not created at all.
//   • A failed dynamic import is swallowed; the page stays fully visible.

import { useEffect } from "react";
import type { gsap as GsapNamespace } from "gsap";
import type { ScrollTrigger as ScrollTriggerClass } from "gsap/ScrollTrigger";

/** The value type behind the named `gsap` export, without importing it. */
type Gsap = typeof GsapNamespace;

/** Pause/resume requests from the header drawer. */
const SCROLL_LOCK_EVENT = "landing:scroll-lock";

interface LenisHandle {
  raf: (time: number) => void;
  on: (event: "scroll", callback: () => void) => void;
  off: (event: "scroll", callback: () => void) => void;
  destroy: () => void;
  start: () => void;
  stop: () => void;
}

export function LandingMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const root = document.documentElement;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-ln-reveal]")
    );

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const onScrollLock = (event: Event) => {
      const locked = (event as CustomEvent<boolean>).detail === true;
      const lenis = activeLenis;
      if (!lenis) return;
      if (locked) lenis.stop();
      else lenis.start();
    };
    let activeLenis: LenisHandle | null = null;

    void (async () => {
      try {
        const [lenisModule, gsapModule, scrollTriggerModule] = await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;

        // Both packages expose a named export on their ESM entry; the
        // `default` fallback covers the CJS interop path Turbopack takes
        // in dev.
        const Lenis =
          (lenisModule as unknown as { default: new (o?: object) => LenisHandle })
            .default ?? (lenisModule as unknown as { Lenis: new (o?: object) => LenisHandle }).Lenis;
        const gsap =
          (gsapModule as unknown as { gsap: Gsap }).gsap ??
          (gsapModule as unknown as { default: Gsap }).default;
        const ScrollTrigger =
          (scrollTriggerModule as unknown as { ScrollTrigger?: ScrollTriggerClass })
            .ScrollTrigger ??
          (scrollTriggerModule as unknown as { default?: { ScrollTrigger?: ScrollTriggerClass } })
            .default?.ScrollTrigger;
        // Without the plugin there is nothing to sync and no reveals to run.
        // Throwing here is safe: the catch below leaves the page visible.
        if (!ScrollTrigger) throw new Error("ScrollTrigger plugin is unavailable");

        gsap.registerPlugin(ScrollTrigger as never);

        // ---- Lenis (wheel only) -------------------------------------
        const lenis = new Lenis({
          // Slightly heavier than the 0.1 default so one flick settles
          // instead of overshooting, but short enough that the page never
          // feels detached from the trackpad.
          lerp: 0.09,
          smoothWheel: true,
          // Touch stays native: iOS Safari's momentum beats any JS
          // emulation, and syncing it is the documented cause of scroll
          // jank on older iPhones.
          syncTouch: false,
          // Honour the OS setting even though we already bailed above —
          // it can flip while the page is open.
          respectReducedMotion: true,
          // Inner scrollers (the mobile drawer, any horizontal rail) keep
          // their own scrolling.
          prevent: (node: HTMLElement) => node.closest("[data-lenis-prevent]") !== null,
        });
        activeLenis = lenis;

        const onLenisScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onLenisScroll);

        // One rAF for both libraries: Lenis drives ScrollTrigger instead
        // of ScrollTrigger running its own loop.
        const raf = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        document.addEventListener(SCROLL_LOCK_EVENT, onScrollLock);

        // ---- Reveals ------------------------------------------------
        const ctx = gsap.context(() => {
          for (const node of nodes) {
            const delay = Number(node.dataset["lnReveal"] ?? 0) || 0;
            gsap.set(node, { opacity: 0, y: 22 });
            gsap.to(node, {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
              delay,
              scrollTrigger: {
                trigger: node,
                start: "top 88%",
                once: true,
              },
              onStart: () => node.classList.add("is-in"),
            });
          }
        });

        // Anything already in view settles immediately — no fade-in on
        // content the visitor can already read. Done before the hiding
        // class is added, so the first screen never flashes.
        const vh = window.innerHeight;
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.top < vh * 0.9 && rect.bottom > 0) {
            node.classList.add("is-in");
            gsap.set(node, { opacity: 1, y: 0 });
          }
        }

        root.classList.add("ln-reveal-ready");
        ScrollTrigger.refresh();

        cleanup = () => {
          ctx.revert();
          gsap.ticker.remove(raf);
          lenis.off("scroll", onLenisScroll);
          lenis.destroy();
          activeLenis = null;
          root.classList.remove("ln-reveal-ready");
          for (const node of nodes) node.classList.remove("is-in");
        };
      } catch {
        // Any failure (blocked chunk, unsupported browser) leaves the page
        // visible: the reveal class was never added.
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener(SCROLL_LOCK_EVENT, onScrollLock);
      cleanup?.();
    };
  }, []);

  return null;
}
