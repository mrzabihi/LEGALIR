// ============================================================
// LEGALIR — Mobile Bottom Navigation (Persian capsule bar)
// ============================================================
// A floating, fully-rounded bar in the shared warm-glass material. Four
// destinations sit either side of a fixed centre action; the active
// destination expands into a gold-ringed capsule that glides between slots.
// The centre button carries the Persian LEGALIR wordmark and opens the
// «ساخت جدید» sheet.
//
// Layout: two equal `flex-1` groups flank a fixed centre gap, so the centre
// action is always exactly centred — an expanding capsule can never push it
// off-axis. The centre button and its label are absolutely positioned at
// `left-1/2`, so they stay put regardless of the groups.
//
// The active capsule is a single shared indicator measured after mount (never
// during render), so SSR and the first client render agree. It is decorative
// (`pointer-events-none`) and never intercepts taps. Because the indicator is
// the *only* background an active destination draws, an active item never
// also paints a hover wash — one coherent layer per state.
//
// The «ساخت جدید» sheet is non-modal: the bar stays fully interactive while
// it is open, so a single tap on any destination both closes the sheet and
// navigates. The sheet owns no backdrop over the bar and no focus trap.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomNavDestinations, getActiveBottomNavPath } from "@/lib/routes";
import {
  IconHome,
  IconGrid,
  IconHeadset,
  IconSettings,
  IconAdd,
  IconClose,
} from "@/lib/icons";
import { CreateActionSheet } from "./create-action-sheet";

const NAV_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Home: IconHome,
  Grid: IconGrid,
  Headset: IconHeadset,
  Settings: IconSettings,
};

interface IndicatorBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function BottomNav() {
  const pathname = usePathname();
  const activePath = getActiveBottomNavPath(pathname);

  const barRef = useRef<HTMLElement>(null);
  // Measured element per destination — the inner capsule span, not the
  // full-width link, so the indicator hugs the icon + label.
  const capsuleRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const [indicator, setIndicator] = useState<IndicatorBox | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const measure = useCallback(() => {
    const bar = barRef.current;
    const capsule = activePath ? capsuleRefs.current[activePath] : null;
    if (!bar || !capsule) {
      setIndicator(null);
      return;
    }
    const b = bar.getBoundingClientRect();
    const c = capsule.getBoundingClientRect();
    setIndicator({
      left: c.left - b.left,
      top: c.top - b.top,
      width: c.width,
      height: c.height,
    });
  }, [activePath]);

