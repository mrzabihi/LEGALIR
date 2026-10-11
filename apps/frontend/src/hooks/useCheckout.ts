// ============================================================
// LEGALIR — Checkout React Query hooks (quote → validate → order)
// ============================================================
// The checkout modal's data layer. The quote is a live query keyed on
// (planCode, couponCode) so changing the plan or applying/removing a coupon
// re-derives the whole breakdown from the SERVER — the modal never does local
// pricing math. The coupon-validate and order mutations surface the server's
// structured error code so the UI renders the server's own Persian message.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCheckoutOrder,
  fetchCheckoutQuote,
  validateCheckoutCoupon,
  type CheckoutQuoteResult,
} from "@/lib/api/checkout";
import type { CouponValidationResponse, CheckoutOrderResponse } from "@legalir/types";

// ============================================================
// useCheckoutQuote — server-computed breakdown, live on plan + coupon
// ============================================================

/**
 * Fetch the authoritative quote for a (plan, optional coupon) pair. Disabled
 * until a plan is chosen. The coupon code is passed through verbatim; the server
 * normalizes it, and an invalid coupon is reported via `couponError` rather than
 * failing the request.
 */
export function useCheckoutQuote(planCode: string | null, couponCode: string | null) {
  return useQuery<CheckoutQuoteResult>({
    queryKey: ["v1", "checkout", "quote", planCode, couponCode ?? ""],
    queryFn: () =>
      fetchCheckoutQuote({
        planCode: planCode!,
        couponCode: couponCode ?? undefined,
      }),
    enabled: !!planCode,
    staleTime: 30_000,
    retry: 1,
  });
}

// ============================================================
// useValidateCoupon — explicit apply attempt (read-only)
// ============================================================

export function useValidateCoupon() {
  return useMutation<
    CouponValidationResponse,
    Error,
    { planCode: string; couponCode: string }
  >({
    mutationFn: (input) => validateCheckoutCoupon(input),
  });
}

// ============================================================
// useCreateCheckoutOrder — the single authoritative commit
// ============================================================

export function useCreateCheckoutOrder() {
  const queryClient = useQueryClient();

  return useMutation<
    CheckoutOrderResponse,
    Error,
    { planCode: string; couponCode?: string; idempotencyKey: string }
  >({
    mutationFn: (input) => createCheckoutOrder(input),
    onSuccess: () => {
      // A free order activates immediately; a positive order records a pending
      // subscription. Either way every dependent surface must refresh so the
      // page shows the real post-order state (never a fabricated success).
      queryClient.invalidateQueries({ queryKey: ["v1", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["v1", "entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["v1", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["v1", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["v1", "subscription-history"] });
    },
  });
}
