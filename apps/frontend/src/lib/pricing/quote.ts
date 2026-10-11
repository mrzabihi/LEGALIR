// ============================================================
// LEGALIR — Order quote engine (server-authoritative pricing)
// ============================================================
// An order quote is the ONE place a purchase's numbers are computed. The
// checkout modal renders whatever this returns and never recomputes a figure.
// It is a pure function of (plan, coupon, now) so it is trivially unit-testable
// and can run identically on a quote route, a validate route and the order
// commit path (so the committed amount is guaranteed to equal the previewed
// amount, both derived from the same inputs).
//
// Discount policy (both kinds are CLAMPED so the final can never go negative):
//   percent → discount = base × min(value, percentCap) / 100
//   fixed   → discount = min(value, base)
//   discount ≤ base, always.
//
// The final amount is `base − discount + tax + other`; when it is exactly 0 the
// order is payment-free, otherwise a gateway would be required.
// ============================================================

import type { Coupon, CouponKind, CheckoutQuote, QuoteLine, SubscriptionPlan } from "@legalir/types";
import {
  ORDER_CURRENCY,
  ORDER_TAX_RATE_PERCENT,
  TAX_ZERO_LABEL_FA,
} from "./config";

/** Persian digits helper — kept local so this module has no React/UI imports. */
function faNum(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export interface DiscountResult {
  discountAmount: number;
  /** The effective percent off the base (0–100), rounded for display. */
  discountPercent: number;
}

/**
 * The coupon's effect on a base price, clamped so the discount is never
 * negative, never exceeds the base, and a percent coupon never exceeds its own
 * `percentCap`. Shared by the quote engine and the coupon-validate preview.
 */
export function computeCouponDiscount(
  base: number,
  coupon: Pick<Coupon, "kind" | "value" | "percentCap">
): DiscountResult {
  if (!Number.isFinite(base) || base <= 0) return { discountAmount: 0, discountPercent: 0 };
  if (!Number.isFinite(coupon.value) || coupon.value <= 0) {
    return { discountAmount: 0, discountPercent: 0 };
  }

  let discount: number;
  if (coupon.kind === "percent") {
    // Cap the percent (default 100) and never exceed 100.
    const cap =
      Number.isFinite(coupon.percentCap) && coupon.percentCap > 0
        ? Math.min(100, coupon.percentCap)
        : 100;
    const usedPercent = Math.min(coupon.value, cap);
    discount = Math.round((base * usedPercent) / 100);
  } else {
    // Fixed: cap the amount to the base so it is clamped at zero, never below.
    discount = Math.round(Math.min(coupon.value, base));
  }

  discount = Math.max(0, Math.min(discount, base));
  const discountPercent = base > 0 ? Math.round((discount / base) * 100) : 0;
  return { discountAmount: discount, discountPercent };
}

/**
 * Build the full breakdown lines for a quote. Order is fixed: base, (discount),
 * tax, other, final — the same order the printed invoice and the admin report
 * render.
 */
function buildLines(q: {
  basePrice: number;
  coupon: { titleFa: string; kind: CouponKind; value: number } | null;
  taxAmount: number;
  taxRatePercent: number;
  otherAmount: number;
  finalAmount: number;
}): QuoteLine[] {
  const lines: QuoteLine[] = [{ key: "base", labelFa: "مبلغ پایه", amount: q.basePrice }];
  if (q.coupon) {
    const hintFa =
      q.coupon.kind === "percent" ? `${faNum(q.coupon.value)}٪` : `کد ${q.coupon.titleFa}`;
    lines.push({ key: "discount", labelFa: "تخفیف", amount: 0, hintFa });
  }
  lines.push({
    key: "tax",
    labelFa: q.taxRatePercent > 0 ? `مالیات (${faNum(q.taxRatePercent)}٪)` : TAX_ZERO_LABEL_FA,
    amount: q.taxAmount,
  });
  if (q.otherAmount !== 0) {
    lines.push({ key: "other", labelFa: "سایر هزینه‌ها", amount: q.otherAmount });
  }
  lines.push({ key: "final", labelFa: "مبلغ قابل پرداخت", amount: q.finalAmount });
  return lines;
}

export interface ComputeQuoteInput {
  plan: SubscriptionPlan;
  /** The coupon to apply, if any (already loaded + ownership-checked). */
  coupon: Coupon | null;
  /** Display title of the coupon (defaults to the code) — never internal notes. */
  couponTitleFa?: string;
  now?: Date;
}

/**
 * Compute the authoritative quote for a plan with an optional coupon. Pure:
 * no db access, no clock beyond `now`, deterministic. The caller resolves the
 * plan and coupon; this only does the math + presentation.
 */
export function computeQuote(input: ComputeQuoteInput): CheckoutQuote {
  const { plan, coupon } = input;
  const now = input.now ?? new Date();
  const currency = plan.currency || ORDER_CURRENCY;

  const basePrice = Math.max(0, Math.round(plan.salePrice));
  const listPrice = Math.max(0, Math.round(plan.listPrice));

  let discountAmount = 0;
  let discountPercent = 0;
  let applied: CheckoutQuote["coupon"] = null;
  if (coupon) {
    const d = computeCouponDiscount(basePrice, coupon);
    discountAmount = d.discountAmount;
    discountPercent = d.discountPercent;
    applied = {
      code: coupon.code,
      titleFa: input.couponTitleFa ?? coupon.title,
      kind: coupon.kind,
      value: coupon.value,
      discountAmount,
    };
  }

  const subtotal = Math.max(0, basePrice - discountAmount);
  const taxRatePercent = ORDER_TAX_RATE_PERCENT;
  const taxAmount = taxRatePercent > 0 ? Math.round((subtotal * taxRatePercent) / 100) : 0;
  const otherAmount = 0;
  const finalAmount = Math.max(0, subtotal + taxAmount + otherAmount);

  const quote: CheckoutQuote = {
    planCode: plan.code,
    planNameFa: plan.nameFa,
    durationDays: plan.durationDays,
    currency,
    listPrice,
    basePrice,
    coupon: applied,
    discountAmount,
    discountPercent,
    taxAmount,
    taxRatePercent,
    taxLabelFa: taxRatePercent > 0 ? `مالیات ${faNum(taxRatePercent)}٪` : TAX_ZERO_LABEL_FA,
    otherAmount,
    finalAmount,
    requiresPayment: finalAmount > 0,
    lines: [],
    quotedAt: now.toISOString(),
  };

  // Render the discount line's real amount now that the coupon is resolved.
  quote.lines = buildLines({
    basePrice,
    coupon: applied,
    taxAmount,
    taxRatePercent,
    otherAmount,
    finalAmount,
  });
  // Stamp the discount amount onto its line (kept out of buildLines' pure math).
  const discountLine = quote.lines.find((l) => l.key === "discount");
  if (discountLine) discountLine.amount = -discountAmount;

  return quote;
}
