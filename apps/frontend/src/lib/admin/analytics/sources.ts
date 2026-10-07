// ============================================================
// LEGALIR — Analytics: typed readers over the real tables
// ============================================================
// One place that names the exact table + fields every report reads, so the
// data dictionary (docs/ANALYTICS_DATA_DICTIONARY.md) and the running code
// can never drift. Reads are delegated to `readTable` (the cached JSON
// store), which is memoized per file mtime — a report that touches a table
// twice in one request pays for the parse once.
//
// These are TYPES ONLY over `readTable`. No column here is invented: each
// matches a field observed in `apps/frontend/.data/<table>.json`.
// ============================================================

import { readTable, findUserById, normalizeStoredMobile } from "@/lib/db";
import type { PlanEntitlementSnapshot } from "@legalir/types";

// ---------------------------------------------------------------------------
// Row shapes (server-side mirrors of the stored JSON)
// ---------------------------------------------------------------------------

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status: string;
  status_fa: string;
  start_at: string;
  end_at: string;
  purchased_at: string;
  auto_renew: number;
  /** Frozen entitlements at purchase (the energy ledger's grant source). */
  plan_snapshot?: PlanEntitlementSnapshot | undefined;
}

export interface PaymentRow {
  id: string;
  userId: string;
  planCode: string;
  amount: number;
  currency: string;
  /** paid | pending | failed (mock gateway → "paid"). */
  status: string;
  /** "mock" today; a real gateway would replace this. */
  method: string;
  subscriptionId: string;
  idempotencyKey: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserRow {
  id: string;
  mobile: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  platformAccountType?: string;
  orgId?: string | null;
  createdAt: string;
}

export interface RewardLedgerRow {
  id: string;
  user_id: string;
  event_type: string;
  points_delta: number;
  source_type: string;
  source_id: string;
  description: string;
  created_at: string;
}

export interface UsageTransactionRow {
  id: string;
  userId: string;
  subscriptionId: string;
  activityType: string;
  pointsCost: number;
  requestCost: number;
  tokenCost: number;
  status: string;
  source: string;
  createdAt: string;
}

export interface SessionRow {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt?: string;
}

export interface ActivityRow {
  id: string;
  user_id: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  code: string;
  nameFa: string;
  descriptionFa: string;
  durationDays: number;
  salePrice: number;
  listPrice: number;
  currency: string;
  isActive: boolean;
}

export interface FinancialAdjustmentRow {
  id: string;
  orderId: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export const readSubscriptions = (): SubscriptionRow[] => readTable<SubscriptionRow>("subscriptions");
export const readPayments = (): PaymentRow[] => readTable<PaymentRow>("payments");
export const readUsers = (): UserRow[] => readTable<UserRow>("users");
export const readRewardLedger = (): RewardLedgerRow[] => readTable<RewardLedgerRow>("reward_ledger");
export const readUsageTransactions = (): UsageTransactionRow[] =>
  readTable<UsageTransactionRow>("usage_transactions");
export const readSessions = (): SessionRow[] => readTable<SessionRow>("sessions");
export const readActivities = (): ActivityRow[] => readTable<ActivityRow>("activities");
export const readPlans = (): PlanRow[] => readTable<PlanRow>("subscription_plans");
export const readAdjustments = (): FinancialAdjustmentRow[] =>
  readTable<FinancialAdjustmentRow>("financial_adjustments");

// ---------------------------------------------------------------------------
// Identity helpers (shared by every report so display is consistent)
// ---------------------------------------------------------------------------

/** Mask a stored mobile: keep first 4 + last 4. Identical to the orders panel. */
export function maskMobile(mobile: string): string {
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

/** A user's display name, falling back to their masked mobile. */
export function displayName(userId: string): string | null {
  return findUserById(userId)?.displayName ?? null;
}

export function userLabel(userId: string): string {
  const u = findUserById(userId);
  if (!u) return "کاربر ناشناس";
  return u.displayName ?? maskMobile(u.mobile);
}

/**
 * Index every user by id once. Reports that resolve many users (rankings,
 * cohort tables) build this once and pass it down rather than calling
 * `findUserById` (a linear scan) per row.
 */
export function userIndex(users: UserRow[]): Map<string, UserRow> {
  const m = new Map<string, UserRow>();
  for (const u of users) m.set(u.id, u);
  return m;
}

/**
 * The earliest timestamp the analytics layer can see across the fact tables.
 * This is what decides whether a previous-period comparison is honest: if the
 * system holds nothing before the previous window's start, a trend cannot be
 * computed and the UI must say so instead of inventing one.
 */
export function earliestDataIso(): string | null {
  const candidates: string[] = [
    ...readSubscriptions().map((s) => s.purchased_at),
    ...readPayments().map((p) => p.paidAt ?? p.createdAt),
    ...readRewardLedger().map((r) => r.created_at),
    ...readUsageTransactions().map((u) => u.createdAt),
    ...readUsers().map((u) => u.createdAt),
  ].filter((x) => typeof x === "string" && x.length > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((min, cur) => (cur < min ? cur : min));
}

/** Completed refunds in a window, keyed by the order they reference. */
export function refundsByOrderId(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of readAdjustments()) {
    if (a.status !== "completed") continue;
    m.set(a.orderId, (m.get(a.orderId) ?? 0) + a.amount);
  }
  return m;
}
