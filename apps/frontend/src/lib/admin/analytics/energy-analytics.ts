// ============================================================
// LEGALIR — Analytics: Report 2 — user energy report
// ============================================================
// "Energy" = platform points. Exactly as the live ledger models it, there are
// two assets and one consumption stream:
//
//   • SUBSCRIPTION credit — granted per activation (dailyPointsFor), resets
//     daily, never transfers. Its LIVE remainder is read from the stored daily
//     counter `subscription_daily_usage` for TODAY only.
//   • REWARD points — persistent; balance = SUM(reward_ledger.points_delta).
//   • Consumption — `usage_transactions` (skip FAILED; REVERSED = refund).
//
// Expired energy is NOT derivable from current tables (there is no expires_at);
// it is reported as `unavailable`, never zero.
// ============================================================

import type {
  EnergyReport,
  EnergyUserRow,
  EnergySourceRow,
  EnergyActivityRow,
  EnergyUsersPage,
  AnalyticsComparison,
} from "@legalir/types";
import { readTable } from "@/lib/db";
import { dailyPointsFor, getPlanByCode } from "@/lib/usage/plans";
import { ACTIVITY_REGISTRY } from "@/lib/usage/activities";
import {
  readSubscriptions,
  readRewardLedger,
  readUsageTransactions,
  readUsers,
  userIndex,
  maskMobile,
  earliestDataIso,
  type SubscriptionRow,
} from "./sources";
import {
  resolveRange,
  toWindowInfo,
  withinWindow,
  tehranDayKey,
  changePct,
  type ResolveRangeInput,
} from "./range";
import { analyticsDataQuality } from "./quality";

/** Stored daily subscription counter row. */
interface DailyUsageRow {
  userId: string;
  subscriptionId: string;
  usageDate: string;
  pointsTotal: number;
  pointsUsed: number;
}

/** Persian label for an activity code. */
const ACTIVITY_FA: Record<string, string> = Object.fromEntries(
  ACTIVITY_REGISTRY.map((a) => [a.code, a.displayNameFa])
);

/** The daily subscription credit a subscription grants (via its snapshot/plan). */
function grantFor(s: SubscriptionRow): number {
  const plan = s.plan_snapshot ?? getPlanByCode(s.plan_code);
  if (!plan) return 0;
  return dailyPointsFor(plan);
}

/** Sum a user's reward-point balance across the whole ledger. */
function rewardBalances(): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of readRewardLedger()) {
    m.set(r.user_id, (m.get(r.user_id) ?? 0) + r.points_delta);
  }
  return m;
}

/** Live subscription credit remaining TODAY, per user (daily counters only). */
function subscriptionRemainingToday(todayKey: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of readTable<DailyUsageRow>("subscription_daily_usage")) {
    if (row.usageDate !== todayKey) continue; // a stale day contributes 0 (reset)
    const remaining = Math.max(0, (row.pointsTotal || 0) - (row.pointsUsed || 0));
    m.set(row.userId, (m.get(row.userId) ?? 0) + remaining);
  }
  return m;
}

/** In-range energy granted, split by asset and keyed by user. */
function grantedInRange(fromIso: string, toIso: string): {
  byUser: Map<string, number>;
  bySource: { subscription: number; reward: number };
} {
  const byUser = new Map<string, number>();
  let subscription = 0;
  let reward = 0;

  for (const s of readSubscriptions()) {
    if (!withinWindow(s.start_at, fromIso, toIso)) continue;
    const amount = grantFor(s);
    subscription += amount;
    byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + amount);
  }
  for (const r of readRewardLedger()) {
    if (!withinWindow(r.created_at, fromIso, toIso)) continue;
    if (r.event_type === "REQUEST_CONSUMED") continue; // mirror of a spend, not a grant
    if (r.points_delta <= 0) continue;
    reward += r.points_delta;
    byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + r.points_delta);
  }
  return { byUser, bySource: { subscription, reward } };
}

