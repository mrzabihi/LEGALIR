// ============================================================
// LEGALIR — Checkout API client (quote → validate → order)
// ============================================================
// Thin wrappers over the three authoritative checkout routes. Every figure the
// UI renders comes back from these calls verbatim — the client NEVER sends or
// computes a price, tax or discount. The order call carries a stable
// `idempotencyKey` supplied by the caller so a double-click / retry of the SAME
// logical attempt can never create a second order.
//
// We deliberately do NOT route the order through the generic idempotency-key
// injection in `client.ts`: that injection mints a FRESH key per request, which
// would defeat retry-reuse. Instead the caller owns the key and passes it in the
// body (the route accepts a body key as a fallback when no header is set).
// ============================================================

import { apiClient } from "./client";
import type {
  CheckoutErrorCode,
  CheckoutOrderResponse,
  CheckoutQuote,
  CouponValidationResponse,
} from "@legalir/types";

/** The quote route's payload: the computed quote plus any coupon error. */
export interface CheckoutQuoteResult {
  quote: CheckoutQuote;
  /** Present only when a coupon was supplied but rejected (never fatal). */
  couponError: { code: CheckoutErrorCode; messageFa: string } | null;
}

/** Server-computed price breakdown for a (plan, optional coupon) pair. */
export function fetchCheckoutQuote(input: {
  planCode: string;
  couponCode?: string;
}): Promise<CheckoutQuoteResult> {
  return apiClient.post<CheckoutQuoteResult>("/api/v1/checkout/quote", input);
}

/** Validate a coupon explicitly (for focused apply/remove feedback). Read-only. */
export function validateCheckoutCoupon(input: {
  planCode: string;
  couponCode: string;
}): Promise<CouponValidationResponse> {
  return apiClient.post<CouponValidationResponse>("/api/v1/checkout/coupons/validate", input);
}

/**
 * Commit the purchase. The server re-resolves the plan, re-validates the coupon
 * and re-computes the final amount; it decides free-vs-pending from that amount.
 * `idempotencyKey` MUST be stable across retries of the same attempt.
 */
export function createCheckoutOrder(input: {
  planCode: string;
  couponCode?: string;
  idempotencyKey: string;
}): Promise<CheckoutOrderResponse> {
  return apiClient.post<CheckoutOrderResponse>("/api/v1/checkout/orders", input);
}
