// ============================================================
// LEGALIR — Admin orders & financial adjustments (server-only)
// ============================================================
// Orders are DERIVED from the real `subscriptions` table (the source of
// truth for every sale). Refunds are not destructive: they are recorded as
// adjustments that reference the original order, keeping a full trail.
// Amounts are integers in Toman (IRT).
// ============================================================

import { readTable, writeTable, findUserById, type DbUser } from "@/lib/db";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import type {
  AdminOrder,
  AdminOrderListResponse,
  AdminOrderReceipt,
  OrderStatus,
  FinancialAdjustment,
  StoredSubscription,
  StoredOrder,
  CheckoutOrderStatus,
} from "@legalir/types";
import { ORDER_STATUS_FA } from "@legalir/types";
import { matchesRow } from "@/lib/search/normalize";

const ADJ_TABLE = "financial_adjustments";
const CHECKOUT_ORDERS = "orders";

/**
 * Mask a stored mobile for admin display with the panel-wide rule (four middle
 * digits hidden) so the orders/receipt/support surfaces read identically to the
 * users/lawyers/staff tables.
 */
export function maskMobile(mobile: string): string {
  return maskMobileMiddle(mobile);
}

function orderStatus(statusFa: string, refunded: number, amount: number): OrderStatus {
  if (refunded >= amount && amount > 0) return "REFUNDED";
  if (refunded > 0) return "PARTIALLY_REFUNDED";
  switch (statusFa) {
    case "فعال":
    case "active":
      return "SUCCESS";
    case "منقضی":
    case "expired":
      return "EXPIRED";
    case "در انتظار":
    case "pending":
      return "PENDING";
    case "ناموفق":
    case "failed":
      return "FAILED";
    default:
      return "SUCCESS";
  }
}

/** Sum of completed refunds for an order. */
function refundedFor(orderId: string): number {
  return readTable<FinancialAdjustment>(ADJ_TABLE)
    .filter((a) => a.orderId === orderId && a.status === "completed")
    .reduce((sum, a) => sum + a.amount, 0);
}

/** Build an admin order projection from one subscription row. */
function toOrder(sub: StoredSubscription): AdminOrder {
  const user: DbUser | undefined = findUserById(sub.user_id);
  const refunded = refundedFor(sub.id);
  const amount = sub.amount;
  return {
    id: sub.id,
    referenceId: sub.id,
    userId: sub.user_id,
    userDisplayName: user?.displayName ?? null,
    userMobileMasked: user ? maskMobile(user.mobile) : "••••",
    orgId: user?.orgId ?? null,
    planCode: sub.plan_code,
    planNameFa: sub.plan_name_fa,
    listPrice: sub.amount,
    salePrice: sub.amount,
    discountAmount: 0,
    refundedAmount: refunded,
    netAmount: amount - refunded,
    currency: sub.currency,
    status: orderStatus(sub.status_fa || sub.status, refunded, amount),
    gateway: "simulated",
    trackingId: sub.tracking_id ?? null,
    purchasedAt: sub.purchased_at,
    createdAt: sub.purchased_at,
  };
}

/**
 * Map a checkout order's own lifecycle onto the admin `OrderStatus` union. The
 * checkout status is the authoritative purchase outcome, so it decides the
 * projection rather than the linked subscription's status.
 */
function checkoutOrderStatus(status: CheckoutOrderStatus): OrderStatus {
  switch (status) {
    case "paid":
      return "SUCCESS";
    case "no_payment_required":
      // A payment-free activation is a genuine, completed sale.
      return "SUCCESS";
    case "awaiting_payment":
      return "PENDING";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "EXPIRED";
    case "refunded":
      return "REFUNDED";
    default:
      return "SUCCESS";
  }
}

/**
 * Build an admin order projection from a checkout order — the authoritative
 * purchase record with the base/discount/collected split. `id` is kept equal to
 * the subscription id so refunds (which reference the subscription) still apply,
 * and the two surfaces show ONE stable identifier per purchase.
 */
