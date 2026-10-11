// ============================================================
// LEGALIR — Checkout order commit (server-only, the ONE write path)
// ============================================================
// `commitOrder` is the single authoritative place a purchase is committed. It
// runs entirely inside `withCheckoutLock`, so the coupon capacity check, the
// order write and the coupon-usage write are atomic within this process.
//
// Behaviour is decided ONLY by the server-computed final amount:
//
//   finalAmount === 0  →  status `no_payment_required`
//                          • subscription created + ACTIVATED immediately
//                          • coupon consumed (definitive)
//                          • gateway = "none", collectedAmount = 0
//
//   finalAmount  >  0  →  status `awaiting_payment`
//                          • subscription created PENDING (not activated)
//                          • coupon NOT consumed yet (deferred to real payment)
//                          • gateway = "mock" (real gateway inactive), collected 0
//                          • returns the amount so the client shows the gateway
//                            notice and never fabricates success
//
// Idempotency: a repeated commit with the same (userId, idempotencyKey) returns
// the SAME order and never writes a second one, so a double-click, a refresh or
// a client retry can never double-charge or double-activate.
// ============================================================

import { readTable, writeTable, claimPurchaseReward, recordActivity } from "@/lib/db";
import { getPlanByCode, isPurchasable } from "@/lib/usage/plans";
import {
  createPendingSubscription,
  activateSubscription,
  getSubscriptionById,
  type StoredSubscription,
} from "@/lib/subscription/lifecycle";
import { recordUsage } from "@/lib/coupons/store";
import { validateCoupon, couponDisplayTitle } from "@/lib/coupons/validate";
import { computeQuote } from "@/lib/pricing/quote";
import { ORDER_CURRENCY } from "@/lib/pricing/config";
import { recordAudit } from "@/lib/admin/audit";
import { withCheckoutLock } from "./mutex";
import {
  CHECKOUT_ORDER_STATUS_FA,
  type CheckoutErrorCode,
  type CheckoutOrderStatus,
  type CheckoutOrderView,
  type StoredOrder,
} from "@legalir/types";

const TABLE = "orders";

function readAll(): StoredOrder[] {
  return readTable<StoredOrder>(TABLE);
}
function writeAll(rows: StoredOrder[]): void {
  writeTable(TABLE, rows);
}

// ============================================================
// Reads
// ============================================================

