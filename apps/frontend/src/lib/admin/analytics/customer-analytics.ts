// ============================================================
// LEGALIR — Analytics: Reports 3 & 4 — customers
// ============================================================
// Report 3 — purchase ranking (window-scoped): who bought, how much, net of
// refunds, and when they were last seen.
// Report 4 — LRFM segmentation, implemented EXACTLY per
// docs/NLRFM_DEFINITION.md. There is no "N" dimension because LEGALIR has no
// documented N; the only N-like signal is the separately-labelled
// «تازه / بازگشتی» flag. Every threshold here is declared in that document and
// surfaced in the UI.
//
// The LRFM cohort is the customer population: platform staff accounts are
// excluded because a staff member is not a customer (they would only inflate
// the «بدون خرید» bucket). This exclusion is stated in the report's note.
//
// Amounts are integers in Toman (IRT). "Now" is injectable for tests.
// ============================================================

import type {
  CustomerAnalyticsReport,
  LrfmRow,
  LrfmSegment,
  LrfmSegmentRow,
  PurchaseRankingPage,
  PurchaseRankingRow,
  PurchaseRankingSort,
} from "@legalir/types";
import { isStaffRole, type PlatformRole } from "@legalir/types";
import {
  readSubscriptions,
  readUsers,
  readSessions,
  readActivities,
  readAdjustments,
  userIndex,
  maskMobile,
  earliestDataIso,
  type SubscriptionRow,
  type UserRow,
} from "./sources";
import { resolveRange, toWindowInfo, withinWindow, type ResolveRangeInput } from "./range";
import { analyticsDataQuality } from "./quality";

const DAY_MS = 86_400_000;

/** Whole days from `iso` to `nowMs` (never negative). */
function daysSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / DAY_MS));
}

/** Fractional days between two ISO instants (never negative). */
function gapDays(aIso: string, bIso: string): number {
  return Math.max(0, (new Date(bIso).getTime() - new Date(aIso).getTime()) / DAY_MS);
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length === 0) return 0;
  if (s.length % 2 === 1) return s[mid]!;
  return (s[mid - 1]! + s[mid]!) / 2;
}

/** A legacy row with no role is a plain customer; staff roles are excluded. */
function isCustomerRole(role: string | undefined): boolean {
  if (!role) return true;
  return !isStaffRole(role as PlatformRole);
}

// ---------------------------------------------------------------------------
// Declared thresholds (docs/NLRFM_DEFINITION.md §3) — the single source of truth
// ---------------------------------------------------------------------------

function scoreL(l: number): number {
  if (l >= 365) return 5;
  if (l >= 180) return 4;
  if (l >= 90) return 3;
  if (l >= 30) return 2;
  return 1;
}

function scoreR(r: number): number {
  if (r <= 7) return 5;
  if (r <= 30) return 4;
  if (r <= 90) return 3;
  if (r <= 180) return 2;
  return 1;
}

function scoreF(f: number): number | null {
  if (f <= 0) return null;
  return Math.min(5, f);
}

function scoreM(m: number): number | null {
  if (m <= 0) return null;
  if (m >= 20_000_000) return 5;
  if (m >= 10_000_000) return 4;
  if (m >= 5_000_000) return 3;
  if (m >= 2_000_000) return 2;
  return 1;
}

/** Assign a segment — first matching rule wins (docs/NLRFM_DEFINITION.md §4). */
function segmentFor(
  l: number | null,
  r: number | null,
  f: number,
  lScore: number | null,
  rScore: number | null,
  fScore: number | null,
  mScore: number | null
): LrfmSegment {
  if (f === 0) return "no_purchase";
  if (rScore == null || fScore == null || mScore == null) return "unclassified";
  const R = rScore;
  const F = fScore;
  const M = mScore;
  const L = lScore ?? 1;

  if (R >= 4 && F >= 4 && M >= 4) return "champions";
  if (R >= 4 && F >= 3) return "loyal";
  if (R >= 4 && (F === 1 || F === 2)) return "potential_loyalist";
  if (R === 3 && L <= 3) return "promising";
  if (R === 3 && L >= 4) return "needs_attention";
  if (R === 2 && M >= 3) return "at_risk";
  if (R <= 2 && F >= 2) return "hibernating";
  if (R === 1 && L >= 4) return "lost";
  if (F === 1 && R >= 3) return "new";
  return "unclassified";
}

