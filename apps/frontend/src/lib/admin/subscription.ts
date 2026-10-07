// ============================================================
// LEGALIR — Admin per-user subscription & energy management (server-only)
// ============================================================
// The admin surface for one user's billing dossier and the audited actions an
// operator may take. Every mutation funnels through the SAME lifecycle module
// the payment flow uses, so an admin action can never create a second active
// subscription or bypass the state machine. Permission gating and auditing live
// in the dispatcher; this module holds only the domain logic.
// ============================================================

import {
  readTable,
  writeTable,
  findUserById,
  normalizeStoredMobile,
  getRewardBalance,
  type RewardLedgerEntry,
} from "@/lib/db";
import { getPlanByCode } from "@/lib/usage/plans";
import { getUsageSummary } from "@/lib/usage/engine";
import { getEnergyLedger } from "@/lib/energy/ledger";
import { listPayments } from "@/lib/payments";
import {
  listSubscriptions,
  resolveActiveSubscription,
  createPendingSubscription,
  activateSubscription,
  cancelSubscription,
  extendSubscription,
} from "@/lib/subscription/lifecycle";
import type {
  AdminEnergyActionInput,
  AdminSubscriptionActionInput,
  AdminSubscriptionHistoryItem,
  AdminUserSubscriptionView,
  PlanCode,
} from "@legalir/types";

