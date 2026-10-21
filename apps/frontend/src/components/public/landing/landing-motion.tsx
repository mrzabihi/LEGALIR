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
//   • GSAP   — section reveals, group stagger, layered depth drift and the
//              hand-drawn marker. One trigger per group, transform+opacity
//              (or paint-only `stroke-dashoffset`) and nothing else: no
//              scroll-jacking, no pinning, no scrubbed opacity.
//   • CSS    — the hero entrance. It must run on the first painted frame
//              and must survive a failed JS bundle, so it is a keyframe on
//              `.landing-rise`, not a GSAP tween.
//
// Every duration here is READ FROM THE CSS TOKENS (`--ln-dur-*`,
// `--ln-stagger`) instead of being typed in twice, so the motion system has
// one source of truth and a hover and a reveal can never drift apart.
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

/** The plugin *object* (statics such as `.create`), not an instance. */
type ScrollTriggerStatic = typeof ScrollTriggerClass;

/** The value type behind the named `gsap` export, without importing it. */
type Gsap = typeof GsapNamespace;

/** Pause/resume requests from the header drawer. */
const SCROLL_LOCK_EVENT = "landing:scroll-lock";

/** The sticky bar is 64/72px tall. An anchor that lands under it reads as
 *  a broken jump, so every in-page link is offset by this much. */
const HEADER_OFFSET = -84;

/** Fallbacks for the CSS tokens, in the units GSAP wants (seconds). They
 *  only apply if the stylesheet failed to load — in which case nothing is
 *  hidden anyway, so the exact value no longer matters. */
const FALLBACK = { reveal: 0.7, stagger: 0.07, hover: 0.26 };

/** Read a duration token (`--ln-dur-slow: 560ms`) as seconds. */
function durationToken(styles: CSSStyleDeclaration, name: string, fallback: number) {
  const raw = styles.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  if (raw.endsWith("ms")) return value / 1000;
  if (raw.endsWith("s")) return value;
  return fallback;
}

interface LenisHandle {
  raf: (time: number) => void;
  on: (event: "scroll", callback: () => void) => void;
  off: (event: "scroll", callback: () => void) => void;
  destroy: () => void;
  start: () => void;
  stop: () => void;
  /** Smooth-scroll to a target. Declared as the lenient signature so a
   *  numeric offset works on every 1.x build. */
  scrollTo: (target: number | string | HTMLElement, options?: {
    offset?: number;
    duration?: number;
    immediate?: boolean;
  }) => void;
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
          (scrollTriggerModule as unknown as { ScrollTrigger?: ScrollTriggerStatic })
            .ScrollTrigger ??
          (scrollTriggerModule as unknown as { default?: { ScrollTrigger?: ScrollTriggerStatic } })
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

        // ---- In-page anchors ----------------------------------------
        // Without this, an `<a href="#chapter">` jump bypasses the
        // interpolator entirely and snaps the page — the one place a
        // smooth-scrolled page visibly breaks character. Delegated so it
        // covers links that mount later, and it defers to the browser for
        // modified clicks and cross-page hrefs.
        const onAnchorClick = (event: MouseEvent) => {
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

          const link = (event.target as Element | null)?.closest?.("a[href^='#']");
          if (!(link instanceof HTMLAnchorElement)) return;

          const hash = link.getAttribute("href");
          if (!hash || hash === "#") return;

          const target = document.querySelector<HTMLElement>(hash);
          if (!target) return;

          event.preventDefault();
          lenis.scrollTo(target, { offset: HEADER_OFFSET });
          // Keep the address bar honest without letting the browser jump.
          window.history.pushState(null, "", hash);
          // Move focus for keyboard and screen-reader users; the smooth
          // scroll alone leaves them where they were.
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        };
        document.addEventListener("click", onAnchorClick);

        // ---- Reveals ------------------------------------------------
        const tokenStyles = getComputedStyle(root);
        const revealDuration = durationToken(tokenStyles, "--ln-dur-slow", FALLBACK.reveal);
        const staggerStep = durationToken(tokenStyles, "--ln-stagger", FALLBACK.stagger);

