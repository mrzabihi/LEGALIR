// ============================================================
// LEGALIR — Checkout, Pricing & Coupon domain types
// ============================================================
// The purchase flow is quote → validate → order. These types are shared by the
// server pricing/coupon/order modules and every customer/admin surface so a
// figure rendered in the UI can never be computed a second way.
//
// INVARIANTS the types encode:
//   • A quote is SERVER-computed. The client never posts a price.
//   • `basePrice` is the authoritative catalog `salePrice`, never list price.
//   • `finalAmount` is the ONLY amount that decides gateway-vs-free.
//   • Discounts are clamped (percent capped, fixed clamped) so `finalAmount`
//     is never negative.
//   • Only `finalAmount === 0` yields a payment-free order; anything positive
//     stays `awaiting_payment` until a real gateway settles it.
//
// ADDITIVE: nothing here renames an existing field.
// ============================================================

import type { PlanCode } from "./index";

// ============================================================
// Coupons
// ============================================================

/** The two supported discount shapes. */
export type CouponKind = "percent" | "fixed";

/**
 * Editorial lifecycle of a coupon. `active` is the only status that applies a
 * discount; `disabled` is reversible (a pause), `archived` is terminal (kept
 * for history, never physically deleted so past orders keep their reference).
 */
export type CouponStatus = "active" | "disabled" | "archived";

export const COUPON_KIND_FA: Record<CouponKind, string> = {
  percent: "درصدی",
  fixed: "مبلغ ثابت",
};

export const COUPON_STATUS_FA: Record<CouponStatus, string> = {
  active: "فعال",
  disabled: "غیرفعال",
  archived: "بایگانی‌شده",
};

/**
 * A discount coupon. `value` means percent points (0–100) for `percent` and an
 * absolute amount in `currency` for `fixed`. `percentCap` bounds how large a
 * percent discount may become (default 100) so a misconfigured coupon can never
 * over-discount. `eligiblePlans` empty = every plan. `totalUses`/`perUserLimit`
 * of 0 = unlimited.
 */
export interface Coupon {
  id: string;
  /** Internal, admin-facing title (never shown to customers). */
  title: string;
  /** Normalized (trimmed, upper-cased) redemption code. Unique in the table. */
  code: string;
  kind: CouponKind;
  value: number;
  /** Max effective percent off (≤ 100). Applies to both kinds after clamping. */
  percentCap: number;
  /** Plans this coupon may apply to. Empty array = all plans. */
  eligiblePlans: PlanCode[];
  startsAt: string;
  endsAt: string;
  /** Minimum base price required to use it. 0 = no minimum. */
  minOrderAmount: number;
  /** Total redemptions allowed, 0 = unlimited. */
  totalUses: number;
  /** Redemptions per user, 0 = unlimited. */
  perUserLimit: number;
  status: CouponStatus;
  /** Free-form internal note (never exposed to customers). */
  internalNotes: string;
  currency: string;
  /** Denormalised count of definitive consumptions (kept for fast reporting). */
  usedCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/**
 * One DEFINITIVE consumption of a coupon — written only when an order that
 * actually used the coupon is committed (a free order or a confirmed future
 * payment). A mere validation never writes here. `couponCode` is denormalised
 * so the row survives even if the coupon is later archived.
 */
export interface CouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  userId: string;
  /** The order that consumed the coupon. */
  orderId: string;
  subscriptionId: string | null;
  discountAmount: number;
  currency: string;
  consumedAt: string;
}

// ============================================================
// Quotes (server-computed pricing)
// ============================================================

/** A single displayed line of the invoice breakdown. */
export interface QuoteLine {
  /** Stable key for React + tests. */
  key: string;
  labelFa: string;
  /** Signed amount (negative = a deduction). */
  amount: number;
  /** Optional display hint, e.g. "۲۵٪". */
  hintFa?: string;
}

/** The coupon as it applies to a specific quote (never leaks internals). */
export interface AppliedCouponView {
  code: string;
  titleFa: string;
  kind: CouponKind;
  /** Percent points for `percent`, absolute amount for `fixed`. */
  value: number;
  discountAmount: number;
}

/**
 * A server-computed price quote for one (plan, optional coupon) pair. This is
 * the ONLY source of the numbers the checkout modal renders.
 */
export interface CheckoutQuote {
  planCode: PlanCode;
  planNameFa: string;
  durationDays: number;
  currency: string;
  /** The catalog list price (for the strike-through), never used for math. */
  listPrice: number;
  /** The authoritative catalog sale price = the pre-discount base. */
  basePrice: number;
  coupon: AppliedCouponView | null;
  discountAmount: number;
  /** Effective percent off the base (0–100, rounded for display). */
  discountPercent: number;
  taxAmount: number;
  taxRatePercent: number;
  /** e.g. «بدون مالیات» when the rate is zero. */
  taxLabelFa: string;
  otherAmount: number;
  /** The single amount that decides free-vs-gateway. Never negative. */
  finalAmount: number;
  /** True when `finalAmount > 0` (a gateway would be required). */
  requiresPayment: boolean;
  lines: QuoteLine[];
  /** ISO time the quote was produced (for staleness checks). */
  quotedAt: string;
}

// ============================================================
// Coupon validation result
// ============================================================

export interface CouponValidation {
  valid: boolean;
  /** Machine code when invalid (null when valid). */
  errorCode: CheckoutErrorCode | null;
  /** Friendly Persian message (safe to render verbatim). */
  messageFa: string;
  /** Tenant-safe preview of the discount when valid. */
  coupon: AppliedCouponView | null;
}

// ============================================================
// Order
// ============================================================

