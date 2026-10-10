// ============================================================
// LEGALIR — Subscription Lifecycle (server-only)
// ============================================================
// The ONE place a subscription changes status. Every writer
// (checkout, payment confirmation, admin action, expiry sweep) goes through
// here so the invariant "exactly one ACTIVE subscription per user" is enforced
// structurally and can never depend on which surface happened to run.
//
//   (none) --create--> pending --confirm--> active --new active--> superseded
//                         |                   |
//                         +--cancel--> cancelled  +--end_at<now--> expired
//
// The JSON store has no transactions, so correctness relies on:
//   • writing the whole subscriptions table in ONE synchronous pass, and
//   • making every transition IDEMPOTENT (re-running it is a no-op).
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { snapshotFor } from "@/lib/usage/plans";
import type {
  StoredSubscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@legalir/types";

// The row shape lives in @legalir/types (one declaration). Re-exported here so
// existing importers (`@/lib/subscription/lifecycle`) keep resolving it.
export type { StoredSubscription };

const TABLE = "subscriptions";

export const SUBSCRIPTION_STATUS_FA: Record<SubscriptionStatus, string> = {
  pending: "در انتظار پرداخت",
  active: "فعال",
  expired: "منقضی شده",
  cancelled: "لغو شده",
  superseded: "جایگزین شده",
};

/** Statuses that can never transition again. */
const TERMINAL = new Set(["expired", "cancelled", "superseded"]);

function readAll(): StoredSubscription[] {
  return readTable<StoredSubscription>(TABLE);
}

function writeAll(rows: StoredSubscription[]): void {
  writeTable(TABLE, rows);
}

// ============================================================
// Reads
// ============================================================

/** Every subscription row for a user, newest first. History is never deleted. */
export function listSubscriptions(userId: string): StoredSubscription[] {
  return readAll()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
}

/**
 * The user's single ACTIVE subscription: status `active` AND `end_at` in the
 * future, newest first. This is the canonical answer every surface must use.
 * A row whose status is `active` but whose `end_at` has passed does NOT count.
 */
export function resolveActiveSubscription(
  userId: string,
  now: number = Date.now()
): StoredSubscription | null {
  const active = readAll()
    .filter(
      (s) =>
        s.user_id === userId &&
        s.status === "active" &&
        new Date(s.end_at).getTime() > now
    )
    .sort(
      (a, b) =>
        b.start_at.localeCompare(a.start_at) ||
        b.purchased_at.localeCompare(a.purchased_at)
    );
  return active[0] ?? null;
}

/** True when the user has a (non-terminal) subscription awaiting payment. */
export function findPendingSubscription(userId: string): StoredSubscription | null {
  return (
    readAll()
      .filter((s) => s.user_id === userId && s.status === "pending")
      .sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))[0] ?? null
  );
}

export function getSubscriptionById(id: string): StoredSubscription | null {
  return readAll().find((s) => s.id === id) ?? null;
}

// ============================================================
// Transitions
// ============================================================

function setStatus(
  row: StoredSubscription,
  status: SubscriptionStatus,
  now: string
): void {
  row.status = status;
  row.status_fa = SUBSCRIPTION_STATUS_FA[status];
  row.updated_at = now;
}

/**
 * Create a PENDING subscription from a plan. No entitlement is granted until
 * the matching payment is confirmed — a click alone never activates a plan.
 * `start_at`/`end_at` are set only at activation.
 */
export function createPendingSubscription(params: {
  userId: string;
  plan: SubscriptionPlan;
  paymentId: string | null;
  now?: Date;
}): StoredSubscription {
  const nowIso = (params.now ?? new Date()).toISOString();
  const rows = readAll();
  const row: StoredSubscription = {
    id: `sub-${crypto.randomUUID()}`,
    user_id: params.userId,
    plan_code: params.plan.code,
    plan_name_fa: params.plan.nameFa,
    amount: params.plan.salePrice,
    currency: params.plan.currency || "IRT",
    status: "pending",
    status_fa: SUBSCRIPTION_STATUS_FA.pending,
    start_at: "",
    end_at: "",
    purchased_at: nowIso,
    auto_renew: 1,
    plan_snapshot: snapshotFor(params.plan),
    payment_id: params.paymentId,
    superseded_at: null,
    updated_at: nowIso,
  };
  rows.push(row);
  writeAll(rows);
  return row;
}

/** Link a subscription to its payment (called when the payment row is created). */
export function attachPayment(subscriptionId: string, paymentId: string): void {
  const rows = readAll();
  const row = rows.find((s) => s.id === subscriptionId);
  if (!row) return;
  row.payment_id = paymentId;
  row.updated_at = new Date().toISOString();
  writeAll(rows);
}

