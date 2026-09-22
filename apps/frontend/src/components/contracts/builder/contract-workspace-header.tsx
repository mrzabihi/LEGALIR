// ============================================================
// LEGALIR — Contract workspace header
// ============================================================
// The sticky header of the contract draft workspace. It is a
// WORKSPACE, not a discovery surface, so it is deliberately quiet:
// no glassmorphism, no glow — a solid surface and two levels of
// hierarchy.
//
//   LEVEL 1 — identity: back link, title, reference code, status.
//   LEVEL 2 — progress: «تکمیل قرارداد», the percentage, a 6px bar,
//             «۲ از ۵ بخش تکمیل شده» and the remaining section chips.
//
// The save status is REAL — it is the wizard's autosave state, not a
// decorative label — and it is announced politely so a screen-reader
// user hears "ذخیره شد" without the header stealing focus.
//
// SURFACE — the header floats above the white contract form, so it sits
// on a soft light-blue control surface (`--contract-sticky-*`) rather
// than plain white. That is what makes "this is the persistent status
// area" legible at a glance while the form scrolls underneath. Elevation
// is scroll-aware: flat at the top of the page, lifted once content
// slides under it.
// ============================================================

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContractCompletenessSection } from "@legalir/types";
import type { SaveStatus } from "./wizard-context";
import {
  IconArrowForward,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";

interface ContractWorkspaceHeaderProps {
  title: string;
  referenceCode: string;
  typeFa: string;
  /** The raw lifecycle state label, e.g. «پیش‌نویس». */
  stateFa: string;
  /** 0–100 server-computed completeness. */
  progress: number;
  sections: ContractCompletenessSection[];
  /** Sections that still block signing. */
  blockers: { sectionKey: string; labelFa: string; stepId: string }[];
  stepIndex: number;
  stepCount: number;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  onRetrySave: () => void;
  onCopyId: () => void;
}

/**
 * The nearest scrollable ancestor. The header is `sticky` inside the app
 * shell's `<main class="overflow-auto">`, not the window, so a plain
 * `window.scrollY` check would never fire. Walk up until we find the
 * element that actually scrolls.
 */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export function ContractWorkspaceHeader({
  title,
  referenceCode,
  typeFa,
  stateFa,
  progress,
  sections,
  blockers,
  stepIndex,
  stepCount,
  saveStatus,
  lastSavedAt,
  onRetrySave,
  onCopyId,
}: ContractWorkspaceHeaderProps) {
  const completed = sections.filter((s) => s.percent === 100).length;
  const total = sections.length;
  const remaining = sections.filter((s) => s.percent < 100);

  // Scroll-aware elevation — the header is flat at the top of the page and
  // lifts once the form slides underneath it. No animation beyond a short
  // shadow transition.
  const headerRef = useRef<HTMLElement>(null);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const scroller = findScrollParent(headerRef.current);
    const readTop = () => (scroller ? scroller.scrollTop : window.scrollY);

    const onScroll = () => setElevated(readTop() > 4);
    onScroll();

    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  // The mobile chip rail is horizontally scrollable, so the header height
  // depends on whether a scrollbar is present. Publish the measured height
  // as a CSS variable; the wizard's desktop step rail reads it to keep its
  // own sticky offset correct instead of guessing a magic number.
  const railRef = useRef<HTMLDivElement>(null);
  const [railScrollable, setRailScrollable] = useState(false);

  const syncRail = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setRailScrollable(el.scrollWidth - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    syncRail();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncRail);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncRail]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      el.parentElement?.style.setProperty(
        "--contract-header-h",
        `${el.offsetHeight}px`
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-20 border-b bg-[var(--contract-sticky-bg)] text-[var(--contract-sticky-text)] transition-shadow duration-200 ease-standard ${
        elevated ? "shadow-contract-sticky" : "shadow-none"
      }`}
      style={{ borderBottomColor: "var(--contract-sticky-border)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-2">
        {/* LEVEL 1 — contract identity */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1 text-caption text-[var(--contract-sticky-muted)] transition-colors hover:text-[var(--contract-sticky-text)]"
          >
            <IconArrowForward className="h-3.5 w-3.5" />
            بازگشت به مرکز قراردادها
          </Link>

          {/* Save status — real autosave state, announced politely. */}
          <div className="shrink-0" aria-live="polite">
            <SaveStatusLabel
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              onRetry={onRetrySave}
            />
          </div>
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-h4 text-[var(--contract-sticky-text)] max-mobile-l:line-clamp-2 max-mobile-l:whitespace-normal">
            {title}
          </h1>
          {/* Lifecycle state — the one bronze accent in the header. */}
          <span className="shrink-0 rounded-full border border-[var(--contract-sticky-accent)] bg-secondary-container px-2.5 py-0.5 text-labelSmall text-on-secondary-container">
            {stateFa}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-caption text-[var(--contract-sticky-muted)]">
          <span className="truncate">
            {referenceCode} — {typeFa}
          </span>
          <button
            type="button"
            onClick={onCopyId}
            aria-label="کپی شناسه قرارداد"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--contract-sticky-muted)] transition-colors hover:bg-[var(--contract-sticky-chip)]"
          >
            <IconCopy size={14} />
          </button>
        </div>

        {/* LEVEL 2 — progress. One compact row: the section title, the
            "you are here" step chip, and the percentage. */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-labelLarge text-[var(--contract-sticky-text)]">
                تکمیل قرارداد
              </span>
              {/* Current step — the "you are here" anchor, navy emphasis. */}
              <span className="shrink-0 rounded-full bg-[var(--contract-sticky-chip-strong)] px-2 py-0.5 text-labelSmall text-[var(--contract-sticky-text)]">
                مرحله {stepIndex + 1} از {stepCount}
              </span>
            </span>
            <span className="shrink-0 text-labelMedium text-[var(--contract-sticky-text)]">
              {progress}٪
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="پیشرفت تکمیل قرارداد"
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--contract-sticky-track)]"
          >
            <div
              className={`h-full rounded-full transition-all duration-medium2 ease-standard ${
                progress === 100 ? "bg-success" : "bg-[var(--contract-sticky-text)]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Completed count + the remaining section chips — what is left,
              at a glance. On mobile the chips ride a single horizontal rail
              so the sticky header never grows to two rows; from `mobile-l`
              up they wrap normally. */}
          <div className="relative mt-1.5 flex items-center gap-2">
            <span className="shrink-0 text-caption text-[var(--contract-sticky-muted)]">
              {completed} از {total} بخش تکمیل شده
            </span>
            {remaining.length > 0 && (
              <div
                ref={railRef}
                className="scrollbar-hide flex min-w-0 flex-1 gap-1.5 overflow-x-auto mobile-l:flex-wrap mobile-l:overflow-visible"
              >
                {remaining.slice(0, 6).map((section) => (
                  <span
                    key={section.key}
                    className="shrink-0 rounded-full bg-[var(--contract-sticky-chip)] px-2.5 py-0.5 text-labelSmall text-[var(--contract-sticky-muted)]"
                  >
                    {section.labelFa}
                  </span>
                ))}
                {remaining.length > 6 && (
                  <span className="shrink-0 rounded-full bg-[var(--contract-sticky-chip)] px-2.5 py-0.5 text-labelSmall text-[var(--contract-sticky-muted)]">
                    +{remaining.length - 6}
                  </span>
                )}
              </div>
            )}
            {/* Fade hint that the rail continues past the edge. */}
            {railScrollable && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-l from-[var(--contract-sticky-bg)] to-transparent mobile-l:hidden"
              />
            )}
          </div>

          {blockers.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-caption text-warning-700">
              <IconWarning size={14} />
              {blockers.length} مورد مانع امضا: {blockers.map((b) => b.labelFa).join("، ")}
            </p>
          )}
        </div>
      </div>

      {/* Bronze hairline — a single premium accent at the start edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 start-0 h-px w-16 bg-[var(--contract-sticky-accent)] opacity-70"
      />
    </header>
  );
}

function SaveStatusLabel({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
  onRetry: () => void;
}) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-[var(--contract-sticky-muted)]">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        در حال ذخیره...
      </span>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-caption text-error hover:underline"
      >
        <IconRefresh size={14} />
        ذخیره انجام نشد — تلاش مجدد
      </button>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-success">
        {/* Brand-green dot — the fill colour, kept off the text so the
            label itself stays at WCAG AA on the blue surface. */}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-control-selected"
          aria-hidden="true"
        />
        همه تغییرات ذخیره شده‌اند
      </span>
    );
  }

  return (
    <span className="text-caption text-[var(--contract-sticky-muted)]">
      ذخیره خودکار فعال است
    </span>
  );
}