function mask(mobile: string): string {
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

function daysUntil(endAt: string | null): number | null {
  if (!endAt) return null;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function toHistoryItem(s: {
  id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status: string;
  status_fa: string;
  start_at: string;
  end_at: string;
  purchased_at: string;
  payment_id?: string | null;
  superseded_at?: string | null;
}): AdminSubscriptionHistoryItem {
  return {
    id: s.id,
    planCode: s.plan_code,
    planNameFa: s.plan_name_fa,
    amount: s.amount,
    currency: s.currency,
    status: s.status,
    statusFa: s.status_fa,
    startAt: s.start_at,
    endAt: s.end_at,
    purchasedAt: s.purchased_at,
    paymentId: s.payment_id ?? null,
    supersededAt: s.superseded_at ?? null,
  };
}

/**
 * The full subscription + energy dossier an admin sees for one user. `null`
 * when the user does not exist. A user with no active subscription is shown as
 * the free fallback — never as an error.
 */
export function getAdminUserSubscriptionView(
  userId: string
): AdminUserSubscriptionView | null {
  const user = findUserById(userId);
  if (!user) return null;

  const active = resolveActiveSubscription(userId);
  const { summary, entries } = getEnergyLedger(userId);

  return {
    userId,
    displayName: user.displayName ?? null,
    mobileMasked: mask(user.mobile),
    current: active
      ? {
          id: active.id,
          planCode: active.plan_code as PlanCode,
          planNameFa: active.plan_name_fa,
          status: active.status,
          startAt: active.start_at,
          endAt: active.end_at,
          daysRemaining: daysUntil(active.end_at),
          autoRenew: Boolean(active.auto_renew),
          isFree: false,
          paymentId: active.payment_id ?? null,
        }
      : {
          id: "free",
          planCode: null,
          planNameFa: null,
          status: "free",
          startAt: null,
          endAt: null,
          daysRemaining: null,
          autoRenew: false,
          isFree: true,
          paymentId: null,
        },
    energy: summary,
    history: listSubscriptions(userId).map(toHistoryItem),
    payments: listPayments(userId),
    // Cap the dossier payload; the full ledger remains available via the
    // dedicated energy endpoint.
    ledger: entries.slice(0, 100),
  };
}

export type AdminActionResult<T> = { ok: true; result: T } | { error: string };

/** Activate a plan for a user (admin override; supersedes the current plan). */
function adminActivatePlan(
  userId: string,
  planCode: PlanCode
): AdminActionResult<{ subscriptionId: string; supersededIds: string[] }> {
  const plan = getPlanByCode(planCode);
  if (!plan) return { error: "PLAN_NOT_FOUND" };
  const now = new Date();
  const pending = createPendingSubscription({ userId, plan, paymentId: null, now });
  const activation = activateSubscription({
    subscriptionId: pending.id,
    durationDays: plan.durationDays,
    now,
  });
  if (!activation) return { error: "ACTIVATION_FAILED" };
  return {
    ok: true,
    result: {
      subscriptionId: activation.subscription.id,
      supersededIds: activation.supersededIds,
    },
  };
}

/**
 * Apply an admin subscription action. Every branch reuses the lifecycle module,
 * so the one-active invariant holds regardless of which surface triggered it.
 */
export function applyAdminSubscriptionAction(params: {
  userId: string;
  input: AdminSubscriptionActionInput;
}): AdminActionResult<{ subscriptionId: string | null; supersededIds: string[] }> {
  const { userId, input } = params;
  if (!input.reason?.trim()) return { error: "REASON_REQUIRED" };
  if (!findUserById(userId)) return { error: "USER_NOT_FOUND" };

  switch (input.action) {
    case "activate":
    case "change_plan": {
      if (!input.planCode) return { error: "PLAN_REQUIRED" };
      const res = adminActivatePlan(userId, input.planCode);
      if ("error" in res) return res;
      return {
        ok: true,
        result: {
          subscriptionId: res.result.subscriptionId,
          supersededIds: res.result.supersededIds,
        },
      };
    }
    case "extend": {
      const active = resolveActiveSubscription(userId);
      if (!active) return { error: "NO_ACTIVE_SUBSCRIPTION" };
      if (!input.days || input.days <= 0) return { error: "INVALID_DAYS" };
      const row = extendSubscription(active.id, input.days);
      if (!row) return { error: "EXTEND_FAILED" };
      return { ok: true, result: { subscriptionId: row.id, supersededIds: [] } };
    }
    case "deactivate": {
      const active = resolveActiveSubscription(userId);
      if (!active) return { error: "NO_ACTIVE_SUBSCRIPTION" };
      cancelSubscription(active.id);
      return { ok: true, result: { subscriptionId: active.id, supersededIds: [] } };
    }
    default:
      return { error: "UNKNOWN_ACTION" };
  }
}

/**
 * Grant or adjust reward energy for a user. Positive amounts grant, negative
 * amounts adjust down. Written directly to the reward ledger (the balance is
 * always SUM(points_delta)) with a unique idempotency key per action, since an
 * admin grant is not rule-driven. Never allowed to push the balance negative.
 */
export function grantAdminEnergy(
  userId: string,
  input: AdminEnergyActionInput,
  actorUserId: string
): AdminActionResult<{ balance: number; delta: number }> {
  if (!findUserById(userId)) return { error: "USER_NOT_FOUND" };
  if (!input.reason?.trim()) return { error: "REASON_REQUIRED" };
  const delta = Math.round(input.amount);
  if (!Number.isFinite(delta) || delta === 0) return { error: "INVALID_AMOUNT" };

  const current = getRewardBalance(userId);
  if (current + delta < 0) return { error: "INSUFFICIENT_BALANCE" };

  const entry: RewardLedgerEntry = {
    id: crypto.randomUUID(),
    user_id: userId,
    event_type: delta > 0 ? "ADMIN_GRANT" : "ADMIN_ADJUSTMENT",
    points_delta: delta,
    source_type: "admin",
    source_id: actorUserId,
    idempotency_key: `admin-energy:${crypto.randomUUID()}`,
    description: input.reason.trim(),
    metadata: { actorUserId, reason: input.reason.trim(), action: input.action },
    created_at: new Date().toISOString(),
  };
  const rows = readTable<RewardLedgerEntry>("reward_ledger");
  rows.push(entry);
  writeTable("reward_ledger", rows);
  return { ok: true, result: { balance: getRewardBalance(userId), delta } };
}

/** A lightweight usage snapshot for the admin panel (today's credit + quotas). */
export function getAdminUserUsage(userId: string) {
  return getUsageSummary(userId);
}

/** True when the user currently has any active subscription (used by lists). */
export function hasActiveSubscription(userId: string): boolean {
  return resolveActiveSubscription(userId) !== null;
}
