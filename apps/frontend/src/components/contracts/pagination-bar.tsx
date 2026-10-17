// ============================================================
// LEGALIR — Contracts pagination bar
// ============================================================
// The shared pager for the template surfaces. It exists so every
// contract listing speaks the same vocabulary: the same numbers
// (Persian digits), the same target sizes, the same disabled treatment,
// and the same assistive-tech labels.
//
// It states the PAGE, the TOTAL PAGES and the RANGE currently visible
// («۱ تا ۹ از ۹ قالب قرارداد»), so a user always knows where they are
// without counting cards.
//
// Mobile: the numeric window shrinks to «prev · page x / y · next» —
// a full number strip of ellipses is unusable on a phone, and the
// summary line already carries the totals.
// ============================================================

"use client";

import { toPersianNumber } from "@/lib/persian-utils";
import { IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total item count, used for the «N مورد» line. */
  total: number;
  /** Singular Persian noun for the count, e.g. «قالب قرارداد». */
  itemLabel?: string;
  /**
   * How many items a page holds. Supplied so the bar can state the
   * visible RANGE (e.g. «۱۱ تا ۲۰») without re-deriving it.
   */
  pageSize?: number;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Page numbers to render: always the first and last page, the current
 * page and its neighbours, with an ellipsis where a gap exists. Keeps
 * the bar at a fixed width however many pages there are.
 */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

const ARROW_CLASS =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] text-on-surface transition-colors duration-short3 can-hover:hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40";

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  total,
  itemLabel = "مورد",
  pageSize,
  className = "",
}: PaginationBarProps) {
  if (totalPages <= 1) {
    return (
      <p className={`text-center text-caption text-muted ${className}`} aria-live="polite">
        {toPersianNumber(total)} {itemLabel}
      </p>
    );
  }

  const window = pageWindow(page, totalPages);
  const first = pageSize ? (page - 1) * pageSize + 1 : null;
  const last = pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <nav
      aria-label="صفحه‌بندی"
      className={`flex flex-col items-center gap-3 tablet:flex-row tablet:justify-between ${className}`}
    >
      <p className="text-caption text-muted" aria-live="polite">
        {first !== null && last !== null ? (
          <>
            {toPersianNumber(first)} تا {toPersianNumber(last)} از {toPersianNumber(total)}{" "}
            {itemLabel}
          </>
        ) : (
          <>
            {toPersianNumber(total)} {itemLabel}
          </>
        )}
        <span aria-hidden="true"> · </span>
        صفحه {toPersianNumber(page)} از {toPersianNumber(totalPages)}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="صفحه قبل"
          className={ARROW_CLASS}
        >
          <IconChevronRightSmall size={20} aria-hidden="true" />
        </button>

        {/* Phone: a single compact indicator instead of the number strip. */}
        <span className="px-2 text-labelMedium text-on-surface-variant tablet:hidden">
          {toPersianNumber(page)} / {toPersianNumber(totalPages)}
        </span>

        <div className="hidden items-center gap-1 tablet:flex">
          {window.map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="w-6 text-center text-caption text-muted"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-label={`صفحه ${toPersianNumber(entry)}`}
                aria-current={entry === page ? "page" : undefined}
                className={[
                  "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-labelMedium transition-colors duration-short3",
                  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                  entry === page
                    ? "bg-primary text-primary-on"
                    : "text-on-surface can-hover:hover:bg-surface-hover",
                ].join(" ")}
              >
                {toPersianNumber(entry)}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="صفحه بعد"
          className={ARROW_CLASS}
        >
          <IconChevronLeft size={20} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