/** In-range consumption, keyed by user and by activity (net of refunds). */
function consumedInRange(fromIso: string, toIso: string): {
  byUser: Map<string, number>;
  byActivity: Map<string, { points: number; count: number }>;
  total: number;
} {
  const byUser = new Map<string, number>();
  const byActivity = new Map<string, { points: number; count: number }>();
  let total = 0;
  for (const t of readUsageTransactions()) {
    if (t.status === "FAILED") continue;
    if (!withinWindow(t.createdAt, fromIso, toIso)) continue;
    const delta = t.status === "REVERSED" ? -t.pointsCost : t.pointsCost;
    total += delta;
    byUser.set(t.userId, (byUser.get(t.userId) ?? 0) + delta);
    const cell = byActivity.get(t.activityType) ?? { points: 0, count: 0 };
    cell.points += delta;
    cell.count += 1;
    byActivity.set(t.activityType, cell);
  }
  return { byUser, byActivity, total };
}

/** The most recent ledger/usage timestamp per user (all-time, best effort). */
function lastChangeByUser(): Map<string, string> {
  const m = new Map<string, string>();
  const bump = (userId: string, iso: string) => {
    const prev = m.get(userId);
    if (!prev || iso > prev) m.set(userId, iso);
  };
  for (const r of readRewardLedger()) bump(r.user_id, r.created_at);
  for (const t of readUsageTransactions()) bump(t.userId, t.createdAt);
  return m;
}

const SOURCE_FA: Record<string, string> = {
  subscription: "اعتبار اشتراک",
  reward: "پاداش",
};

/** Build the energy report for a resolved range. */
export function buildEnergyReport(input: ResolveRangeInput): EnergyReport {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());
  const { fromIso, toIso, prevFromIso, prevToIso } = resolved;

  const todayKey = tehranDayKey(new Date().toISOString());
  const reward = rewardBalances();
  const subRemaining = subscriptionRemainingToday(todayKey);

  const curGranted = grantedInRange(fromIso, toIso);
  const prevGranted = grantedInRange(prevFromIso, prevToIso);
  const curConsumed = consumedInRange(fromIso, toIso);
  const prevConsumed = consumedInRange(prevFromIso, prevToIso);

  const idx = userIndex(readUsers());

  let rewardTotal = 0;
  let subTotal = 0;
  for (const v of reward.values()) rewardTotal += v;
  for (const v of subRemaining.values()) subTotal += v;

  const lastChange = lastChangeByUser();
  const allUserIds = new Set<string>([...reward.keys(), ...subRemaining.keys()]);

  const rowsFor = (userId: string): EnergyUserRow => {
    const u = idx.get(userId);
    return {
      userId,
      displayName: u?.displayName ?? null,
      mobileMasked: u ? maskMobile(u.mobile) : "••••",
      balance: (reward.get(userId) ?? 0) + (subRemaining.get(userId) ?? 0),
      granted: curGranted.byUser.get(userId) ?? 0,
      consumed: curConsumed.byUser.get(userId) ?? 0,
      lastChangeAt: lastChange.get(userId) ?? null,
    };
  };

  const all = [...allUserIds].map(rowsFor).sort((a, b) => b.balance - a.balance);

  const curGrantedTotal = curGranted.bySource.subscription + curGranted.bySource.reward;
  const prevGrantedTotal = prevGranted.bySource.subscription + prevGranted.bySource.reward;
  const grantedCmp: AnalyticsComparison = {
    current: curGrantedTotal,
    previous: window.comparable ? prevGrantedTotal : null,
    changePct: window.comparable ? changePct(curGrantedTotal, prevGrantedTotal) : null,
  };
  const consumedCmp: AnalyticsComparison = {
    current: curConsumed.total,
    previous: window.comparable ? prevConsumed.total : null,
    changePct: window.comparable ? changePct(curConsumed.total, prevConsumed.total) : null,
  };

  const bySource: EnergySourceRow[] = [
    { sourceType: "subscription", labelFa: SOURCE_FA["subscription"]!, granted: curGranted.bySource.subscription },
    { sourceType: "reward", labelFa: SOURCE_FA["reward"]!, granted: curGranted.bySource.reward },
  ].filter((r) => r.granted > 0);

  const byActivity: EnergyActivityRow[] = [...curConsumed.byActivity.entries()]
    .map(([activityType, v]) => ({
      activityType,
      labelFa: ACTIVITY_FA[activityType] ?? activityType,
      consumed: v.points,
      count: v.count,
    }))
    .sort((a, b) => b.consumed - a.consumed);

  const distribution = [
    { labelFa: "بدون موجودی (۰)", min: 0, max: 0 },
    { labelFa: "۱ تا ۱۰٬۰۰۰", min: 1, max: 10_000 },
    { labelFa: "۱۰٬۰۰۱ تا ۱۰۰٬۰۰۰", min: 10_001, max: 100_000 },
    { labelFa: "بیش از ۱۰۰٬۰۰۰", min: 100_001, max: Number.POSITIVE_INFINITY },
  ].map((b) => ({
    labelFa: b.labelFa,
    count: all.filter((r) => r.balance >= b.min && r.balance <= b.max).length,
  }));

  return {
    window,
    totals: {
      currentBalance: rewardTotal + subTotal,
      subscriptionBalance: subTotal,
      rewardBalance: rewardTotal,
      granted: grantedCmp.current,
      consumed: consumedCmp.current,
      remaining: grantedCmp.current - consumedCmp.current,
      expired: null,
    },
    granted: grantedCmp,
    consumed: consumedCmp,
    bySource,
    byActivity,
    distribution,
    topHolders: all.slice(0, 10),
    quality: analyticsDataQuality(),
    sourceNoteFa:
      "موجودی هر کاربر = مجموع دفتر پاداش + ماندهٔ اعتبار روزانهٔ اشتراک امروز (اشتراک روزانه ریست می‌شود). " +
      "مصرف از تراکنش‌های استفاده خوانده می‌شود (ناموفق‌ها بی‌اثر، برگشتی‌ها کسر می‌شوند).",
    refreshedAt: new Date().toISOString(),
  };
}