function toOrderFromCheckout(order: StoredOrder): AdminOrder {
  const user: DbUser | undefined = findUserById(order.userId);
  const orderId = order.subscriptionId ?? order.id;
  const refunded = refundedFor(orderId);
  let status = checkoutOrderStatus(order.status);
  if (refunded >= order.finalAmount && order.finalAmount > 0) status = "REFUNDED";
  else if (refunded > 0) status = "PARTIALLY_REFUNDED";
  return {
    id: orderId,
    referenceId: order.referenceId || orderId,
    userId: order.userId,
    userDisplayName: user?.displayName ?? null,
    userMobileMasked: user ? maskMobile(user.mobile) : "••••",
    orgId: user?.orgId ?? null,
    planCode: order.planCode,
    planNameFa: order.planNameFa,
    listPrice: order.listPrice,
    salePrice: order.finalAmount,
    discountAmount: order.discountAmount,
    refundedAmount: refunded,
    netAmount: order.finalAmount - refunded,
    currency: order.currency || "IRT",
    status,
    gateway: order.gateway === "none" ? "بدون پرداخت" : order.gateway,
    trackingId: order.trackingId,
    purchasedAt: order.paidAt || order.createdAt,
    createdAt: order.createdAt,
  };
}

export interface OrderQuery {
  search?: string;
  status?: OrderStatus | "";
  planCode?: string;
  /**
   * Inclusive ISO window bounds (`[fromIso, toIso)`). When both are set, only
   * orders *purchased* inside the window are returned. The analytics drill-down
   * passes the exact window it reported on so the ledger it opens reconciles to
   * the KPI that produced it. The half-open test is identical to the analytics
   * `withinWindow` helper, so the two never disagree at a boundary instant.
   */
  fromIso?: string;
  toIso?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Every order across BOTH sources, deduped by `id`. Checkout orders win (they
 * carry the authoritative split); a subscription is only projected when no
 * checkout order already represents it.
 */
function allOrders(): AdminOrder[] {
  const checkout = readTable<StoredOrder>(CHECKOUT_ORDERS).map(toOrderFromCheckout);
  const covered = new Set(checkout.map((o) => o.id));
  const legacy = readTable<StoredSubscription>("subscriptions")
    .map(toOrder)
    .filter((o) => !covered.has(o.id));
  return [...checkout, ...legacy];
}

/** Paginated, filterable order list derived from the real checkout + subscription tables. */
export function listOrders(query: OrderQuery = {}): AdminOrderListResponse {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  let orders = allOrders();
  if (query.fromIso && query.toIso) {
    const from = query.fromIso;
    const to = query.toIso;
    orders = orders.filter((o) => o.purchasedAt >= from && o.purchasedAt < to);
  }
  if (query.status) orders = orders.filter((o) => o.status === query.status);
  if (query.planCode) orders = orders.filter((o) => o.planCode === query.planCode);
  if (query.search) {
    orders = orders.filter((o) =>
      matchesRow(query.search!, {
        // Phone lane matches the RAW stored mobile (never the masked row field),
        // so a number query works even though the column renders masked.
        phones: [findUserById(o.userId)?.mobile],
        texts: [o.id, o.userDisplayName],
      })
    );
  }
  orders = orders.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));

  const total = orders.length;
  const start = (page - 1) * pageSize;
  return { items: orders.slice(start, start + pageSize), total, page, pageSize };
}

export function getOrder(id: string): AdminOrder | undefined {
  // Checkout orders are the authoritative record; fall back to a legacy
  // subscription only when no checkout order owns this id.
  const checkout = readTable<StoredOrder>(CHECKOUT_ORDERS).find(
    (o) => (o.subscriptionId ?? o.id) === id
  );
  if (checkout) return toOrderFromCheckout(checkout);
  const sub = readTable<StoredSubscription>("subscriptions").find((s) => s.id === id);
  return sub ? toOrder(sub) : undefined;
}

/**
 * Build the receipt descriptor for an order. A receipt EXISTS only for an
 * order that was actually paid (SUCCESS / REFUNDED / PARTIALLY_REFUNDED); the
 * platform renders a `system_receipt` from the real order row. An unpaid order
 * reports `reason: "not_paid"` and NO fabricated fields. This function never
 * invents a gateway file or a value that is not on the order.
 */