/** Persian label per segment. */
const SEGMENT_FA: Record<LrfmSegment, string> = {
  champions: "قهرمانان",
  loyal: "وفادار",
  potential_loyalist: "در معرض وفاداری",
  promising: "تازه‌وارد ارزشمند",
  needs_attention: "نیازمند توجه",
  at_risk: "در معرض ریزش",
  hibernating: "رو به خاموشی",
  lost: "ازدست‌رفته",
  new: "تازه",
  unclassified: "نامشخص",
  no_purchase: "بدون خرید",
};

/** Stable display order for the segment table (buyers first, non-buyers last). */
const SEGMENT_ORDER: LrfmSegment[] = [
  "champions",
  "loyal",
  "potential_loyalist",
  "promising",
  "needs_attention",
  "at_risk",
  "hibernating",
  "lost",
  "new",
  "unclassified",
  "no_purchase",
];

// ---------------------------------------------------------------------------
// Per-user facts (lifetime) — the base for every LRFM dimension
// ---------------------------------------------------------------------------

interface UserFacts {
  /** The user's subscriptions, oldest first. */
  purchases: SubscriptionRow[];
  /** Σ completed refunds across the user's orders. */
  refunds: number;
  /** Latest observed activity (purchase / session / activity row). */
  lastActivityIso: string | null;
}

/** Completed refunds keyed by the order (subscription id) they reference. */
function completedRefunds(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of readAdjustments()) {
    if (a.status !== "completed") continue;
    m.set(a.orderId, (m.get(a.orderId) ?? 0) + a.amount);
  }
  return m;
}

/** Build the lifetime per-user facts from the real tables (one pass). */
function collectFacts(refundsByOrder: Map<string, number>): Map<string, UserFacts> {
  const map = new Map<string, UserFacts>();
  const ensure = (id: string): UserFacts => {
    let f = map.get(id);
    if (!f) {
      f = { purchases: [], refunds: 0, lastActivityIso: null };
      map.set(id, f);
    }
    return f;
  };

  const bump = (userId: string, iso: string | undefined | null): void => {
    if (!iso) return;
    const f = ensure(userId);
    if (!f.lastActivityIso || iso > f.lastActivityIso) f.lastActivityIso = iso;
  };

  for (const s of readSubscriptions()) {
    const f = ensure(s.user_id);
    f.purchases.push(s);
    f.refunds += refundsByOrder.get(s.id) ?? 0;
    // R = max(last purchase, last session, last activity) — a purchase is one
    // of the three real activity signals (docs/NLRFM_DEFINITION.md §2).
    bump(s.user_id, s.purchased_at);
  }

  for (const s of readSessions()) bump(s.userId, s.lastActiveAt ?? s.createdAt);
  for (const a of readActivities()) bump(a.user_id, a.created_at);

  for (const f of map.values()) {
    f.purchases.sort((x, y) => x.purchased_at.localeCompare(y.purchased_at));
  }
  return map;
}

/** Compute the raw LRFM dimensions + scores + segment for one user. */
function buildLrfmRow(user: UserRow, facts: UserFacts | undefined, nowMs: number): LrfmRow {
  const purchases = facts?.purchases ?? [];
  const hasPurchase = purchases.length > 0;

  // L — length: first purchase if any, else registration.
  const anchorIso = (hasPurchase ? purchases[0]!.purchased_at : null) ?? user.createdAt;
  const l = anchorIso ? daysSince(anchorIso, nowMs) : null;

  // R — recency: latest purchase / session / activity.
  const r = facts?.lastActivityIso ? daysSince(facts.lastActivityIso, nowMs) : null;

  // F — frequency: count of purchases.
  const f = purchases.length;

  // M — monetary: gross amount minus settled refunds.
  const gross = purchases.reduce((sum, s) => sum + (s.amount || 0), 0);
  const m = gross - (facts?.refunds ?? 0);

  const lScore = l == null ? null : scoreL(l);
  const rScore = r == null ? null : scoreR(r);
  const fScore = scoreF(f);
  const mScore = scoreM(m);
  const segment = segmentFor(l, r, f, lScore, rScore, fScore, mScore);

  // New vs Returning — a separate, explicitly-named flag (not an "N" score).
  const months = new Set(purchases.map((s) => s.purchased_at.slice(0, 7)));
  const returning = f >= 2 || months.size >= 2;
  const isNew = hasPurchase && !returning;

  return {
    userId: user.id,
    displayName: user.displayName ?? null,
    mobileMasked: maskMobile(user.mobile),
    l,
    r,
    f,
    m,
    lScore,
    rScore,
    fScore,
    mScore,
    segment,
    isNew,
  };
}

