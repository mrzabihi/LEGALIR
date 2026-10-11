// ============================================================
// LEGALIR — Coupon validation (server-only)
// ============================================================
// The ONE place a coupon is judged against a specific (plan, user, moment).
// Validation is a pure READ — it never consumes capacity. Definite consumption
// happens only at order commit (see lib/checkout/orders.ts), under the same
// mutex, so a validation can never "use up" a coupon and the same coupon can be
// previewed any number of times.
//
// Every failure returns a structured `CheckoutErrorCode` + a customer-safe
// Persian message. The returned object never leaks internal notes, usage
// counters, or the coupon id.
// ============================================================

import {
  CHECKOUT_ERROR_FA,
  type Coupon,
  type CouponValidation,
  type CheckoutErrorCode,
  type SubscriptionPlan,
} from "@legalir/types";
import { getCouponByCode, countUsages, countUserUsages } from "./store";

export interface CouponCheck {
  validation: CouponValidation;
  /** The resolved coupon when valid (null otherwise) — for the quote engine. */
  coupon: Coupon | null;
}

function invalid(code: CheckoutErrorCode): CouponCheck {
  return {
    validation: { valid: false, errorCode: code, messageFa: CHECKOUT_ERROR_FA[code], coupon: null },
    coupon: null,
  };
}

export interface ValidateCouponInput {
  rawCode: string;
  userId: string;
  plan: SubscriptionPlan;
  now?: Date;
}

/**
 * Judge a coupon against a plan + user at `now`. Read-only; no capacity change.
 * Precedence of failures is deterministic so the customer always sees the most
 * specific, most actionable reason (existence → state → time → eligibility →
 * amount → capacity).
 */
export function validateCoupon(input: ValidateCouponInput): CouponCheck {
  const now = input.now ?? new Date();
  const raw = (input.rawCode ?? "").trim();
  if (!raw) return invalid("COUPON_CODE_REQUIRED");

  const coupon = getCouponByCode(raw);
  if (!coupon) return invalid("COUPON_NOT_FOUND");

  // Editorial state.
  if (coupon.status === "archived") return invalid("COUPON_ARCHIVED");
  if (coupon.status === "disabled") return invalid("COUPON_DISABLED");

  // Validity window.
  const t = now.getTime();
  const start = new Date(coupon.startsAt).getTime();
  const end = new Date(coupon.endsAt).getTime();
  if (Number.isFinite(start) && t < start) return invalid("COUPON_NOT_STARTED");
  if (Number.isFinite(end) && t > end) return invalid("COUPON_EXPIRED");

  // Plan eligibility (empty list = all plans).
  if (coupon.eligiblePlans.length > 0 && !coupon.eligiblePlans.includes(input.plan.code)) {
    return invalid("PLAN_NOT_ELIGIBLE");
  }

  // Minimum order amount is measured against the authoritative base price.
  const base = Math.max(0, Math.round(input.plan.salePrice));
  if (coupon.minOrderAmount > 0 && base < coupon.minOrderAmount) {
    return invalid("MIN_ORDER_NOT_MET");
  }

  // Capacity: total (all users) then per-user. Both are count-based, not a
  // mutable counter, so concurrency cannot oversell between check and commit
  // when both run under the order mutex.
  if (coupon.totalUses > 0 && countUsages(coupon.id) >= coupon.totalUses) {
    return invalid("COUPON_LIMIT_REACHED");
  }
  if (coupon.perUserLimit > 0 && countUserUsages(coupon.id, input.userId) >= coupon.perUserLimit) {
    return invalid("USER_COUPON_LIMIT_REACHED");
  }

  return {
    validation: {
      valid: true,
      errorCode: null,
      messageFa: "کد تخفیف اعمال شد.",
      coupon: null, // the applied view is produced by the quote engine
    },
    coupon,
  };
}

/** The display title for a coupon — never the internal notes. */
export function couponDisplayTitle(coupon: Coupon): string {
  return coupon.title || coupon.code;
}
