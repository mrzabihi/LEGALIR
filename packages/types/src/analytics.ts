// ============================================================
// LEGALIR — Analytics / Business-Intelligence Domain Types
// ============================================================
// Additive, read-only types for the /admin/analytics surface. Every field
// here maps to a value the backend can derive from a REAL table (see
// docs/ANALYTICS_DATA_DICTIONARY.md). When a figure cannot be computed, the
// API omits it or marks the surrounding block `unavailable` — it is never
// fabricated. Amounts are integers in Toman (IRT).
// ============================================================

// ---------------------------------------------------------------------------
// Data-quality contract
// ---------------------------------------------------------------------------
// The single honest channel for "can this be measured today". The UI renders
// these as a banner/panel so an operator always sees which numbers are real
// and which need new capture.

export type AnalyticsQualityStatus = "real" | "partial" | "unavailable" | "blocked";

export interface AnalyticsDataQualityFlag {
  /** Stable id (G1…G12 from the audit's gap register). */
  id: string;
  labelFa: string;
  status: AnalyticsQualityStatus;
  /** Why the status is what it is — factual, no hedging. */
  reasonFa: string;
  /** What must be captured/connected to raise the status to `real`. */
  captureNeededFa: string;
}

// ---------------------------------------------------------------------------
// Window (reporting range) resolution
// ---------------------------------------------------------------------------

/** How the operator chose the window. */
export type AnalyticsRangeKey = "today" | "7d" | "30d" | "jalali_month" | "custom";

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/**
 * The resolved window and its equal-length predecessor. `prevFromIso`/`prevToIso`
 * is the span immediately before `fromIso` — the ONLY basis for a comparison.
 */
export interface AnalyticsWindowInfo {
  rangeDays: number;
  fromIso: string;
  toIso: string;
  prevFromIso: string;
  prevToIso: string;
  preset: AnalyticsRangeKey;
  /** Tehran Jalali parts of the window bounds, for display next to the filter. */
  fromJalali: JalaliParts;
  toJalali: JalaliParts;
  /**
   * True only when the previous window can produce an honest comparison:
   * the system holds data reaching back to `prevFromIso`. When false the UI
   * must show «دادهٔ کافی برای مقایسه وجود ندارد» rather than a made-up trend.
   */
  comparable: boolean;
}

/** A comparison cell: current vs the equal-length previous window. */
export interface AnalyticsComparison {
  current: number;
  previous: number | null;
  /** One-decimal percent change, or null when not honestly comparable. */
  changePct: number | null;
}

// ---------------------------------------------------------------------------
// Report 1 — Subscription sales by plan
// ---------------------------------------------------------------------------

export interface PlanSalesRow {
  planCode: string;
  planNameFa: string;
  /** Number of purchases in the window. */
  count: number;
  gross: number;
  refunded: number;
  net: number;
  /** Share of net revenue (0–100, one decimal). Zero when net total is 0. */
  revenueSharePct: number;
}

/** One day's per-plan breakdown for the grouped comparison chart. */
export interface PlanDailyBucket {
  date: string;
  plans: { planCode: string; count: number; gross: number; net: number }[];
}

export interface SubscriptionSalesReport {
  window: AnalyticsWindowInfo;
  totals: {
    count: AnalyticsComparison;
    gross: AnalyticsComparison;
    net: AnalyticsComparison;
  };
  byPlan: PlanSalesRow[];
  /** One bucket per day in the window, oldest first. */
  daily: PlanDailyBucket[];
  /** The real plan catalog (for a stable chart legend even with zero sales). */
  planCatalog: { planCode: string; planNameFa: string; salePrice: number }[];
  quality: AnalyticsDataQualityFlag[];
}

// ---------------------------------------------------------------------------
// Report 2 — User energy report
// ---------------------------------------------------------------------------
// "Energy" = platform points (see docs/ANALYTICS_DATA_DICTIONARY.md). Two
// assets exist: SUBSCRIPTION grants (from a subscription's daily allowance)
// and REWARD grants (reward_ledger). Consumption is usage_transactions.

export interface EnergyTotals {
  /** Sum of live balances right now (all users) — a snapshot. */
  currentBalance: number;
  subscriptionBalance: number;
  rewardBalance: number;
  /** In-range movements (window-scoped). */
  granted: number;
  consumed: number;
  remaining: number;
  /** Expired grants cannot be derived from current tables → unavailable. */
  expired: number | null;
}

export interface EnergyUserRow {
  userId: string;
  displayName: string | null;
  mobileMasked: string;
  /** Live balance right now. */
  balance: number;
  granted: number;
  consumed: number;
  /** ISO timestamp of the last ledger/usage movement, or null. */
  lastChangeAt: string | null;
}

export interface EnergySourceRow {
  sourceType: string;
  labelFa: string;
  granted: number;
}

export interface EnergyActivityRow {
  activityType: string;
  labelFa: string;
  consumed: number;
  count: number;
}

export interface EnergyReport {
  window: AnalyticsWindowInfo;
  totals: EnergyTotals;
  granted: AnalyticsComparison;
  consumed: AnalyticsComparison;
  bySource: EnergySourceRow[];
  byActivity: EnergyActivityRow[];
  distribution: { labelFa: string; count: number }[];
  /** Top holders by live balance (bounded). */
  topHolders: EnergyUserRow[];
  quality: AnalyticsDataQualityFlag[];
  /** How the number is computed + when it was refreshed (operator transparency). */
  sourceNoteFa: string;
  refreshedAt: string;
}