        const ctx = gsap.context(() => {
          for (const node of nodes) {
            // The attribute is an item index, read as a stagger *step*.
            // Uncapped, a four-item group (`data-ln-reveal="3"`) kept its last
            // card invisible for several hundred ms after it entered — the
            // stagger read as a slow, broken page. Cap it so ordering stays
            // legible while content never waits.
            const step = Math.min(Number(node.dataset["lnReveal"] ?? 0) || 0, 5);
            const delay = step * staggerStep;
            gsap.set(node, { opacity: 0, y: 22 });
            gsap.to(node, {
              opacity: 1,
              y: 0,
              duration: revealDuration,
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

          // ---- Hand-drawn markers -----------------------------------
          // Paint-only: `stroke-dashoffset` never triggers layout, and the
          // CSS class does the draw so reduced-motion (which never reaches
          // this island) leaves the stroke already drawn.
          for (const node of document.querySelectorAll<HTMLElement>(
            "[data-ln-highlight]"
          )) {
            node.classList.add("landing-highlight--draw");
            ScrollTrigger.create({
              trigger: node,
              start: "top 85%",
              once: true,
              onEnter: () => node.classList.add("is-drawn"),
            });
          }
        });

        // Anything already inside the first viewport settles immediately —
        // no fade-in on content the visitor can already read. Done before
        // the hiding class is added, so the first screen never flashes.
        //
        // The bound is the full viewport, not the trigger's 88% line: an
        // element whose top sits between 88% and 100% of the viewport is
        // *visible*, yet would still be hidden by `.ln-reveal-ready` until
        // the first scroll — which turned the bottom of the phone hero into
        // a blank band. Everything below the fold still reveals on scroll.
        const vh = window.innerHeight;
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.top < vh && rect.bottom > 0) {
            node.classList.add("is-in");
            gsap.set(node, { opacity: 1, y: 0 });
          }
        }

        // ---- Parallax -------------------------------------------------
        // The plates drift against the scroll by at most 6% of their own
        // height. It is deliberately the only scroll-linked transform on
        // the page: no pinning, no horizontal movement, no opacity tied to
        // scroll. On phones the effect is skipped outright — a 390px
        // viewport barely shows a plate plus its caption at once, so a
        // drift there would read as a wobble rather than as depth.
        const parallaxNodes = Array.from(
          document.querySelectorAll<HTMLElement>("[data-ln-parallax]")
        );
        const parallaxEnabled = window.matchMedia("(min-width: 900px)").matches;

        if (parallaxEnabled) {
          for (const node of parallaxNodes) {
            const travel = Math.min(node.offsetHeight * 0.06, 40);
            gsap.fromTo(
              node,
              { y: -travel / 2 },
              {
                y: travel / 2,
                ease: "none",
                scrollTrigger: {
                  trigger: node,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.6,
                  // Nothing is hidden and nothing is timed: the drawing is
                  // always at least half in place, so a failed refresh or a
                  // slow first paint still shows the full illustration.
                  invalidateOnRefresh: true,
                },
              }
            );
          }

          // ---- Layered depth ----------------------------------------
          // A second, independent drift axis for the geometry layer. It
          // travels a third as far as a plate and in the opposite direction,
          // which is what produces the *layered* read — two planes moving at
          // different rates rather than one image sliding. `xPercent`/`yPercent`
          // are used so the shapes drift by their own size, not by pixels,
          // which keeps them correct after a resize.
          for (const node of document.querySelectorAll<HTMLElement>("[data-ln-depth]")) {
            gsap.fromTo(
              node,
              { yPercent: 0 },
              {
                yPercent: -7,
                ease: "none",
                scrollTrigger: {
                  trigger: node.parentElement ?? node,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                  invalidateOnRefresh: true,
                },
              }
            );
          }

          root.classList.add("ln-exhibit-ready");
        }

        root.classList.add("ln-reveal-ready");
        ScrollTrigger.refresh();

        cleanup = () => {
          ctx.revert();
          gsap.ticker.remove(raf);
          lenis.off("scroll", onLenisScroll);
          lenis.destroy();
          activeLenis = null;
          document.removeEventListener("click", onAnchorClick);
          root.classList.remove("ln-reveal-ready");
          root.classList.remove("ln-exhibit-ready");
          for (const node of nodes) node.classList.remove("is-in");
          for (const node of document.querySelectorAll<HTMLElement>(
            "[data-ln-highlight]"
          )) {
            node.classList.remove("is-drawn");
            node.classList.remove("landing-highlight--draw");
          }
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
