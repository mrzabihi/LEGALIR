// ============================================================
// LEGALIR — Payments (server-only)
// ============================================================
// The persisted payment is the ONLY trigger for activating a subscription.
// A click creates a PENDING payment + PENDING subscription; only a verified
// payment confirmation activates a plan (see `lib/subscription/lifecycle.ts`).
//
//   createPaymentIntent  → pending payment + pending subscription
//   verifyPayment        → the PSP seam (mock gateway always verifies)
//   confirmPayment       → the ONLY activation path (idempotent)
//   failPayment          → terminal failure, no entitlement granted
//
// The mock gateway and a real PSP share this shape: the client never sends a
// price, and a replayed confirmation is a no-op (idempotency by payment id).
// ============================================================

import { readTable, writeTable, claimPurchaseReward, recordActivity } from "@/lib/db";
import { getPlanByCode, isPurchasable } from "@/lib/usage/plans";
import {
  createPendingSubscription,
  activateSubscription,
  getSubscriptionById,
  listSubscriptions,
  resolveActiveSubscription,
  type StoredSubscription,
} from "@/lib/subscription/lifecycle";
import type {
  Payment,
  PaymentChannel,
  PlanCode,
} from "@legalir/types";

const TABLE = "payments";

function readAll(): Payment[] {
  return readTable<Payment>(TABLE);
}

function writeAll(rows: Payment[]): void {
  writeTable(TABLE, rows);
}

// ============================================================
// Correlation log (structured, greppable; not a second store)
// ============================================================

/**
 * Emit a structured line for every subscription/payment lifecycle event so a
 * support engineer can trace a purchase end-to-end by `correlationId`. This is
 * deliberately log-only: the durable record is the payment/subscription row.
 */
export function logSubscriptionEvent(
  event: string,
  payload: Record<string, unknown>
): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ scope: "subscription", event, at: new Date().toISOString(), ...payload })
  );
}

// ============================================================
// Reads
// ============================================================

export function getPayment(id: string): Payment | null {
  return readAll().find((p) => p.id === id) ?? null;
}

