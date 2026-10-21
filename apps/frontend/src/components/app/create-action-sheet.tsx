// ============================================================
// LEGALIR — «ساخت جدید» create-action sheet (non-modal)
// ============================================================
// The bottom sheet opened by the centre button of the mobile navigation.
// It is a light, rounded surface that leads with the legal chat as ONE
// full-width featured card, above a two-column grid of three specialist
// actions (two in the first row, one in the second), and closes with a
// distinct «مشاوره با وکلا» card — a human service, set apart from the AI
// quick-starts by its gold accent. Opening the sheet never creates anything —
// each action is a real link into an existing flow, and picking one closes the
// sheet and navigates.
//
// VISUALS. The brand "soft shapes" illustration (a light, legal-themed
// artwork) sits as a whisper behind the header and the featured card, fading
// into the plain sheet surface so every card stays fully legible, and dimmed
// further in the dark theme. Cards share one radius/spacing language drawn
// from the design system; the only accent hues are the brand green (services)
// and the brand gold (the single small emphasis + the human-consultation
// card). Entrances are short and stagger slightly, and are neutralised by the
// global `prefers-reduced-motion` guard; decorative hover motion is gated to
// fine pointers via `can-hover:`.
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
import { createActions, lawyerConsultation } from "@/lib/routes";
import {
  IconClose,
  IconFilePen,
  IconFileSearch,
  IconFileText,
  IconChat,
  IconChevronUp,
  IconChevronRight,
  IconHandshake,
} from "@/lib/icons";

const ACTION_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  FilePen: IconFilePen,
  FileSearch: IconFileSearch,
  FileText: IconFileText,
  Chat: IconChat,
  Handshake: IconHandshake,
};

/**
 * The brand "soft shapes" artwork — one illustration, a lighter 512w
 * derivative on phones and the 1024w file from `tablet` up. Decorative only
 * (`alt=""`, `aria-hidden`) — it sits behind the header and the featured card
 * at a whisper of opacity, so it never competes with the copy.
 */
const SOFT_SHAPES_SRC = "/assets/promo/legalir-soft-shapes.webp";
const SOFT_SHAPES_SRC_SM = "/assets/promo/legalir-soft-shapes-sm.webp";

/** Collapsed detent: tall enough to show the header + the featured card + the
 *  full specialist grid (two rows) without a scroll, but never taller than 85%
 *  of the viewport. Expanded detent: 85% of the viewport. */