/** Paginated per-user energy table (drill-down). */
export interface EnergyUsersPage {
  items: EnergyUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Report 3 — User purchase ranking
// ---------------------------------------------------------------------------

export interface PurchaseRankingRow {
  userId: string;
  displayName: string | null;
  mobileMasked: string;
  orderCount: number;
  gross: number;
  refunded: number;
  net: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  /** Last real session activity (login/visit), or null when never seen. */
  lastActiveAt: string | null;
}

export type PurchaseRankingSort = "net" | "count" | "recency";

export interface PurchaseRankingPage {
  items: PurchaseRankingRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Report 4 — LRFM customer analysis
// ---------------------------------------------------------------------------
// An honest LRFM (L=length/tenure, R=recency, F=frequency, M=monetary) model.
// No "N" (Network/negative) score is invented — see docs/NLRFM_DEFINITION.md.

export type LrfmSegment =
  | "champions"
  | "loyal"
  | "potential_loyalist"
  | "promising"
  | "needs_attention"
  | "at_risk"
  | "hibernating"
  | "lost"
  | "new"
  | "unclassified"
  | "no_purchase";

export interface LrfmRow {
  userId: string;
  displayName: string | null;
  mobileMasked: string;
  /** Raw metrics. `null` when the user has no purchase to base them on. */
  l: number | null;
  r: number | null;
  f: number;
  m: number;
  /** 1–5 scores; `null` for an unscored dimension (e.g. M when m = 0). */
  lScore: number | null;
  rScore: number | null;
  fScore: number | null;
  mScore: number | null;
  segment: LrfmSegment;
  /** True when this is the user's first-ever purchase (new vs returning). */
  isNew: boolean;
}

export interface LrfmSegmentRow {
  segment: LrfmSegment;
  labelFa: string;
  count: number;
  /** Share of the analysed cohort (0–100, one decimal). */
  sharePct: number;
  net: number;
}

export interface CustomerAnalyticsReport {
  window: AnalyticsWindowInfo;
  cohortSize: number;
  /** Buyers only — the base for LRFM scoring. */
  buyerCount: number;
  segments: LrfmSegmentRow[];
  /** Avg purchase interval in days (users with ≥2 purchases only; else null). */
  repurchaseAvgDays: number | null;
  /** Median purchase interval in days (same base). */
  repurchaseMedianDays: number | null;
  /** Users excluded from the interval because they bought exactly once. */
  singlePurchaseBuyers: number;
  newVsReturning: { newCount: number; returningCount: number };
  /** Buyers whose recency R > 90 days — a rule-based flag, never a prediction. */
  atRiskHeuristicCount: number;
  /** Realized LTV: net revenue / paying users (0 when no payers). */
  realizedLtv: number;
  /** Explicitly declared, honest statement of what is NOT computed. */
  notComputedNoteFa: string;
  top: LrfmRow[];
  quality: AnalyticsDataQualityFlag[];
}

// ---------------------------------------------------------------------------
// Finance reconciliation
// ---------------------------------------------------------------------------

export interface FinanceAnalytics {
  window: AnalyticsWindowInfo;
  gross: number;
  refunds: number;
  net: number;
  /** Net revenue from the derived orders model (`/admin/orders`), for reconciliation. */
  ordersNet: number;
  /**
   * The reconciliation proof: the subscriptions-derived net (`gross − refunds`)
   * must equal the orders-model net (`ordersNet`). `matches` is what proves the
   * dashboard and the orders panel report the same money.
   */
  reconcile: {
    subscriptionGross: number;
    net: number;
    matches: boolean;
  };
  refundPendingCount: number;
  refundPendingAmount: number;
  /** Revenue concentration among window buyers (share of positive net). */
  concentration: {
    /** Number of window buyers the shares are taken over. */
    buyers: number;
    top1Pct: number;
    top5Pct: number;
    top10Pct: number;
    top20Pct: number;
  };
  /**
   * Payment health, scoped to the window. `coveragePct` is the share of window
   * subscriptions that have a matching payment row; `null` when there are no
   * window subscriptions. `mock` counts simulated-gateway rows (never "real").
   */
  payments: {
    windowCount: number;
    paid: number;
    pending: number;
    failed: number;
    mock: number;
    coveragePct: number | null;
  };
  quality: AnalyticsDataQualityFlag[];
}

// ---------------------------------------------------------------------------
// Executive overview
// ---------------------------------------------------------------------------

export interface AnalyticsKpiCard {
  key: string;
  labelFa: string;
  value: number;
  formulaFa: string;
  unitFa?: string;
  previousValue?: number | null;
  changePct?: number | null;
  trend?: "neutral" | "inverse";
  drillHref?: string;
  unavailable?: boolean;
  unavailableReasonFa?: string;
}

export interface AnalyticsOverview {
  window: AnalyticsWindowInfo;
  generatedAt: string;
  timezone: string;
  currency: string;
  kpis: AnalyticsKpiCard[];
  quality: AnalyticsDataQualityFlag[];
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Every analytics endpoint returns `{ data, quality }`. `quality` travels with
 * the payload so a client never renders a number without its caveat.
 */
export interface AnalyticsEnvelope<T> {
  data: T;
  quality: AnalyticsDataQualityFlag[];
}
