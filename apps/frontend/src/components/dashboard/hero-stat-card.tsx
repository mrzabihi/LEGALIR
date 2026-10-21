// ============================================================
// LEGALIR — Hero stat card (the dashboard stat row's one anatomy)
// ============================================================
// Every card in the hero's stat row uses this component. Before it existed
// the five cards each built their own layout — an icon chip here, a donut
// there, a number tucked 11px inside a ring — so the row had five heights,
// five icon positions and five reading orders.
//
// The anatomy is fixed, and every card fills the same four slots:
//
//   1. icon tile (36px, same corner) + the card title
//   2. the value as plain text + its unit — the number is the first thing
//      the eye lands on, at `text-h3`, never buried in a chart
//   3. an optional visual (ring, strip, mini bars). Decorative only: any
//      number it draws is already stated in text above or below.
//   4. a bottom-pinned note above a hairline, so notes line up across the
//      row even when one card has no visual
//
// Geometry never changes between cards; `tone` (default / gold) is the only
// visual axis, and the whole card becomes a link when `href` is supplied.
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type HeroStatTone = "default" | "gold";

/** Shared geometry — identical for every card, every tone. */
const SHELL =
  "group relative flex h-full flex-col overflow-hidden rounded-large border p-3.5 text-white transition-colors duration-short4 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent tablet:p-4";

const TONE: Record<HeroStatTone, { shell: string; tile: string; glow: string }> = {
  default: {
    shell: "border-white/15 bg-white/[0.12] hover:border-white/25 hover:bg-white/[0.18]",
    tile: "bg-white/15 text-white ring-1 ring-inset ring-white/20",
    glow: "rgba(96,165,250,0.30)",
  },
  gold: {
    shell:
      "border-white/15 bg-[linear-gradient(135deg,rgba(176,141,87,0.36),rgba(163,124,60,0.16))] hover:border-[rgba(213,190,151,0.40)]",
    tile: "bg-[rgba(195,165,116,0.20)] text-secondary-200 ring-1 ring-inset ring-[rgba(213,190,151,0.20)]",
    glow: "rgba(195,165,116,0.20)",
  },
};

/**
 * The loading twin of {@link HeroStatCard}.
 *
 * It exists so the hero's stat row has ONE height in every state. A generic
 * `h-20` placeholder block used to stand in here, while the real cards are
 * ~180–210 px tall (they grow with the width of the five-column row), so the
 * whole dashboard below the hero jumped ~115 px the moment data arrived —
 * measured as CLS 0.42 on a 1440×900 viewport, well past the 0.25 "poor"
 * boundary. Reusing the same shell and the same four slot heights reserves
 * the row's final geometry at every breakpoint, so the swap to real content
 * shifts nothing.
 */
export function HeroStatCardSkeleton() {
  // Every slot below copies the real card's MARKUP — same wrapper, same type
  // class, same spacing — and swaps the text for a bar. Where a bar replaces
  // text that sets a line box (`text-h3` digits, the caption note), the bar is
  // placed INSIDE that type class so the box is identical; hand-sizing a flex
  // child instead left the row 8 px short and the note row 9 px short.
  return (
    <div className={`${SHELL} ${TONE.default.shell} animate-pulse`} aria-hidden="true">
      {/* 1 — icon + title */}
      <div className="relative flex items-center gap-2">
        <span className="h-9 w-9 shrink-0 rounded-medium bg-white/15" />
        <span className="min-w-0 text-caption font-medium text-white/80">
          <span className="inline-block h-[1em] w-16 rounded-small bg-white/15 align-middle" />
        </span>
      </div>

      {/* 2 — the value (+ unit). NOT a flex row: inside a flex container the
          line-height of `text-h3` does not set the item's height, so the bar
          measured 9 px shorter than the real digits. As inline content in a
          block, the type class establishes the identical line box. */}
      <p className="relative mt-2 overflow-hidden whitespace-nowrap text-h3 font-bold tabular-nums">
        <span className="inline-block h-[0.72em] w-16 rounded-small bg-white/15 align-baseline" />
        <span className="ms-1.5 align-baseline text-caption font-normal text-white/75">
          <span className="inline-block h-[0.8em] w-6 rounded-small bg-white/10 align-baseline" />
        </span>
      </p>

      {/* 3 — the decorative slot, reserved exactly as the real card does */}
      <div className="relative mt-2 min-h-9" />

      {/* 4 — the pinned note, same min-height + hairline as the real card */}
      <div className="relative mt-auto flex min-h-5 items-center gap-2 overflow-hidden border-t border-white/10 pt-2 text-caption text-white/75">
        {/* `h-5` = the caption line box (20px), so this row is 20 + pt-2 + the
            hairline — exactly the real note row's height. */}
        <span className="inline-block h-5 w-24 rounded-small bg-white/10" />
      </div>
    </div>
  );
}

