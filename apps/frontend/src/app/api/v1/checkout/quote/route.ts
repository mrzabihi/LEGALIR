// ============================================================
// LEGALIR — POST /api/v1/checkout/quote
// ============================================================
// The preview/quote route. Given a plan (and an optional coupon) it returns the
// SERVER-computed price breakdown the checkout modal renders. It is read-only:
// it never creates an order and never consumes a coupon, so it is safe to call
// on every keystroke and on every plan change.
//
// The client sends only a planCode + coupon code — never an amount. The final
// amount it shows comes from here verbatim.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getPlanByCode, isPurchasable } from "@/lib/usage/plans";
import { computeQuote } from "@/lib/pricing/quote";
import { validateCoupon, couponDisplayTitle } from "@/lib/coupons/validate";
import { CHECKOUT_ERROR_FA, type CheckoutErrorCode, type Coupon } from "@legalir/types";

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { planCode?: unknown; couponCode?: unknown } | null = null;
  try {
    body = (await request.json()) as { planCode?: unknown; couponCode?: unknown };
  } catch {
    body = null;
  }
  const planCode = typeof body?.planCode === "string" ? body.planCode.trim() : "";
  const rawCoupon = typeof body?.couponCode === "string" ? body.couponCode.trim() : "";

  const plan = planCode ? getPlanByCode(planCode) : undefined;
  if (!plan) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: CHECKOUT_ERROR_FA.PLAN_NOT_FOUND },
      { status: 404 }
    );
  }
  if (!isPurchasable(plan)) {
    return NextResponse.json(
      { code: "PLAN_NOT_PURCHASABLE", message: CHECKOUT_ERROR_FA.PLAN_NOT_PURCHASABLE },
      { status: 409 }
    );
  }

  // Resolve the coupon (if any). An INVALID coupon does not fail the quote —
  // it is reported alongside the undiscounted total so the modal can show the
  // specific reason while still displaying a base price.
  let coupon: Coupon | null = null;
  let couponError: { code: CheckoutErrorCode; messageFa: string } | null = null;
  if (rawCoupon) {
    const check = validateCoupon({ rawCode: rawCoupon, userId: auth.ctx.userId, plan });
    if (check.validation.valid) {
      coupon = check.coupon;
    } else {
      couponError = {
        code: check.validation.errorCode ?? "COUPON_INVALID",
        messageFa: check.validation.messageFa,
      };
    }
  }

  const quote = computeQuote({
    plan,
    coupon,
    couponTitleFa: coupon ? couponDisplayTitle(coupon) : undefined,
  });

  return NextResponse.json({ data: { quote, couponError } });
}
