// ============================================================
// LEGALIR — Admin orders & financial adjustments (server-only)
// ============================================================
// Orders are DERIVED from the real `subscriptions` table (the source of
// truth for every sale). Refunds are not destructive: they are recorded as
// adjustments that reference the original order, keeping a full trail.
// Amounts are integers in Toman (IRT).
// ============================================================

import { readTable, writeTable, findUserById, normalizeStoredMobile, type DbUser } from "@/lib/db";
import type {
  AdminOrder,
  AdminOrderListResponse,
  AdminOrderReceipt,
  OrderStatus,
  FinancialAdjustment,
} from "@legalir/types";
import { ORDER_STATUS_FA } from "@legalir/types";

const ADJ_TABLE = "financial_adjustments";

interface StoredSubscription {
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
  plan_snapshot?: { listPrice?: number; salePrice?: number } | undefined;
  /** The gateway tracking code, when the source stored one. */
  tracking_id?: string | null;
}

/** Mask a stored mobile for admin display: keep first 4 + last 4. */
export function maskMobile(mobile: string): string {
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
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

export interface OrderQuery {
  search?: string;
  status?: OrderStatus | "";
  planCode?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated, filterable order list derived from real subscriptions. */
export function listOrders(query: OrderQuery = {}): AdminOrderListResponse {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  let orders = readTable<StoredSubscription>("subscriptions").map(toOrder);
  if (query.status) orders = orders.filter((o) => o.status === query.status);
  if (query.planCode) orders = orders.filter((o) => o.planCode === query.planCode);
  if (query.search) {
    const q = query.search.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.userDisplayName ?? "").toLowerCase().includes(q) ||
        o.userMobileMasked.includes(q)
    );
  }
  orders = orders.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));

  const total = orders.length;
  const start = (page - 1) * pageSize;
  return { items: orders.slice(start, start + pageSize), total, page, pageSize };
}

export function getOrder(id: string): AdminOrder | undefined {
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