export interface HeroStatCardProps {
  /** Card name, e.g. «درخواست امروز». */
  title: string;
  /** The glyph inside the 36px tile (size 18 reads best). */
  icon: ReactNode;
  /** The primary value. Already formatted by the caller. */
  value: ReactNode;
  /** Small unit beside the value, e.g. «امتیاز». */
  unit?: string;
  /** Bottom note. Pinned to the card's foot so notes align across the row. */
  note?: ReactNode;
  /** Optional decorative visual (ring / strip / bars) between value and note. */
  children?: ReactNode;
  tone?: HeroStatTone;
  /** Turns the whole card into a link to this route. */
  href?: string;
  /** Accessible name when the card is a link (link text is the value). */
  ariaLabel?: string;
  /** The animated light sweep used by «درخواست فعال». */
  sweep?: boolean;
  /** A blinking status dot on the icon tile. */
  live?: boolean;
  /** Extra classes for the shell (e.g. the points card's column span). */
  className?: string;
}

export function HeroStatCard({
  title,
  icon,
  value,
  unit,
  note,
  children,
  tone = "default",
  href,
  ariaLabel,
  sweep = false,
  live = false,
  className = "",
}: HeroStatCardProps) {
  const t = TONE[tone];

  const body = (
    <>
      {/* Per-card accent wash — the only thing that distinguishes siblings. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -end-8 h-24 w-24 rounded-full opacity-70 blur-2xl transition-opacity duration-long2 group-hover:opacity-100"
        style={{ background: t.glow }}
      />

      {sweep && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span className="absolute top-0 bottom-0 w-1/3 animate-light-sweep bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </span>
      )}

      {/* 1 — icon + title */}
      <div className="relative flex items-center gap-2">
        <span
          className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-medium transition-transform duration-short4 ease-standard group-hover:scale-105 ${t.tile}`}
        >
          {icon}
          {live && (
            <span
              aria-hidden="true"
              className="absolute end-1 top-1 h-2 w-2 rounded-full bg-info-300 animate-status-blink"
            />
          )}
        </span>
        <span className="min-w-0 text-caption font-medium text-white/80">{title}</span>
      </div>

      {/* 2 — the value, always readable text */}
      <p className="relative mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-h3 font-bold tabular-nums" dir="ltr">
          {value}
        </span>
        {unit && <span className="text-caption text-white/75">{unit}</span>}
      </p>

      {/* 3 — optional decorative visual */}
      {children && <div className="relative mt-2 min-h-9">{children}</div>}

      {/* 4 — bottom-pinned note. One line, always: a wrapped note would add
          a second line to that card only and break the row's shared height. */}
      {note && (
        <div className="relative mt-auto flex min-h-5 items-center gap-2 overflow-hidden border-t border-white/10 pt-2 text-caption text-white/75">
          {note}
        </div>
      )}
    </>
  );

  const shell = `${SHELL} ${t.shell} ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
