// ============================================================
// LEGALIR — Admin list pagination contract (server-side)
// ============================================================
// ONE page-size contract for every admin list endpoint, so the API and the
// shared <Pagination> control can never drift:
//
//   • default page size = 20
//   • selectable page sizes = 10 | 20 | 100   (anything else falls back)
//
// Endpoints parse `page` + `pageSize` with the resolvers below, run
// Search → Filters → Sort over the FULL authorised set, then hand the sorted
// rows to {@link paginate}. The count returned is the count of rows that
// match the query — never the size of the current page — which is what makes
// "جستجوی سراسری" honest: a hit on record 800 is found, not just the 20 on
// screen. Pages are 1-based.
// ============================================================

/** The only accepted page sizes. */
export const PAGE_SIZE_OPTIONS = [10, 20, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/** Default rows per page when the caller does not ask (or asks wrongly). */
export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** Parse a raw `pageSize` to an allowed value, else the fallback. */
export function resolvePageSize(
  raw: string | number | null | undefined,
  fallback: number = DEFAULT_PAGE_SIZE
): number {
  const n =
    typeof raw === "number" ? raw : raw != null && raw !== "" ? Number.parseInt(raw, 10) : NaN;
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

/** Parse a raw `page` to a 1-based integer (>= 1). */
export function resolvePage(raw: string | number | null | undefined): number {
  const n =
    typeof raw === "number" ? raw : raw != null && raw !== "" ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** A paginated window over a pre-filtered, pre-sorted array. */
export interface Paged<T> {
  items: T[];
  /** Total rows matching the query (across ALL pages). */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Slice `rows` to the requested window. The page is clamped into range so a
 * stale `?page=9` after a narrowing search returns the LAST page (never an
 * empty window), and `totalPages` is always >= 1 so the UI pager stays sane
 * even for an empty result set.
 */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Paged<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
