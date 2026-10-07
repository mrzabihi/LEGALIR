// ============================================================
// LEGALIR — Analytics: range-preserving drill-down readers
// ============================================================
// A KPI on the BI dashboard links to the operational surface that explains it
// (`/admin/orders`, `/admin/users`). "Preserving the range" means the drill
// carries the SAME window the KPI reported on, so the opened list reconciles
// to the number the operator clicked — never a silently different period.
//
// The window is transported as ISO instants (`fromIso`/`toIso`) because that
// is the resolved form the analytics engine already computed; a preset name
// alone would re-resolve against a different "now" and drift. When the link
// carries only a preset (e.g. a hand-typed URL), this layer re-resolves it.
//
// Read-only over existing tables. Nothing here mutates, and every filter
// reuses the exact `withinWindow` half-open semantics the KPIs use, so a row
// can never fall on the wrong side of a boundary between the KPI and its list.
// ============================================================

import type { AdminOrderListResponse, OrderStatus } from "@legalir/types";
import { listOrders } from "@/lib/admin/orders";
import { maskMobile, readSubscriptions, readUsers, type UserRow } from "./sources";
import { resolveRange, withinWindow, type ResolvedRange } from "./range";

/** The window a drill-down list should be scoped to. */
export interface DrillWindow {
  /** ISO instant bounds (`[fromIso, toIso)`), already resolved. */
  fromIso?: string | null;
  toIso?: string | null;
  /**
   * Fallback when a link carries only a human preset. The ISO bounds win when
   * both are present, so a shared link resolves to the same instant every time.
   */
  preset?: ResolvedRange["preset"];
  rangeDays?: number;
  now?: Date;
}

/** Resolve the requested drill window to concrete ISO bounds (or `null` = all time). */
export function resolveDrillWindow(w: DrillWindow): ResolvedRange | null {
  if (w.fromIso && w.toIso) {
    const fromIso = w.fromIso;
    const toIso = w.toIso;
    const spanMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const rangeDays = Math.max(1, Math.round(spanMs / 86_400_000));
    return {
      preset: w.preset ?? "custom",
      rangeDays,
      fromIso,
      toIso,
      prevFromIso: new Date(new Date(fromIso).getTime() - spanMs).toISOString(),
      prevToIso: fromIso,
    };
  }
  if (w.preset) {
    return resolveRange({ preset: w.preset, rangeDays: w.rangeDays, now: w.now });
  }
  return null;
}

export interface DrillOrdersQuery {
  search?: string;
  status?: OrderStatus | "";
  planCode?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Orders purchased inside the drill window, via the SAME `listOrders` the
 * orders panel uses (so the two surfaces can never disagree on a row). No
 * window → the unfiltered ledger.
 */
export function listDrillOrders(
  window: ResolvedRange | null,
  query: DrillOrdersQuery = {}
): AdminOrderListResponse {
  return listOrders({
    search: query.search,
    status: query.status,
    planCode: query.planCode,
    page: query.page,
    pageSize: query.pageSize,
    ...(window ? { fromIso: window.fromIso, toIso: window.toIso } : {}),
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type DrillUserSort = "recent" | "oldest";

/** The user projection the drill returns — the exact shape the users panel lists. */
export interface DrillUserRow {
  id: string;
  publicId: string | null;
  displayName: string | null;
  mobileMasked: string;
  email: string | null;
  role: string;
  accountType: string;
  hasActiveSubscription: boolean;
  createdAt: string;
}

export interface DrillUsersResponse {
  items: DrillUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DrillUsersQuery {
  search?: string;
  role?: string;
  sort?: DrillUserSort;
  page?: number;
  pageSize?: number;
}

/** User ids with a currently-active subscription (mirrors the users panel). */
function activeUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const s of readSubscriptions()) {
    if (s.status_fa === "فعال" || s.status === "active") ids.add(s.user_id);
  }
  return ids;
}

function toDrillUser(u: UserRow, active: Set<string>): DrillUserRow {
  return {
    id: u.id,
    publicId: u.publicId ?? null,
    displayName: u.displayName,
    mobileMasked: maskMobile(u.mobile),
    email: u.email,
    role: u.role ?? "USER",
    accountType: u.platformAccountType ?? "PERSONAL",
    hasActiveSubscription: active.has(u.id),
    createdAt: u.createdAt,
  };
}

/**
 * Users whose ACCOUNT was created inside the drill window (which is exactly
 * what the «کاربران جدید» KPI counts, so the list matches the number). Sorted
 * newest-first by default. No window → every user.
 */
export function listDrillUsers(
  window: ResolvedRange | null,
  query: DrillUsersQuery = {}
): DrillUsersResponse {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const q = (query.search ?? "").toLowerCase();
  const active = activeUserIds();

  let rows = readUsers();
  if (window) {
    const { fromIso, toIso } = window;
    rows = rows.filter((u) => withinWindow(u.createdAt, fromIso, toIso));
  }
  if (query.role) rows = rows.filter((u) => (u.role ?? "USER") === query.role);
  if (q) {
    rows = rows.filter(
      (u) =>
        (u.displayName ?? "").toLowerCase().includes(q) ||
        maskMobile(u.mobile).includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.publicId ?? "").toLowerCase().includes(q)
    );
  }

  const dir = query.sort === "oldest" ? 1 : -1;
  rows = [...rows].sort((a, b) => dir * a.createdAt.localeCompare(b.createdAt));

  const items = rows.map((u) => toDrillUser(u, active));
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}