/** Every payment for a user, newest first. History is never deleted. */
export function listPayments(userId: string): Payment[] {
  return readAll()
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The subscription a payment belongs to (traceable in both directions). */
export function subscriptionForPayment(payment: Payment): StoredSubscription | null {
  if (!payment.subscriptionId) return null;
  return getSubscriptionById(payment.subscriptionId);
}

/** The user's current active subscription, as the canonical view type. */
export function currentSubscriptionFor(userId: string, now: number = Date.now()) {
  return resolveActiveSubscription(userId, now);
}

/**
 * Reuse an existing PENDING payment for the same (user, plan), or create a new
 * one. Reusing prevents a double-click from spawning two pending intents; a
 * confirmed payment is never reused (a new purchase must create a new row).
 */
function findReusablePending(userId: string, planCode: PlanCode): Payment | null {
  return (
    readAll()
      .filter(
        (p) =>
          p.userId === userId &&
          p.planCode === planCode &&
          p.status === "pending"
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

// ============================================================
// Intent creation (pending only — never activates)
// ============================================================

export interface PaymentIntentResult {
  payment: Payment;
  subscription: StoredSubscription;
  /** True when an existing pending intent was reused instead of created. */
  reused: boolean;
}

/**
 * Create (or reuse) a PENDING payment + PENDING subscription for a plan.
 *
 * The price is resolved SERVER-SIDE from the catalog — the client sends only a
 * `planCode`. No entitlement is granted here; the plan becomes active only when
 * `confirmPayment` verifies the payment.
 */
export function createPaymentIntent(params: {
  userId: string;
  planCode: PlanCode;
  now?: Date;
}): PaymentIntentResult | null {
  const plan = getPlanByCode(params.planCode);
  if (!plan) return null;
  // A non-active plan (draft/inactive/archived) cannot start a purchase. This
  // is the enforcement of «غیرفعال کردن پلن، خریدهای جدید را متوقف میکند»;
  // existing subscriptions keep their frozen snapshot and are unaffected.
  if (!isPurchasable(plan)) return null;
  const now = params.now ?? new Date();

  const existing = findReusablePending(params.userId, plan.code);
  if (existing && existing.subscriptionId) {
    const sub = getSubscriptionById(existing.subscriptionId);
    if (sub && sub.status === "pending") {
      return { payment: existing, subscription: sub, reused: true };
    }
  }

  const subscription = createPendingSubscription({
    userId: params.userId,
    plan,
    paymentId: null,
    now,
  });

  const payment: Payment = {
    id: `pay-${crypto.randomUUID()}`,
    userId: params.userId,
    planCode: plan.code,
    amount: plan.salePrice,
    currency: plan.currency || "IRT",
    status: "pending",
    method: "mock",
    subscriptionId: subscription.id,
    idempotencyKey: `pay:${params.userId}:${plan.code}:${crypto.randomUUID()}`,
    transactionId: null,
    correlationId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    paidAt: null,
  };

  const rows = readAll();
  rows.push(payment);
  writeAll(rows);

  // Back-reference so the subscription knows which payment produced it.
  const subRows = readTable<StoredSubscription>("subscriptions");
  const target = subRows.find((s) => s.id === subscription.id);
  if (target) {
    target.payment_id = payment.id;
    target.updated_at = now.toISOString();
    writeTable("subscriptions", subRows);
  }

  logSubscriptionEvent("intent.created", {
    correlationId: payment.correlationId,
    paymentId: payment.id,
    subscriptionId: subscription.id,
    userId: payment.userId,
    planCode: plan.code,
    amount: payment.amount,
  });

  return { payment, subscription, reused: false };
}

// ============================================================
// Gateway seam
// ============================================================

/**
 * The PSP seam. The mock gateway always authorises (so the MVP completes
 * end-to-end); a real gateway would verify the callback signature here. The
 * caller shape and the idempotency key do not change when a real PSP lands.
 */
export function verifyPayment(payment: Payment): { ok: boolean; transactionId: string | null } {
  if (payment.status === "paid") return { ok: true, transactionId: payment.transactionId };
  // Mock: synthesise a PSP transaction reference.
  return { ok: true, transactionId: `mock-txn-${payment.id}` };
}

// ============================================================
// Confirmation (the ONLY activation path)
// ============================================================

export interface ConfirmPaymentResult {
  payment: Payment;
  subscription: StoredSubscription | null;
  /** True when the payment was already paid (idempotent replay). */
  alreadyPaid: boolean;
}

/**
 * Confirm a payment and activate its subscription.
 *
 * Idempotent: a replayed confirmation returns the existing paid payment and its
 * active subscription without creating a second grant, reward or activity row.
 * Guards: the payment must exist and (when `userId` is supplied) belong to the
 * caller — otherwise `null` is returned and the route maps it to 403/404.
 */
export function confirmPayment(params: {
  paymentId: string;
  userId?: string;
  method?: PaymentChannel;
  now?: Date;
}): ConfirmPaymentResult | null {
  const now = params.now ?? new Date();
  const rows = readAll();
  const payment = rows.find((p) => p.id === params.paymentId);
  if (!payment) return null;
  if (params.userId && payment.userId !== params.userId) return null;

  // Idempotent replay: already paid → return the existing active subscription.
  if (payment.status === "paid") {
    const sub = payment.subscriptionId ? getSubscriptionById(payment.subscriptionId) : null;
    return { payment, subscription: sub, alreadyPaid: true };
  }
  if (payment.status === "cancelled" || payment.status === "failed" || payment.status === "refunded") {
    return { payment, subscription: null, alreadyPaid: false };
  }

  const verification = verifyPayment(payment);
  if (!verification.ok) {
    payment.status = "failed";
    payment.updatedAt = now.toISOString();
    writeAll(rows);
    logSubscriptionEvent("payment.failed", {
      correlationId: payment.correlationId,
      paymentId: payment.id,
    });
    return { payment, subscription: null, alreadyPaid: false };
  }

  const plan = getPlanByCode(payment.planCode);
  if (!plan || !payment.subscriptionId) return null;

  // Activate (start = now, end = now + durationDays); supersedes any other
  // active subscription of this user inside the lifecycle module.
  const activation = activateSubscription({
    subscriptionId: payment.subscriptionId,
    durationDays: plan.durationDays,
    now,
  });
  if (!activation) return null;

  payment.status = "paid";
  payment.method = params.method ?? payment.method;
  payment.transactionId = verification.transactionId;
  payment.paidAt = activation.alreadyActive ? payment.paidAt : now.toISOString();
  payment.updatedAt = now.toISOString();
  writeAll(rows);

  // Idempotent downstream effects (keyed by subscription id).
  if (!activation.alreadyActive) {
    claimPurchaseReward(payment.userId, plan.code, activation.subscription.id);
    recordActivity({
      userId: payment.userId,
      type: "subscription",
      title: `خرید اشتراک ${plan.nameFa}`,
      status: "active",
      statusFa: "فعال",
      description: `اشتراک ${plan.nameFa} با ${plan.dailyRequestLimit} درخواست روزانه فعال شد`,
      category: null,
      categoryFa: null,
      sourceId: activation.subscription.id,
    });
  }

  logSubscriptionEvent("payment.confirmed", {
    correlationId: payment.correlationId,
    paymentId: payment.id,
    subscriptionId: activation.subscription.id,
    userId: payment.userId,
    planCode: plan.code,
    superseded: activation.supersededIds,
    replayed: activation.alreadyActive,
  });

  return { payment, subscription: activation.subscription, alreadyPaid: activation.alreadyActive };
}

/** Mark a payment failed/cancelled (terminal; no entitlement was granted). */
export function failPayment(
  paymentId: string,
  status: Extract<Payment["status"], "failed" | "cancelled"> = "failed",
  now: Date = new Date()
): Payment | null {
  const rows = readAll();
  const payment = rows.find((p) => p.id === paymentId);
  if (!payment || payment.status === "paid") return payment ?? null;
  payment.status = status;
  payment.updatedAt = now.toISOString();
  writeAll(rows);
  logSubscriptionEvent("payment." + status, {
    correlationId: payment.correlationId,
    paymentId: payment.id,
  });
  return payment;
}

// ============================================================
// Reconciliation helper
// ============================================================

/**
 * Reconcile a user's subscriptions so at most one is `active`. Thin wrapper
 * over the lifecycle module for admin/diagnostic callers that only hold a
 * userId (rather than the full row list).
 */
export function reconcileUserSubscriptions(userId: string): StoredSubscription[] {
  const active = listSubscriptions(userId).filter((s) => s.status === "active");
  if (active.length <= 1) return active;
  const keep = resolveActiveSubscription(userId);
  return keep ? [keep, ...active.filter((s) => s.id !== keep.id)] : active;
}