export function buildOrderReceipt(order: AdminOrder): AdminOrderReceipt {
  const paid =
    order.status === "SUCCESS" ||
    order.status === "REFUNDED" ||
    order.status === "PARTIALLY_REFUNDED";

  const base = {
    orderId: order.id,
    referenceId: order.referenceId,
    amount: order.salePrice,
    currency: order.currency,
    paidAt: paid ? order.purchasedAt : null,
    gateway: order.gateway,
    gatewaySimulated: order.gateway === "simulated",
    status: order.status,
    statusFa: ORDER_STATUS_FA[order.status],
    serviceFa: order.planNameFa,
    payerMobileMasked: order.userMobileMasked,
    payerDisplayName: order.userDisplayName,
    generatedAt: new Date().toISOString(),
  } satisfies Partial<AdminOrderReceipt>;

  if (!paid) {
    return {
      ...base,
      available: false,
      reason: "not_paid",
      kind: null,
      transactionId: null,
      trackingId: null,
      hasDocument: false,
      documentMime: null,
      fileUrl: null,
    } as AdminOrderReceipt;
  }

  return {
    ...base,
    available: true,
    reason: null,
    kind: "system_receipt",
    transactionId: order.referenceId,
    trackingId: order.trackingId,
    hasDocument: true,
    documentMime: "application/pdf",
    fileUrl: `/api/v1/admin/orders/${encodeURIComponent(order.id)}/receipt.pdf`,
  } as AdminOrderReceipt;
}

export function listAdjustments(orderId?: string): FinancialAdjustment[] {
  const rows = readTable<FinancialAdjustment>(ADJ_TABLE);
  const filtered = orderId ? rows.filter((a) => a.orderId === orderId) : rows;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface CreateAdjustmentInput {
  orderId: string;
  kind: "refund_full" | "refund_partial" | "adjustment";
  amount: number;
  reason: string;
  requestedBy: string;
}

/**
 * Create a refund/adjustment in `pending` state. A second approver must
 * confirm before it affects the order's net amount — financial operations
 * never complete on a single actor's request.
 */
export function createAdjustment(input: CreateAdjustmentInput): FinancialAdjustment | { error: string } {
  const order = getOrder(input.orderId);
  if (!order) return { error: "ORDER_NOT_FOUND" };
  if (input.amount <= 0) return { error: "INVALID_AMOUNT" };
  const already = refundedFor(input.orderId);
  if (already + input.amount > order.salePrice) return { error: "EXCEEDS_ORDER" };
  if (!input.reason || input.reason.trim().length < 3) return { error: "REASON_REQUIRED" };

  const row: FinancialAdjustment = {
    id: `adj-${crypto.randomUUID()}`,
    orderId: input.orderId,
    kind: input.kind,
    amount: Math.round(input.amount),
    currency: order.currency,
    reason: input.reason.trim(),
    requestedBy: input.requestedBy,
    approvedBy: null,
    status: "pending",
    referencesEntryId: input.orderId,
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  const rows = readTable<FinancialAdjustment>(ADJ_TABLE);
  rows.push(row);
  writeTable(ADJ_TABLE, rows);
  return row;
}

/** Approve or reject a pending adjustment. Requires a DIFFERENT approver. */
export function decideAdjustment(
  id: string,
  decision: "approved" | "rejected",
  approverId: string
): FinancialAdjustment | { error: string } {
  const rows = readTable<FinancialAdjustment>(ADJ_TABLE);
  const idx = rows.findIndex((a) => a.id === id);
  if (idx === -1) return { error: "NOT_FOUND" };
  const adj = rows[idx]!;
  if (adj.status !== "pending") return { error: "ALREADY_DECIDED" };
  if (adj.requestedBy === approverId) return { error: "SECOND_APPROVER_REQUIRED" };

  adj.approvedBy = approverId;
  adj.status = decision === "approved" ? "completed" : "rejected";
  adj.decidedAt = new Date().toISOString();
  rows[idx] = adj;
  writeTable(ADJ_TABLE, rows);
  return adj;
}
