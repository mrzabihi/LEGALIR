// ============================================================
// LEGALIR — «ساخت جدید» create-action sheet (non-modal)
// ============================================================
// The bottom sheet opened by the centre button of the mobile navigation.
// It is a light, rounded surface with a two-column grid of four quick-start
// actions. Opening the sheet never creates anything — each action is a real
// link into an existing flow, and picking one closes the sheet and navigates.
//
// NON-MODAL BY DESIGN. The bar must stay usable while the sheet is open, so
// this sheet deliberately does NOT:
//   • trap focus (the user can Tab out to the nav),
//   • set `aria-modal="true"`,
//   • cover the bar with a backdrop (the scrim stops above the bar),
//   • lock page scroll (the page behind stays scrollable).
// A single tap on any destination therefore both closes the sheet and
// navigates — no second click, no × first.
//
// The sheet is portalled to <body> so it is never clipped by the shell's
// stacking contexts (the bar uses backdrop-blur, which creates one). It
// renders through a short exit animation: `open` drives the enter, and a
// `closing` phase keeps it mounted until the exit finishes.
//
// The drag handle uses Pointer Events (mouse + touch + pen) with pointer
// capture. Dragging up grows the sheet's real height; releasing snaps to the
// nearest of two detents. A keyboard-accessible «بازتر کردن» button offers
// the same expand without a pointer.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createActions } from "@/lib/routes";
import {
  IconClose,
  IconFilePen,
  IconFileSearch,
  IconFileText,
  IconChat,
  IconChevronUp,
} from "@/lib/icons";

const ACTION_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  FilePen: IconFilePen,
  FileSearch: IconFileSearch,
  FileText: IconFileText,
  Chat: IconChat,
};

/** Sheet detents as a fraction of the viewport height. */
const DETENT_COLLAPSED = 0.5;
const DETENT_EXPANDED = 0.85;
/** Drag distance (px) past which a release snaps to the other detent. */
const SNAP_THRESHOLD = 64;

interface CreateActionSheetProps {
  open: boolean;
  onClose: () => void;
}

export function CreateActionSheet({ open, onClose }: CreateActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // `mounted` keeps the sheet in the DOM through its exit animation.
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(false);
  // Live drag offset in px (negative = dragged up). null when not dragging.
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const drag = useRef<{ startY: number; pointerId: number } | null>(null);

  // ---- Mount / unmount with an exit animation -------------------------
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Reset the detent each time the sheet opens.
  useEffect(() => {
    if (open) setExpanded(false);
  }, [open]);

  // Escape closes. No focus trap — the nav stays reachable.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the sheet on open; restore it on explicit close only.
  // (On a route change the sheet unmounts without stealing focus back.)
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const raf = requestAnimationFrame(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
        ?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open]);

  // ---- Drag (pointer events, mouse + touch + pen) ---------------------
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore secondary buttons; only the primary pointer drags.
    if (e.button !== 0) return;
    drag.current = { startY: e.clientY, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragOffset(0);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // Upward drags are negative; clamp so the sheet can't be pulled below
    // its collapsed height or above the expanded detent.
    const raw = e.clientY - d.startY;
    const maxUp = -(window.innerHeight * (DETENT_EXPANDED - DETENT_COLLAPSED));
    setDragOffset(Math.max(maxUp, Math.min(0, raw)));
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const offset = dragOffset ?? 0;
      // A short tap (no meaningful movement) toggles the detent; a real drag
      // snaps by direction.
      if (Math.abs(offset) < 8) {
        setExpanded((v) => !v);
      } else if (offset < -SNAP_THRESHOLD) {
        setExpanded(true);
      } else if (offset > SNAP_THRESHOLD) {
        setExpanded(false);
      }
      setDragOffset(null);
    },
    [dragOffset]
  );

  if (!mounted || typeof document === "undefined") return null;

  const state = open ? "open" : "closed";
  const baseHeight = expanded ? DETENT_EXPANDED : DETENT_COLLAPSED;
  const heightVh = baseHeight * 100;
  const dragVh =
    dragOffset !== null ? (dragOffset / window.innerHeight) * 100 : 0;
  const height = `calc(${heightVh}dvh + ${dragVh}dvh)`;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Backdrop — stops above the bar so the nav stays clickable. Tap to
          dismiss. Hidden while dragging so the drag reads cleanly. */}
      <div
        className="absolute inset-x-0 top-0 bg-scrim/40 animate-fade-in"
        style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        id="create-action-sheet"
        role="dialog"
        aria-label="ساخت جدید"
        data-state={state}
        className="bottom-nav-sheet animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24"
        style={{
          height,
          transition: dragOffset !== null ? "none" : undefined,
        }}
      >
        {/* Header — fixed. The whole strip is the drag handle. */}
        <div
          data-drag-handle
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        >
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="h-1.5 w-10 rounded-full bg-outline-variant" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
            <div>
              <h2 id="create-action-sheet-title" className="text-h3 text-on-surface">
                ساخت جدید
              </h2>
              <p className="mt-1 text-body-2 text-muted">
                چه کاری می‌خواهید انجام دهید؟
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Accessible alternative to dragging. */}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "کوچک کردن پنل" : "بازتر کردن پنل"}
                aria-expanded={expanded}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
              >
                <IconChevronUp
                  size={20}
                  className={[
                    "transition-transform duration-[var(--bottom-nav-motion-color)] ease-standard",
                    expanded ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن"
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
              >
                <IconClose size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Body — the only scroll region. `min-h-0` lets it shrink inside the
            flex column so `overflow-y-auto` actually engages. Bottom padding
            clears the floating bar so the last action is fully clickable. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-24 pt-2">
          <div className="grid grid-cols-2 gap-3">
            {createActions.map((action) => {
              const Icon = ACTION_ICON_MAP[action.icon];
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  onClick={onClose}
                  className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-divider bg-surface-container-low px-4 py-3.5 transition-colors hover:bg-surface-container active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700 transition-colors group-hover:bg-secondary-100">
                    {Icon ? <Icon size={22} /> : null}
                  </span>
                  <span className="text-body-2 font-medium text-on-surface">
                    {action.titleFa}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
