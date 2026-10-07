// ============================================================
// LEGALIR — Unified Energy Ledger (server-only, read-time projection)
// ============================================================
// ONE projection over the three real sources — there is no second store:
//
//   • subscriptions       → SUBSCRIPTION_GRANT (one per activation)
//   • reward_ledger       → reward movements (daily / referral / campaign / purchase)
//   • usage_transactions  → USAGE / REFUND (the single consumption record)
//
// The two assets are kept strictly separate by `source`:
//   SUBSCRIPTION credit is bounded by the subscription (it resets daily and
//   never transfers on a plan change); REWARD points are independent and
//   persistent. `balanceBefore`/`balanceAfter` are computed per asset by
//   walking each source's stream in time order.
//
// Consumption is projected from `usage_transactions` ONLY. The engine mirrors a
// reward-wallet spend into `reward_ledger` (a REQUEST_CONSUMED row); those rows
// are SKIPPED here so a single request can never appear twice.
// ============================================================

import { readTable, getRewardBalance } from "@/lib/db";
import { getUsageSummary } from "@/lib/usage/engine";
import { dailyPointsFor, getPlanByCode } from "@/lib/usage/plans";
import type {
  EnergyLedgerEntry,
  EnergyLedgerResponse,
  EnergyLedgerSummary,
  EnergySource,
  EnergyTransactionType,
  PlanEntitlementSnapshot,
  UsageTransaction,
} from "@legalir/types";
import type { RewardEventType } from "@/lib/rewards";

const SUBSCRIPTIONS_TABLE = "subscriptions";
const REWARD_TABLE = "reward_ledger";
const TX_TABLE = "usage_transactions";

/** The persisted subscription row (legacy-compatible). */
interface StoredSubscriptionRow {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name_fa: string;
  status: string;
  start_at: string;
  end_at: string;
  purchased_at: string;
  plan_snapshot?: PlanEntitlementSnapshot;
}

interface RewardLedgerRow {
  id: string;
  user_id: string;
  event_type: RewardEventType;
  points_delta: number;
  source_type: string;
  source_id: string;
  idempotency_key: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Map a reward event onto a ledger transaction type (spend rows excluded). */
const REWARD_EVENT_TYPE: Partial<Record<RewardEventType, EnergyTransactionType>> = {
  DAILY_VISIT: "DAILY_REWARD",
  REFERRAL_COMPLETED: "REFERRAL_REWARD",
  PROFILE_COMPLETED: "CAMPAIGN_REWARD",
  SUBSCRIPTION_SILVER_PURCHASED: "PURCHASE",
  SUBSCRIPTION_GOLD_PURCHASED: "PURCHASE",
  SUBSCRIPTION_DIAMOND_PURCHASED: "PURCHASE",
};

/** The daily subscription credit a snapshot grants (requests × activity cost). */
function grantFor(snapshot: PlanEntitlementSnapshot | undefined): number {
  if (!snapshot) return 0;
  return dailyPointsFor(snapshot);
}

/** A ledger entry before its running balances are known. */
type Draft = Omit<EnergyLedgerEntry, "balanceBefore" | "balanceAfter">;

function subscriptionGrants(userId: string): Draft[] {
  const rows = readTable<StoredSubscriptionRow>(SUBSCRIPTIONS_TABLE).filter(
    (s) => s.user_id === userId && Boolean(s.start_at)
  );
  return rows.map((row) => {
    const snapshot =
      row.plan_snapshot ?? getPlanByCode(row.plan_code) ??
      (row.plan_snapshot as PlanEntitlementSnapshot | undefined);
    return {
      id: `grant-${row.id}`,
      userId,
      type: "SUBSCRIPTION_GRANT" as const,
      source: "SUBSCRIPTION" as const,
      amount: grantFor(snapshot as PlanEntitlementSnapshot | undefined),
      referenceId: row.id,
      referenceType: "subscription",
      subscriptionId: row.id,
      description: `اعتبار روزانه اشتراک ${row.plan_name_fa}`,
      createdAt: row.start_at,
      metadata: { planCode: row.plan_code, planNameFa: row.plan_name_fa },
    };
  });
}

function rewardMovements(userId: string): Draft[] {
  return readTable<RewardLedgerRow>(REWARD_TABLE)
    .filter((e) => e.user_id === userId && e.event_type !== "REQUEST_CONSUMED")
    .map((e) => ({
      id: e.id,
      userId,
      type: REWARD_EVENT_TYPE[e.event_type] ?? ("ADJUSTMENT" as const),
      source: "REWARD" as const,
      amount: e.points_delta,
      referenceId: e.source_id,
      referenceType: e.source_type,
      subscriptionId: null,
      description: e.description,
      createdAt: e.created_at,
      metadata: e.metadata ?? {},
    }));
}

function consumptionMovements(userId: string): Draft[] {
  const drafts: Draft[] = [];
  for (const t of readTable<UsageTransaction>(TX_TABLE)) {
    if (t.userId !== userId) continue;
    if (t.status === "FAILED") continue; // nothing was charged
    const source: EnergySource = t.creditSource === "REWARD" ? "REWARD" : "SUBSCRIPTION";
    const isRefund = t.status === "REVERSED";
    drafts.push({
      id: isRefund ? `refund-${t.id}` : t.id,
      userId,
      type: isRefund ? "REFUND" : "USAGE",
      source,
      amount: isRefund ? t.pointsCost : -t.pointsCost,
      referenceId: t.relatedEntityId,
      referenceType: t.source,
      subscriptionId: t.subscriptionId,
      description: isRefund
        ? "بازگشت انرژی درخواست ناموفق"
        : `مصرف برای ${t.activityType}`,
      createdAt: t.createdAt,
      metadata: { activityType: t.activityType, status: t.status },
    });
  }
  return drafts;
}

/**
 * The user's unified energy ledger, newest first, with running balances per
 * source and an aggregate summary. Read-only; safe on any read path.
 */
export function getEnergyLedger(userId: string): EnergyLedgerResponse {
  const drafts = [
    ...subscriptionGrants(userId),
    ...rewardMovements(userId),
    ...consumptionMovements(userId),
  ];

  // Walk each source's stream oldest-first so balances are causally ordered.
  const ordered = [...drafts].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  const running: Record<EnergySource, number> = { SUBSCRIPTION: 0, REWARD: 0 };
  let lifetimeEarned = 0;
  let lifetimeSpent = 0;

  const withBalances: EnergyLedgerEntry[] = ordered.map((d) => {
    const before = running[d.source];
    const after = before + d.amount;
    running[d.source] = after;
    if (d.amount >= 0) lifetimeEarned += d.amount;
    else lifetimeSpent += -d.amount;
    return { ...d, balanceBefore: before, balanceAfter: after };
  });

  const usage = getUsageSummary(userId);
  const summary: EnergyLedgerSummary = {
    rewardBalance: getRewardBalance(userId),
    subscriptionRemaining: usage.daily.pointsRemaining,
    subscriptionGrantedToday: usage.daily.pointsTotal,
    subscriptionUsedToday: usage.daily.pointsUsed,
    lifetimeEarned,
    lifetimeSpent,
    entryCount: withBalances.length,
  };

  return { entries: withBalances.reverse(), summary };
}