/**
 * Mark every OTHER active subscription of the user as `superseded`. Any plan
 * change (upgrade, downgrade, re-purchase) replaces the current one — the new
 * plan never waits for the old one to lapse. Existing rows are kept as history.
 */
export function supersedeActiveSubscriptions(
  userId: string,
  keepId: string,
  now: string
): string[] {
  const rows = readAll();
  const superseded: string[] = [];
  for (const row of rows) {
    if (row.user_id === userId && row.status === "active" && row.id !== keepId) {
      setStatus(row, "superseded", now);
      row.superseded_at = now;
      superseded.push(row.id);
    }
  }
  if (superseded.length > 0) writeAll(rows);
  return superseded;
}

export interface ActivationResult {
  subscription: StoredSubscription;
  supersededIds: string[];
  /** True when the subscription was already active (idempotent replay). */
  alreadyActive: boolean;
}

/**
 * Activate a (pending) subscription. Idempotent: if the row is already active
 * it is returned unchanged and nothing is superseded. The activation instant is
 * the source of the term — `end_at = start_at + durationDays`.
 */
export function activateSubscription(params: {
  subscriptionId: string;
  durationDays: number;
  now?: Date;
}): ActivationResult | null {
  const nowDate = params.now ?? new Date();
  const now = nowDate.toISOString();
  const rows = readAll();
  const row = rows.find((s) => s.id === params.subscriptionId);
  if (!row) return null;

  if (row.status === "active" && new Date(row.end_at).getTime() > nowDate.getTime()) {
    return { subscription: row, supersededIds: [], alreadyActive: true };
  }

  row.start_at = now;
  row.end_at = new Date(
    nowDate.getTime() + params.durationDays * 86_400_000
  ).toISOString();
  setStatus(row, "active", now);
  writeAll(rows);

  const supersededIds = supersedeActiveSubscriptions(row.user_id, row.id, now);
  return { subscription: row, supersededIds, alreadyActive: false };
}

/** Explicitly expire a subscription (end_at passed, or admin action). */
export function expireSubscription(id: string, now: string = new Date().toISOString()): void {
  const rows = readAll();
  const row = rows.find((s) => s.id === id);
  if (!row || TERMINAL.has(row.status)) return;
  setStatus(row, "expired", now);
  writeAll(rows);
}

/** Cancel a subscription before its term (user/admin; terminal). */
export function cancelSubscription(id: string, now: string = new Date().toISOString()): void {
  const rows = readAll();
  const row = rows.find((s) => s.id === id);
  if (!row || TERMINAL.has(row.status)) return;
  setStatus(row, "cancelled", now);
  writeAll(rows);
}

/** Add whole days to a subscription's term (admin extend). */
export function extendSubscription(
  id: string,
  days: number,
  now: Date = new Date()
): StoredSubscription | null {
  const rows = readAll();
  const row = rows.find((s) => s.id === id);
  if (!row || TERMINAL.has(row.status)) return null;
  const base =
    row.end_at && !Number.isNaN(new Date(row.end_at).getTime())
      ? new Date(row.end_at).getTime()
      : now.getTime();
  row.end_at = new Date(base + days * 86_400_000).toISOString();
  row.updated_at = now.toISOString();
  writeAll(rows);
  return row;
}

// ============================================================
// Migration / reconciliation (idempotent)
// ============================================================
// Existing data may contain: (a) `active` rows whose `end_at` has passed, and
// (b) more than one `active` row for a user (the reported Gold+Diamond case).
// This sweep normalises both WITHOUT deleting anything. It writes only when it
// actually changes a row, so it is safe to call on a read path.

export function reconcileSubscriptionStatuses(now: number = Date.now()): number {
  const rows = readAll();
  const nowIso = new Date(now).toISOString();
  let changed = 0;

  // (a) active + past end_at → expired
  for (const row of rows) {
    if (
      row.status === "active" &&
      row.end_at &&
      new Date(row.end_at).getTime() <= now
    ) {
      setStatus(row, "expired", nowIso);
      changed += 1;
    }
  }

  // (b) more than one active per user → keep the newest, supersede the rest
  const byUser = new Map<string, StoredSubscription[]>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  for (const list of byUser.values()) {
    if (list.length <= 1) continue;
    list.sort(
      (a, b) =>
        b.start_at.localeCompare(a.start_at) ||
        b.purchased_at.localeCompare(a.purchased_at)
    );
    for (const row of list.slice(1)) {
      setStatus(row, "superseded", nowIso);
      row.superseded_at = nowIso;
      changed += 1;
    }
  }

  if (changed > 0) writeAll(rows);
  return changed;
}