// ---------------------------------------------------------------------------
// Report 4 — customer / LRFM analysis
// ---------------------------------------------------------------------------

const NOT_COMPUTED_NOTE_FA =
  "مدل به‌کاررفته «LRFM» است، نه NLRFM استاندارد؛ بُعد «N» در این سیستم تعریف نشده و ساخته نشده است. " +
  "مقدار «M» امروز ناخالص است چون بازگشت وجهی ثبت نشده (در صورت ثبت، از M کسر می‌شود). " +
  "برچسب «در معرض ریزش» یک هیوریستیک بر پایهٔ R > ۹۰ روز است، نه پیش‌بینی مدل. " +
  "LTV فقط «محقق‌شده» است و پیش‌بینی نمی‌شود. تحلیل بر پایهٔ کل عمر کاربر است و به بازهٔ انتخابی محدود نیست؛ " +
  "حساب‌های کارکنان پلتفرم از این تحلیل کنار گذاشته شده‌اند.";

/**
 * Every customer's LRFM row, unpaginated — the shared base for the report and
 * the export. Lifetime-scoped (not limited to the selected window).
 */
export function listLrfmRows(input: ResolveRangeInput): LrfmRow[] {
  const nowMs = (input.now ?? new Date()).getTime();
  const facts = collectFacts(completedRefunds());
  return readUsers()
    .filter((u) => isCustomerRole(u.role))
    .map((u) => buildLrfmRow(u, facts.get(u.id), nowMs));
}

/** Build the customer (LRFM) analytics report over the lifetime base. */
export function buildCustomerAnalytics(input: ResolveRangeInput): CustomerAnalyticsReport {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());

  const refundsByOrder = completedRefunds();
  const facts = collectFacts(refundsByOrder);
  const rows = listLrfmRows(input);
  const buyers = rows.filter((r) => r.f > 0);

  const cohortSize = rows.length;
  const buyerCount = buyers.length;

  // Segments — net per segment, share of the whole cohort.
  const bySegment = new Map<LrfmSegment, { count: number; net: number }>();
  for (const r of rows) {
    const cell = bySegment.get(r.segment) ?? { count: 0, net: 0 };
    cell.count += 1;
    cell.net += r.m;
    bySegment.set(r.segment, cell);
  }
  const segments: LrfmSegmentRow[] = SEGMENT_ORDER.filter(
    (s) => (bySegment.get(s)?.count ?? 0) > 0
  ).map((segment) => {
    const cell = bySegment.get(segment)!;
    return {
      segment,
      labelFa: SEGMENT_FA[segment],
      count: cell.count,
      sharePct: cohortSize === 0 ? 0 : round1((cell.count / cohortSize) * 100),
      net: cell.net,
    };
  });

  // Repurchase interval — buyers with ≥2 purchases only.
  const gaps: number[] = [];
  for (const r of buyers) {
    const purchases = facts.get(r.userId)?.purchases ?? [];
    for (let i = 1; i < purchases.length; i += 1) {
      gaps.push(gapDays(purchases[i - 1]!.purchased_at, purchases[i]!.purchased_at));
    }
  }
  const repurchaseAvgDays =
    gaps.length === 0 ? null : round1(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  const repurchaseMedianDays = gaps.length === 0 ? null : round1(median(gaps));
  const singlePurchaseBuyers = buyers.filter((r) => r.f === 1).length;

  const newCount = buyers.filter((r) => r.isNew).length;
  const returningCount = buyerCount - newCount;

  const atRiskHeuristicCount = buyers.filter((r) => r.r != null && r.r > 90).length;

  const totalNet = buyers.reduce((sum, r) => sum + r.m, 0);
  const realizedLtv = buyerCount === 0 ? 0 : Math.round(totalNet / buyerCount);

  const top = [...buyers].sort((a, b) => b.m - a.m).slice(0, 10);

  return {
    window,
    cohortSize,
    buyerCount,
    segments,
    repurchaseAvgDays,
    repurchaseMedianDays,
    singlePurchaseBuyers,
    newVsReturning: { newCount, returningCount },
    atRiskHeuristicCount,
    realizedLtv,
    notComputedNoteFa: NOT_COMPUTED_NOTE_FA,
    top,
    quality: analyticsDataQuality(),
  };
}

