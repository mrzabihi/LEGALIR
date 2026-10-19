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
// on the LEGALIR brand ivory (`--contract-sticky-bg`, #FCF6E8) rather
// than plain white: the deep brand teal is the text, the brand green is
// the progress fill, and the gold is rationed to a single hairline. That
// is what makes "this is the persistent status area" legible at a glance
// while the form scrolls underneath. Elevation is scroll-aware: flat at
// the top of the page, lifted once content slides under it.
// ============================================================

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContractCompletenessSection } from "@legalir/types";
import type { SaveErrorInfo, SaveStatus } from "./wizard-context";
import {
  IconArrowBack,
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
  /** The real reason the last write failed, shown instead of a generic label. */
  saveError?: SaveErrorInfo | null;
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
  saveError = null,
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
            className="inline-flex items-center gap-1 text-caption text-[var(--brand-fg)] transition-colors hover:text-[var(--brand-fg-hover)]"
          >
            {/* RTL: the back arrow must point toward the reading start
                (right). The workspace is always `dir="rtl"`, so the glyph is
                mirrored unconditionally — no dependency on a global helper. */}
            <IconArrowBack className="h-3.5 w-3.5 -scale-x-100" />
            بازگشت به مرکز قراردادها
          </Link>

          {/* Save status — real autosave state, announced politely. */}
          <div className="shrink-0" aria-live="polite">
            <SaveStatusLabel
              status={saveStatus}
              error={saveError}
              lastSavedAt={lastSavedAt}
              onRetry={onRetrySave}
            />
          </div>
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          {/* Phone: clamp the title to two readable lines (a long Persian
              title must not collapse to a single truncation). Tablet and
              up: one truncating line. */}
          <h1 className="line-clamp-2 min-w-0 text-h4 text-[var(--contract-sticky-text)] tablet:line-clamp-none tablet:truncate">
            {title}
          </h1>
          {/* Lifecycle state — a distinct green chip, never competing with
              the title: a whisper of brand green with a readable dark-green
              label and a hairline border. */}
          <span
            className="shrink-0 rounded-full border px-2.5 py-0.5 text-labelSmall bg-[var(--contract-sticky-badge-bg)] text-[var(--contract-sticky-badge-text)]"
            style={{ borderColor: "var(--contract-sticky-badge-border)" }}
          >
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
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--contract-sticky-muted)] transition-colors hover:bg-[var(--contract-sticky-chip)] hover:text-[var(--contract-sticky-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contract-sticky-fill)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--contract-sticky-bg)]"
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
              {/* Current step — the "you are here" anchor on a pale-green
                  chip with dark text. */}
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
            {/* Fill is always the brand green — it never doubles as the
                text colour. */}
            <div
              className="h-full rounded-full bg-[var(--contract-sticky-fill)] transition-all duration-medium2 ease-standard"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Completed count + the remaining section chips — what is left,
              at a glance. On phones the chips ride a single horizontal rail
              so the sticky header never grows to two rows; from `tablet`
              up they wrap normally. */}
          <div className="relative mt-1.5 flex items-center gap-2">
            <span className="shrink-0 text-caption text-[var(--contract-sticky-muted)]">
              {completed} از {total} بخش تکمیل شده
            </span>
            {remaining.length > 0 && (
              <div
                ref={railRef}
                tabIndex={railScrollable ? 0 : undefined}
                aria-label={railScrollable ? "بخش‌های باقی‌مانده قرارداد" : undefined}
                className="scrollbar-hide flex min-w-0 flex-1 gap-1.5 overflow-x-auto rounded-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contract-sticky-fill)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--contract-sticky-bg)] tablet:flex-wrap tablet:overflow-visible"
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
                className="pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-l from-[var(--contract-sticky-bg)] to-transparent tablet:hidden"
              />
            )}
          </div>

          {blockers.length > 0 && (
            /* Warning band — a soft gold wash tuned to the ivory surface,
               with the dark warning ink. Never a saturated red. `items-start`
               keeps the icon on the first line when the label wraps. */
            <p className="mt-1.5 flex items-start gap-1.5 rounded-small border border-warning-200 bg-warning-50 px-2 py-1 text-caption text-warning-700">
              <IconWarning size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                {blockers.length} مورد مانع امضا: {blockers.map((b) => b.labelFa).join("، ")}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Gold hairline — a single premium accent at the start edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 start-0 h-px w-16 bg-[var(--contract-sticky-accent)] opacity-70"
      />
    </header>
  );
}

function SaveStatusLabel({
  status,
  error,
  lastSavedAt,
  onRetry,
}: {
  status: SaveStatus;
  error: SaveErrorInfo | null;
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
    // The REAL cause, not a generic label. A retry is only offered when it
    // can actually change the outcome: resending a request the server has
    // already rejected as "not editable" or "invalid step" would just
    // reproduce the same error forever.
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-error">
        <IconWarning size={14} className="shrink-0" />
        <span className="min-w-0">
          ذخیره نشد{error ? ` — ${error.messageFa}` : ""}
        </span>
        {(!error || error.retryable) && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contract-sticky-fill)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--contract-sticky-bg)]"
          >
            <IconRefresh size={12} />
            تلاش مجدد
          </button>
        )}
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-[var(--brand-fg)]">
        {/* Brand-green dot — the fill colour, kept off the text so the
            label itself stays at WCAG AA on the ivory surface. */}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--contract-sticky-fill)]"
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