/** A user's orders, newest first (history is never deleted). */
export function listOrdersForUser(userId: string): StoredOrder[] {
  return readAll()
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrderById(id: string): StoredOrder | null {
  return readAll().find((o) => o.id === id) ?? null;
}

/** The order a subscription belongs to (traceability in both directions). */
export function getOrderBySubscription(subscriptionId: string): StoredOrder | null {
  return readAll().find((o) => o.subscriptionId === subscriptionId) ?? null;
}

/** Find a prior order for the same idempotency key (duplicate-request guard). */
function findByIdempotencyKey(userId: string, key: string): StoredOrder | null {
  if (!key) return null;
  return readAll().find((o) => o.userId === userId && o.idempotencyKey === key) ?? null;
}

/** Project a stored order onto the customer-facing view. */
export function toCheckoutOrderView(order: StoredOrder): CheckoutOrderView {
  const sub = order.subscriptionId ? getSubscriptionById(order.subscriptionId) : null;
  return {
    id: order.id,
    referenceId: order.referenceId,
    planCode: order.planCode,
    planNameFa: order.planNameFa,
    status: order.status,
    statusFa: CHECKOUT_ORDER_STATUS_FA[order.status],
    currency: order.currency,
    basePrice: order.basePrice,
    discountAmount: order.discountAmount,
    discountPercent: order.discountPercent,
    couponCode: order.couponCode,
    taxAmount: order.taxAmount,
    finalAmount: order.finalAmount,
    collectedAmount: order.collectedAmount,
    requiresPayment: order.finalAmount > 0,
    gateway: order.gateway,
    subscriptionId: order.subscriptionId,
    startAt: sub?.start_at || null,
    endAt: sub?.end_at || null,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

// ============================================================
// Commit
// ============================================================

export interface CommitOrderInput {
  userId: string;
  planCode: string;
  couponCode?: string | null;
  idempotencyKey: string;
  actorRole?: string;
  ip?: string | null;
  now?: Date;
}

export type CommitOrderResult =
  | {
      ok: true;
      order: StoredOrder;
      subscription: StoredSubscription | null;
      /** True when the free path activated the subscription in this call. */
      activated: boolean;
      /** True when an existing order was returned (idempotent replay). */
      replayed: boolean;
      messageFa: string;
    }
  | { ok: false; error: CheckoutErrorCode };

const FREE_MESSAGE_FA = "اشتراک شما با موفقیت فعال شد.";
const PENDING_MESSAGE_FA = "سفارش ثبت شد. برای فعال‌سازی، پرداخت باید تکمیل شود.";

/**
 * Commit a purchase. See the module header for the free-vs-pending policy.
 * Everything runs inside the checkout lock so capacity + writes are atomic.
 */
export async function commitOrder(input: CommitOrderInput): Promise<CommitOrderResult> {
  return withCheckoutLock(() => commitOrderLocked(input));
}

function commitOrderLocked(input: CommitOrderInput): CommitOrderResult {
  const now = input.now ?? new Date();
  const identifier = (input.idempotencyKey ?? "").trim();

  // 1. Idempotent replay — never create a second order for the same attempt.
  if (identifier) {
    const prior = findByIdempotencyKey(input.userId, identifier);
    if (prior) {
      return {
        ok: true,
        order: prior,
        subscription: prior.subscriptionId ? getSubscriptionById(prior.subscriptionId) : null,
        activated: prior.status === "no_payment_required" || prior.status === "paid",
        replayed: true,
        messageFa: prior.finalAmount === 0 ? FREE_MESSAGE_FA : PENDING_MESSAGE_FA,
      };
    }
  }

  // 2. Authoritative plan resolution (client never sends a price).
  const plan = getPlanByCode(input.planCode);
  if (!plan) return { ok: false, error: "PLAN_NOT_FOUND" };
  if (!isPurchasable(plan)) return { ok: false, error: "PLAN_NOT_PURCHASABLE" };

  // 3. Coupon (optional) — validated here, under the lock, so the capacity it
  //    checked cannot change before we commit.
  let coupon: ReturnType<typeof validateCoupon>["coupon"] = null;
  if (input.couponCode && input.couponCode.trim()) {
    const check = validateCoupon({ rawCode: input.couponCode, userId: input.userId, plan, now });
    if (!check.validation.valid) {
      recordAudit({
        actorUserId: input.userId,
        actorRole: input.actorRole ?? "user",
        action: "checkout.coupon.rejected",
        resourceType: "coupon",
        resourceId: input.couponCode.trim().toUpperCase(),
        result: "failure",
        reason: check.validation.errorCode,
        ip: input.ip ?? null,
      });
      return { ok: false, error: check.validation.errorCode ?? "COUPON_INVALID" };
    }
    coupon = check.coupon;
  }

  // 4. Server-computed quote — the ONLY source of every figure on the order.
  const quote = computeQuote({
    plan,
    coupon,
    couponTitleFa: coupon ? couponDisplayTitle(coupon) : undefined,
    now,
  });

  // 5. Write the order (+ subscription, + coupon usage on the free path).
  const orderId = `ord-${crypto.randomUUID()}`;
  const referenceId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const base = {
    id: orderId,
    referenceId,
    userId: input.userId,
    planCode: plan.code,
    planNameFa: plan.nameFa,
    durationDays: plan.durationDays,
    currency: plan.currency || ORDER_CURRENCY,
    basePrice: quote.basePrice,
    listPrice: quote.listPrice,
    couponId: coupon?.id ?? null,
    couponCode: coupon?.code ?? null,
    couponKind: coupon?.kind ?? null,
    couponValue: coupon?.value ?? null,
    discountAmount: quote.discountAmount,
    discountPercent: quote.discountPercent,
    taxAmount: quote.taxAmount,
    taxRatePercent: quote.taxRatePercent,
    otherAmount: quote.otherAmount,
    finalAmount: quote.finalAmount,
    collectedAmount: 0,
    trackingId: null,
    idempotencyKey: identifier,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (quote.finalAmount === 0) {
    // ---- FREE PATH: activate now, consume the coupon now. ----
    const subscription = createPendingSubscription({ userId: input.userId, plan, paymentId: null, now });
    const activation = activateSubscription({
      subscriptionId: subscription.id,
      durationDays: plan.durationDays,
      now,
    });
    const activeSub = activation?.subscription ?? subscription;

    const order: StoredOrder = {
      ...base,
      status: "no_payment_required",
      subscriptionId: activeSub.id,
      paymentId: null,
      gateway: "none",
      paidAt: now.toISOString(),
    };
    const rows = readAll();
    rows.push(order);
    writeAll(rows);

    if (coupon) {
      recordUsage(
        {
          couponId: coupon.id,
          couponCode: coupon.code,
          userId: input.userId,
          orderId: order.id,
          subscriptionId: activeSub.id,
          discountAmount: quote.discountAmount,
          currency: order.currency,
        },
        now
      );
    }

    // Idempotent downstream effects, keyed by subscription id.
    claimPurchaseReward(input.userId, plan.code, activeSub.id);
    recordActivity({
      userId: input.userId,
      type: "subscription",
      title: `خرید اشتراک ${plan.nameFa}`,
      status: "active",
      statusFa: "فعال",
      description: `اشتراک ${plan.nameFa} با ${plan.dailyRequestLimit} درخواست روزانه فعال شد`,
      category: null,
      categoryFa: null,
      sourceId: activeSub.id,
    });

    recordAudit({
      actorUserId: input.userId,
      actorRole: input.actorRole ?? "user",
      action: "checkout.order.free",
      resourceType: "order",
      resourceId: order.id,
      result: "success",
      after: {
        planCode: order.planCode,
        couponCode: order.couponCode,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
        subscriptionId: activeSub.id,
      },
      ip: input.ip ?? null,
    });

    return {
      ok: true,
      order,
      subscription: activeSub,
      activated: true,
      replayed: false,
      messageFa: FREE_MESSAGE_FA,
    };
  }

  // ---- POSITIVE PATH: pending subscription, order awaiting payment. ----
  const subscription = createPendingSubscription({ userId: input.userId, plan, paymentId: null, now });
  const order: StoredOrder = {
    ...base,
    status: "awaiting_payment",
    subscriptionId: subscription.id,
    paymentId: null,
    gateway: "mock",
    paidAt: null,
  };
  const rows = readAll();
  rows.push(order);
  writeAll(rows);

  recordAudit({
    actorUserId: input.userId,
    actorRole: input.actorRole ?? "user",
    action: "checkout.order.awaiting_payment",
    resourceType: "order",
    resourceId: order.id,
    result: "success",
    after: {
      planCode: order.planCode,
      couponCode: order.couponCode,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
    },
    ip: input.ip ?? null,
  });

  return {
    ok: true,
    order,
    subscription,
    activated: false,
    replayed: false,
    messageFa: PENDING_MESSAGE_FA,
  };
}

// ============================================================
// Gateway settlement seam (real gateway NOT active yet)
// ============================================================
// When a real gateway lands, its verified callback will move an
// `awaiting_payment` order to `paid`: it must re-validate the coupon capacity,
// consume the coupon, set `collectedAmount`, activate the pending subscription
// and stamp `trackingId`. It is intentionally NOT wired to any client-callable
// route now, so nothing can mark an order paid without a real payment.
export const GATEWAY_SETTLEMENT_READY = false;

/** The statuses a settlement may legally transition from. */
export const SETTLEABLE_ORDER_STATUSES: CheckoutOrderStatus[] = ["awaiting_payment"];