// ---------------------------------------------------------------------------
// Report 3 — purchase ranking (window-scoped)
// ---------------------------------------------------------------------------

export interface PurchaseRankingQuery {
  search?: string;
  sort?: PurchaseRankingSort;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated purchase ranking for the selected window. Purchase metrics
 * (count/gross/refunded/net/first/last) are scoped to `fromIso…toIso`;
 * `lastActiveAt` is a separate lifetime snapshot (last session/activity).
 */
export function listPurchaseRanking(
  input: ResolveRangeInput,
  query: PurchaseRankingQuery = {}
): PurchaseRankingPage {
  const resolved = resolveRange(input);
  const { fromIso, toIso } = resolved;

  const refundsByOrder = completedRefunds();
  const customers = readUsers().filter((u) => isCustomerRole(u.role));
  const idx = userIndex(customers);

  // Lifetime last-seen per user (a snapshot, independent of the window).
  const lastActive = new Map<string, string>();
  const bumpActive = (userId: string, iso: string | undefined | null): void => {
    if (!iso) return;
    const prev = lastActive.get(userId);
    if (!prev || iso > prev) lastActive.set(userId, iso);
  };
  for (const s of readSessions()) bumpActive(s.userId, s.lastActiveAt ?? s.createdAt);
  for (const a of readActivities()) bumpActive(a.user_id, a.created_at);

  // Window-scoped purchases, aggregated per customer.
  const agg = new Map<
    string,
    { count: number; gross: number; refunded: number; first: string; last: string }
  >();
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    if (!idx.has(s.user_id)) continue; // staff excluded, same as the LRFM cohort
    const cur =
      agg.get(s.user_id) ??
      { count: 0, gross: 0, refunded: 0, first: s.purchased_at, last: s.purchased_at };
    cur.count += 1;
    cur.gross += s.amount || 0;
    cur.refunded += refundsByOrder.get(s.id) ?? 0;
    if (s.purchased_at < cur.first) cur.first = s.purchased_at;
    if (s.purchased_at > cur.last) cur.last = s.purchased_at;
    agg.set(s.user_id, cur);
  }

  let items: PurchaseRankingRow[] = [...agg.entries()].map(([userId, v]) => {
    const u = idx.get(userId);
    return {
      userId,
      displayName: u?.displayName ?? null,
      mobileMasked: u ? maskMobile(u.mobile) : "••••",
      orderCount: v.count,
      gross: v.gross,
      refunded: v.refunded,
      net: v.gross - v.refunded,
      firstPurchaseAt: v.first,
      lastPurchaseAt: v.last,
      lastActiveAt: lastActive.get(userId) ?? null,
    };
  });

  if (query.search) {
    const q = query.search.trim().toLowerCase();
    items = items.filter(
      (r) =>
        (r.displayName ?? "").toLowerCase().includes(q) ||
        r.mobileMasked.includes(q) ||
        r.userId.toLowerCase().includes(q)
    );
  }

  const sort: PurchaseRankingSort = query.sort ?? "net";
  items.sort((a, b) => {
    if (sort === "count") return b.orderCount - a.orderCount || b.net - a.net;
    if (sort === "recency") {
      return (b.lastPurchaseAt ?? "").localeCompare(a.lastPurchaseAt ?? "") || b.net - a.net;
    }
    return b.net - a.net || b.orderCount - a.orderCount;
  });

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}