const COLLAPSED_MAX_PX = 600;
const EXPANDED_VH = 0.85;
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

  // Remember what had focus when the sheet opened.
  useEffect(() => {
    if (open) previousFocus.current = document.activeElement as HTMLElement;
  }, [open]);

  // Move focus into the sheet once it is actually mounted (the sheet renders
  // a frame after `open` flips, so this must wait for `mounted`).
  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
        ?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, mounted]);

  // Restore focus to the trigger on an explicit close — but NOT when the
  // close came from navigating away (the nav link keeps its own focus).
  useEffect(() => {
    if (open) return;
    const active = document.activeElement;
    const shouldRestore =
      !active ||
      active === document.body ||
      (active instanceof HTMLElement && !!active.closest('[role="dialog"]'));
    if (shouldRestore && previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
  }, [open]);

  // ---- Drag (pointer events, mouse + touch + pen) ---------------------
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore secondary buttons; only the primary pointer drags.
    if (e.button !== 0) return;
    // Never start a drag from an interactive control inside the header —
    // pointer capture would otherwise swallow the button's click.
    if ((e.target as HTMLElement).closest("button, a")) return;
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
    const collapsedPx = Math.min(COLLAPSED_MAX_PX, window.innerHeight * EXPANDED_VH);
    const maxUp = -(window.innerHeight * EXPANDED_VH - collapsedPx);
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

  // The sheet is one featured entry (the legal chat, full-width) above a
  // two-column grid of the remaining specialist services. `createActions`
  // owns the order and the featured flag (see @/lib/routes); the data
  // guarantees exactly one featured action, so the card always renders.
  const featuredAction = createActions.find((a) => a.featured);
  const specialistActions = createActions.filter((a) => !a.featured);

  const state = open ? "open" : "closed";
  const baseHeight = expanded
    ? `${EXPANDED_VH * 100}dvh`
    : `min(${COLLAPSED_MAX_PX}px, ${EXPANDED_VH * 100}dvh)`;
  const dragVh =
    dragOffset !== null ? (dragOffset / window.innerHeight) * 100 : 0;
  const height = `calc(${baseHeight} + ${dragVh}dvh)`;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Backdrop — on mobile it stops above the bar so the nav stays
          clickable; on desktop (no bar) it covers the full height. Tap to
          dismiss. */}
      <div
        data-sheet-backdrop
        className="absolute inset-x-0 top-0 bottom-[calc(84px_+_env(safe-area-inset-bottom,0px))] desktop:bottom-0 bg-scrim animate-fade-in"
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
        className="bottom-nav-sheet animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24 isolate"
        style={{
          height,
          transition: dragOffset !== null ? "none" : undefined,
        }}
      >
        {/* Soft-shapes artwork — a decorative whisper behind the header and the
            featured card. It is clipped to the sheet's rounded top (the sheet
            has `overflow-hidden`), bright on the light surface and dimmed in
            the dark theme, and fades into the plain surface before the card
            grid so no button ever fights the art. Purely decorative: empty
            alt + `aria-hidden`, so it is invisible to assistive tech. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[230px] overflow-hidden opacity-90 dark:opacity-25"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SOFT_SHAPES_SRC}
            srcSet={`${SOFT_SHAPES_SRC_SM} 512w, ${SOFT_SHAPES_SRC} 1024w`}
            sizes="440px"
            alt=""
            width={1024}
            height={768}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_58%,var(--color-surface)_100%)]" />
        </span>

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
                className="touch-target-pad flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
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
                className="touch-target-pad flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
              >
                <IconClose size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Body — the only scroll region. `min-h-0` lets it shrink inside the
            flex column so `overflow-y-auto` actually engages. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-1.5 tablet:px-5">
          <div className="space-y-3">
            {/* Featured entry — the legal chat, one full-width card at the
                top. It is the start for a user who has not yet chosen a
                specialist service, so it reads as the primary action. */}
            {featuredAction && (
              <Link
                href={featuredAction.href}
                onClick={onClose}
                className="create-feature-card group relative flex items-center gap-3.5 rounded-large border border-primary/30 bg-primary-container px-4 py-3.5 shadow-elevation-1 transition-[transform,border-color,box-shadow] duration-short4 ease-standard can-hover:hover:-translate-y-0.5 can-hover:hover:border-primary/50 can-hover:hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 animate-create-card animate-create-card-m1"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-primary text-primary-on shadow-elevation-1">
                  {(() => {
                    const Icon = ACTION_ICON_MAP[featuredAction.icon];
                    return Icon ? <Icon size={24} /> : null;
                  })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body-1 font-semibold text-on-surface">
                      {featuredAction.titleFa}
                    </span>
                    <span className="create-feature-badge rounded-full bg-[var(--brand-gold)] px-2 py-0.5 text-[10px] font-medium leading-none text-[var(--brand-teal)]">
                      شروع پیشنهادی
                    </span>
                  </span>
                  <span className="mt-1 block whitespace-pre-line text-caption leading-relaxed text-muted">
                    {featuredAction.descriptionFa}
                  </span>
                </span>
                <IconChevronRight
                  size={18}
                  className="shrink-0 text-primary transition-transform duration-short4 ease-standard can-hover:group-hover:-translate-x-0.5"
                />
              </Link>
            )}

            {/* Specialist services — two-column grid from `tablet` up. An odd
                count would leave the final row half empty, so the trailing
                card takes the full width instead: the grid always reads as
                complete rather than unfinished. On phones the grid collapses
                to one column in the same order, so a narrow screen never
                forces a horizontal scroll. */}
            <div className="grid grid-cols-1 gap-2.5 tablet:grid-cols-2">
              {specialistActions.map((action, i) => {
                const Icon = ACTION_ICON_MAP[action.icon];
                const fillsRow = specialistActions.length % 2 === 1 && i === specialistActions.length - 1;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    onClick={onClose}
                    className={`group flex min-h-[84px] items-center gap-3 rounded-large border border-divider bg-surface-container-low p-3 transition-[transform,background-color,border-color,box-shadow] duration-short4 ease-standard can-hover:hover:-translate-y-0.5 can-hover:hover:border-primary/25 can-hover:hover:bg-surface-container can-hover:hover:shadow-elevation-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 animate-create-card animate-create-card-m${
                      i + 2
                    } ${fillsRow ? "tablet:col-span-2" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-secondary-50 text-secondary-700 transition-colors duration-short4 ease-standard group-hover:bg-secondary-100">
                      {Icon ? <Icon size={22} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body-2 font-semibold text-on-surface">
                        {action.titleFa}
                      </span>
                      <span className="mt-0.5 block text-caption leading-snug text-muted">
                        {action.descriptionFa}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Lawyer consultation — a DISTINCT closing card. Unlike the four
                AI quick-starts above, this one leads to a human service, so it
                is set apart with the brand-gold accent instead of the green
                used by the chat and the specialist grid. */}
            <Link
              href={lawyerConsultation.href}
              onClick={onClose}
              className="group relative flex items-center gap-3.5 overflow-hidden rounded-large border border-[color:color-mix(in_srgb,var(--brand-gold)_38%,transparent)] bg-[color-mix(in_srgb,var(--brand-gold)_12%,var(--color-surface))] p-3.5 transition-[transform,border-color,box-shadow] duration-short4 ease-standard can-hover:hover:-translate-y-0.5 can-hover:hover:border-[color:color-mix(in_srgb,var(--brand-gold)_62%,transparent)] can-hover:hover:shadow-elevation-2 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] animate-create-card animate-create-card-m5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-[var(--brand-gold)] text-[var(--brand-teal)] shadow-elevation-1">
                <IconHandshake size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-1 font-semibold text-on-surface">
                  {lawyerConsultation.titleFa}
                </span>
                <span className="mt-0.5 block text-caption leading-snug text-muted">
                  {lawyerConsultation.descriptionFa}
                </span>
              </span>
              <IconChevronRight
                size={18}
                className="shrink-0 text-on-surface-variant transition-transform duration-short4 ease-standard can-hover:group-hover:-translate-x-0.5"
              />
            </Link>
          </div>
        </div>

        {/* Nav-clearance spacer — keeps the floating bar (and its raised
            centre button) off the scroll region on mobile. It collapses on
            desktop, where there is no bar to clear. */}
        <div
          aria-hidden="true"
          className="h-[calc(84px_+_env(safe-area-inset-bottom,0px))] desktop:hidden shrink-0"
        />
      </div>
    </div>,
    document.body
  );
}
