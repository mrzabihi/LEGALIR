// ============================================================
// LEGALIR — useClientPagination
// ============================================================
// The client-side twin of the server `paginate` contract (lib/admin/pagination):
// same 10/20/100 page sizes and the same 20-row default, applied to an array an
// admin page has ALREADY fetched wholesale and filtered locally. It exists so a
// page that legitimately holds its whole (bounded) dataset in memory still
// presents the identical pager the server-paginated pages do — one look, one
// behaviour, everywhere.
//
// It owns the page + pageSize state and clamps the page into range when the list
// shrinks (a narrowing filter can never strand the operator on an empty page).
// Feed it the FILTERED + SORTED array, so search → filter → sort → paginate
// stays the order.
// ============================================================

import { useCallback, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";

export interface ClientPagination<T> {
  /** The rows for the current page. */
  pageItems: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** Reset to page 1 (e.g. after a search/filter change). */
  reset: () => void;
}

/**
 * Paginate `rows` (already filtered + sorted) on the client.
 *
 * @param rows the full filtered list
 * @param initialPageSize defaults to the shared 20-row standard
 */
export function useClientPagination<T>(
  rows: readonly T[],
  initialPageSize: number = DEFAULT_PAGE_SIZE
): ClientPagination<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  // Stable handles: `reset` in particular is a dependency of the "return to
  // page 1 when the filter narrows the list" effect on each page, so it must
  // keep its identity across renders — otherwise that effect would re-run (or
  // force an eslint-disable) on every render.
  const handleSetPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);
  const reset = useCallback(() => setPage(1), []);

  return {
    pageItems: rows.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize: handleSetPageSize,
    reset,
  };
}