export interface EnergyUsersQuery {
  search?: string;
  sort?: "balance" | "consumed" | "recent";
  page?: number;
  pageSize?: number;
}

/**
 * Every user with a live balance or in-range movement, unpaginated — the
 * shared base for the paginated table and the export.
 */
export function allEnergyUsers(input: ResolveRangeInput): EnergyUserRow[] {
  const resolved = resolveRange(input);
  const { fromIso, toIso } = resolved;
  const todayKey = tehranDayKey(new Date().toISOString());
  const reward = rewardBalances();
  const subRemaining = subscriptionRemainingToday(todayKey);
  const granted = grantedInRange(fromIso, toIso);
  const consumed = consumedInRange(fromIso, toIso);
  const lastChange = lastChangeByUser();
  const idx = userIndex(readUsers());

  const ids = new Set<string>([
    ...reward.keys(),
    ...subRemaining.keys(),
    ...granted.byUser.keys(),
    ...consumed.byUser.keys(),
  ]);

  return [...ids].map((userId) => {
    const u = idx.get(userId);
    return {
      userId,
      displayName: u?.displayName ?? null,
      mobileMasked: u ? maskMobile(u.mobile) : "••••",
      balance: (reward.get(userId) ?? 0) + (subRemaining.get(userId) ?? 0),
      granted: granted.byUser.get(userId) ?? 0,
      consumed: consumed.byUser.get(userId) ?? 0,
      lastChangeAt: lastChange.get(userId) ?? null,
    };
  });
}

/**
 * Paginated per-user energy table for the drill-down. Built from the same
 * aggregates as the report, so a row can never disagree with a headline.
 */
export function listEnergyUsers(input: ResolveRangeInput, query: EnergyUsersQuery = {}): EnergyUsersPage {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  let items: EnergyUserRow[] = allEnergyUsers(input);

  if (query.search) {
    const q = query.search.trim().toLowerCase();
    items = items.filter(
      (r) =>
        (r.displayName ?? "").toLowerCase().includes(q) ||
        r.mobileMasked.includes(q) ||
        r.userId.toLowerCase().includes(q)
    );
  }

  const sort = query.sort ?? "balance";
  items.sort((a, b) => {
    if (sort === "consumed") return b.consumed - a.consumed;
    if (sort === "recent") return (b.lastChangeAt ?? "").localeCompare(a.lastChangeAt ?? "");
    return b.balance - a.balance;
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}