/**
 * The order lifecycle. Kept distinct from the admin `OrderStatus` union (which
 * projects sales reporting) because the checkout order is the authoritative
 * purchase record.
 *
 *   positive final → awaiting_payment → (future) paid / failed / cancelled
 *   zero final     → no_payment_required (terminal success; free activation)
 */
export type CheckoutOrderStatus =
  | "awaiting_payment"
  | "paid"
  | "failed"
  | "cancelled"
  | "no_payment_required"
  | "refunded";

export const CHECKOUT_ORDER_STATUS_FA: Record<CheckoutOrderStatus, string> = {
  awaiting_payment: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  failed: "ناموفق",
  cancelled: "لغو شده",
  no_payment_required: "بدون نیاز به پرداخت",
  refunded: "بازگشت وجه",
};

/**
 * The persisted purchase order. Every monetary figure is SNAPSHOT at order
 * time so a later catalog/coupon edit never rewrites a historical order.
 */
export interface StoredOrder {
  id: string;
  /** Human-facing order reference (also the subscription correlation id). */
  referenceId: string;
  userId: string;
  planCode: string;
  planNameFa: string;
  durationDays: number;
  currency: string;
  /** Authoritative pre-discount price (catalog salePrice at order time). */
  basePrice: number;
  listPrice: number;
  couponId: string | null;
  couponCode: string | null;
  couponKind: CouponKind | null;
  /** Snapshot of the coupon's `value` at order time. */
  couponValue: number | null;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  taxRatePercent: number;
  otherAmount: number;
  /** The amount the customer owes (post-discount, post-tax). Never negative. */
  finalAmount: number;
  /** Actually collected money (0 until a real payment settles). */
  collectedAmount: number;
  status: CheckoutOrderStatus;
  paymentId: string | null;
  subscriptionId: string | null;
  /** The gateway implementation; "none" for payment-free orders. */
  gateway: string;
  trackingId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

// ============================================================
// Business error codes
// ============================================================

/**
 * The structured error codes the checkout emits. Each maps to a Persian
 * message on the server (`CHECKOUT_ERROR_FA`) so the client never invents copy.
 */
export type CheckoutErrorCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_EXPIRED"
  | "COUPON_NOT_STARTED"
  | "COUPON_DISABLED"
  | "COUPON_ARCHIVED"
  | "COUPON_LIMIT_REACHED"
  | "USER_COUPON_LIMIT_REACHED"
  | "PLAN_NOT_ELIGIBLE"
  | "MIN_ORDER_NOT_MET"
  | "COUPON_INVALID"
  | "COUPON_CODE_REQUIRED"
  | "PLAN_NOT_FOUND"
  | "PLAN_NOT_PURCHASABLE"
  | "AMOUNT_MISMATCH"
  | "ALREADY_PROCESSED"
  | "VALIDATION_ERROR";

/** Friendly, customer-safe Persian messages for every checkout error code. */
export const CHECKOUT_ERROR_FA: Record<CheckoutErrorCode, string> = {
  COUPON_NOT_FOUND: "کد تخفیف یافت نشد.",
  COUPON_EXPIRED: "مهلت استفاده از این کد تخفیف به پایان رسیده است.",
  COUPON_NOT_STARTED: "این کد تخفیف هنوز فعال نشده است.",
  COUPON_DISABLED: "این کد تخفیف غیرفعال شده است.",
  COUPON_ARCHIVED: "این کد تخفیف دیگر در دسترس نیست.",
  COUPON_LIMIT_REACHED: "ظرفیت استفاده از این کد تخفیف تکمیل شده است.",
  USER_COUPON_LIMIT_REACHED: "سهمیهٔ استفادهٔ شما از این کد تخفیف تکمیل شده است.",
  PLAN_NOT_ELIGIBLE: "این کد تخفیف برای پلن انتخابی معتبر نیست.",
  MIN_ORDER_NOT_MET: "مبلغ سفارش برای استفاده از این کد تخفیف کافی نیست.",
  COUPON_INVALID: "کد تخفیف معتبر نیست.",
  COUPON_CODE_REQUIRED: "کد تخفیف را وارد کنید.",
  PLAN_NOT_FOUND: "پلن انتخابی یافت نشد.",
  PLAN_NOT_PURCHASABLE: "این پلن در حال حاضر قابل خرید نیست.",
  AMOUNT_MISMATCH: "مبلغ سفارش با محاسبهٔ سرور مطابقت ندارد.",
  ALREADY_PROCESSED: "این سفارش قبلاً پردازش شده است.",
  VALIDATION_ERROR: "اطلاعات ارسالی معتبر نیست.",
};

// ============================================================
// API DTOs
// ============================================================

/** The public view of one order, returned by the checkout order route. */
export interface CheckoutOrderView {
  id: string;
  referenceId: string;
  planCode: string;
  planNameFa: string;
  status: CheckoutOrderStatus;
  statusFa: string;
  currency: string;
  basePrice: number;
  discountAmount: number;
  discountPercent: number;
  couponCode: string | null;
  taxAmount: number;
  finalAmount: number;
  collectedAmount: number;
  requiresPayment: boolean;
  gateway: string;
  subscriptionId: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  paidAt: string | null;
}

/** The response to a successful order request. */
export interface CheckoutOrderResponse {
  order: CheckoutOrderView;
  /** The user-facing outcome message (Persian). */
  messageFa: string;
}

/** Result of a coupon validation request. */
export interface CouponValidationResponse extends CouponValidation {
  /** The re-quoted total once the coupon is applied (null when invalid). */
  quote: CheckoutQuote | null;
}
