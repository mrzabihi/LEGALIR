// ============================================================
// LEGALIR — Contract-listing pagination
// ============================================================
// One pure function owns "which page am I on and what does it hold" for
// the /contracts/templates listing. Keeping the arithmetic here (rather
// than inline in the component) makes the two rules testable without a
// browser:
//
//   • a page NEVER holds more than `CONTRACTS_PAGE_SIZE` items;
//   • a page beyond the end is CLAMPED to the last real page instead of
//     rendering an empty screen (a shared link can outlive a filter).
//
// The page itself stays in the URL; this module only interprets it.
// ============================================================

/** Hard cap per page for the contract listing. */
export const CONTRACTS_PAGE_SIZE = 20;

export interface PageSlice<T> {
  /** The items the current page renders. */
  items: T[];
  /** The clamped 1-based page. */
  page: number;
  /** At least 1 — an empty result still has a single (empty) page. */
  totalPages: number;
  /** The full result count, before the slice. */
  total: number;
}

/**
 * Slice `items` for `requestedPage`. A non-finite, negative or
 * out-of-range page is clamped into `[1, totalPages]`.
 */
export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number = CONTRACTS_PAGE_SIZE
): PageSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages)
    : 1;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, totalPages, total };
}