  // Measure after mount and whenever the active destination changes. Also
  // re-measure on resize and once web fonts settle (the label width shifts
  // when Vazir loads). All listeners are cleaned up.
  useEffect(() => {
    measure();

    const bar = barRef.current;
    let ro: ResizeObserver | undefined;
    if (bar && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(bar);
    }
    window.addEventListener("resize", measure);

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => measure()).catch(() => undefined);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Close the sheet on any route change (link tap, browser back/forward).
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        ref={barRef}
        dir="rtl"
        aria-label="منوی پایین"
        style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        className={[
          "pointer-events-auto fixed inset-x-3 mx-auto flex h-16 max-w-[440px] items-center",
          "rounded-full border border-glass-border bg-glass-surface-strong backdrop-blur-xl",
          "[box-shadow:var(--bottom-nav-shadow)]",
          // While the sheet is open the bar rides above it so the centre
          // button (now showing ×) stays visible and tappable.
          sheetOpen ? "z-[70]" : "z-40",
        ].join(" ")}
      >
        {/* Sliding active capsule — decorative, never receives taps. */}
        {indicator && (
          <span
            aria-hidden="true"
            data-nav-indicator
            className="bottom-nav-indicator pointer-events-none absolute z-0 rounded-full"
            style={{
              left: indicator.left,
              top: indicator.top,
              width: indicator.width,
              height: indicator.height,
              background: "var(--bottom-nav-capsule-bg)",
              boxShadow: "inset 0 0 0 1px var(--bottom-nav-capsule-ring)",
            }}
          />
        )}

        {/* Destination links. Always live — the sheet is non-modal, so a
            single tap here navigates and closes the sheet in one gesture. */}
        <div className="flex h-full w-full items-center">
          {/* Two equal `flex-1` groups flank a fixed centre gap, so the
              centre action is always exactly centred no matter which
              destination is expanded. */}
          <div className="flex h-full flex-1 items-center justify-around">
            {bottomNavDestinations.slice(0, 2).map((dest) => (
              <NavDestination
                key={dest.path}
                dest={dest}
                isActive={activePath === dest.path}
                onNavigate={closeSheet}
                registerCapsule={(el) => {
                  capsuleRefs.current[dest.path] = el;
                }}
              />
            ))}
          </div>

          {/* Centre column — reserves the centre action's footprint. Kept
              narrow so the two flanking groups still fit an expanded capsule
              plus a 44px touch target at 320px. */}
          <div className="w-10 shrink-0" aria-hidden="true" />

          <div className="flex h-full flex-1 items-center justify-around">
            {bottomNavDestinations.slice(2).map((dest) => (
              <NavDestination
                key={dest.path}
                dest={dest}
                isActive={activePath === dest.path}
                onNavigate={closeSheet}
                registerCapsule={(el) => {
                  capsuleRefs.current[dest.path] = el;
                }}
              />
            ))}
          </div>
        </div>

        {/* Centre action — brand wordmark, toggles the create sheet. The
            whole circle is the hit target; the logo and badge are inert so
            they never swallow the click. Feedback: a subtle brightness lift
            on hover, a short press scale, a brand focus ring, and a distinct
            open state (brighter ring + «×» badge). The logo itself never
            moves or rotates. */}
        <button
          type="button"
          onClick={() => setSheetOpen((open) => !open)}
          aria-label="ساخت جدید"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-controls="create-action-sheet"
          data-center-action
          data-open={sheetOpen ? "true" : "false"}
          className="bottom-nav-center absolute left-1/2 top-[-20px] z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full transition-[transform,filter,box-shadow] duration-[var(--bottom-nav-motion-press)] ease-standard hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bottom-nav-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bottom-nav-body)]"
          style={{ background: "var(--bottom-nav-center-bg)" }}
        >
          <img
            src="/legalir-logo-fa-light.png"
            alt=""
            className="pointer-events-none h-auto w-[42px] select-none"
            draggable={false}
          />
          {/* Corner badge — «+» to open, «×» to close. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{
              background: "var(--bottom-nav-accent)",
              color: "var(--bottom-nav-badge-text)",
            }}
          >
            {sheetOpen ? <IconClose size={14} /> : <IconAdd size={14} />}
          </span>
        </button>

        {/* Centre label — always visible, aligned with the other labels. */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-[38px] z-10 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium"
          style={{ color: "var(--bottom-nav-icon)" }}
        >
          ساخت جدید
        </span>
      </nav>

      <CreateActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

// ============================================================
// NavDestination — one of the four link destinations
// ============================================================

function NavDestination({
  dest,
  isActive,
  onNavigate,
  registerCapsule,
}: {
  dest: { path: string; titleFa: string; icon: string };
  isActive: boolean;
  onNavigate: () => void;
  registerCapsule: (el: HTMLSpanElement | null) => void;
}) {
  const Icon = NAV_ICON_MAP[dest.icon];

  return (
    <Link
      href={dest.path}
      aria-label={dest.titleFa}
      aria-current={isActive ? "page" : undefined}
      // Close the sheet on the same tap that navigates. Clicking the current
      // destination is a no-op route-wise, so this is what dismisses it.
      onClick={onNavigate}
      className="group relative z-10 flex h-full min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bottom-nav-accent)]"
    >
      <span
        ref={registerCapsule}
        data-nav-capsule
        data-active={isActive ? "true" : "false"}
        className={[
          "inline-flex items-center justify-center gap-1 rounded-full px-2 py-2",
          "transition-[background-color,filter] duration-[var(--bottom-nav-motion-color)] ease-standard",
          // Hover wash only on inactive items — an active item already draws
          // the shared indicator, so a second background would double up.
          isActive
            ? "group-hover:brightness-110"
            : "group-hover:bg-glass-state",
        ].join(" ")}
        style={{
          color: isActive
            ? "var(--bottom-nav-accent)"
            : "var(--bottom-nav-icon-muted)",
        }}
      >
        {Icon ? <Icon size={22} /> : null}
        {/* Label collapses to zero width when inactive, so the icon stays
            centred and the capsule stays tight. */}
        <span
          className={[
            "overflow-hidden whitespace-nowrap text-[11px] font-medium leading-none",
            "transition-[max-width,opacity] duration-[var(--bottom-nav-motion-color)] ease-standard",
            isActive ? "max-w-[64px] opacity-100" : "max-w-0 opacity-0",
          ].join(" ")}
        >
          {dest.titleFa}
        </span>
      </span>
    </Link>
  );
}
