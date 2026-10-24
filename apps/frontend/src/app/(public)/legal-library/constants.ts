// ============================================================
// LEGALIR — legal library shared constants
// ============================================================
// A plain module with NO "use client" and NO server-only imports, because BOTH
// halves of the listing read it: the server page paginates with it, and the
// client island must request the same page size.
//
// It lives in its own file for a sharp reason: a value exported from a
// `"use client"` module and imported by a server component is a CLIENT
// REFERENCE PROXY at runtime, not the value. Reading it server-side silently
// produced `NaN` (→ `slice(0, NaN)` → an empty first page, i.e. a listing that
// rendered «هنوز منبعی منتشر نشده» while the API returned ten sources).
// ============================================================

/** First-page size for the library listing. Server and client MUST agree. */
export const LIBRARY_PAGE_SIZE = 60;
