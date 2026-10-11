// ============================================================
// LEGALIR — POST /api/v1/checkout/coupons/validate
// ============================================================
// Explicit coupon validation. Distinct from the quote route so the UI can show
// a focused "کد اعمال شد / کد معتبر نیست" result without re-rendering the whole
// breakdown. Read-only: validation NEVER consumes coupon capacity. The response
// carries the structured error code + Persian message and, when valid, the
// re-quoted total.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getPlanByCode, isPurchasable } from "@/lib/usage/plans";
import { computeQuote } from "@/lib/pricing/quote";
import { validateCoupon, couponDisplayTitle } from "@/lib/coupons/validate";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta } from "@/lib/admin/http";
import { CHECKOUT_ERROR_FA, type CouponValidationResponse } from "@legalir/types";
import { normalizeCode } from "@/lib/coupons/store";

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
  if (!plan || !isPurchasable(plan)) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: CHECKOUT_ERROR_FA.PLAN_NOT_FOUND },
      { status: plan ? 409 : 404 }
    );
  }

  const check = validateCoupon({ rawCode: rawCoupon, userId: auth.ctx.userId, plan });
  const { ip, requestId } = requestMeta(request);

  // Audit every EXPLICIT validation attempt — valid AND invalid — so the trail
  // distinguishes "apply attempt" from "definitive consumption" (which only
  // happens on order commit). No coupon internals are logged.
  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    action: check.validation.valid ? "checkout.coupon.validated" : "checkout.coupon.rejected",
    resourceType: "coupon",
    resourceId: rawCoupon ? normalizeCode(rawCoupon) : "(empty)",
    result: check.validation.valid ? "success" : "failure",
    reason: check.validation.errorCode,
    after: check.validation.valid ? { planCode: plan.code } : null,
    ip,
    requestId,
  });

  if (!check.validation.valid) {
    const payload: CouponValidationResponse = {
      ...check.validation,
      quote: null,
    };
    return NextResponse.json({ data: payload });
  }

  const quote = computeQuote({
    plan,
    coupon: check.coupon,
    couponTitleFa: check.coupon ? couponDisplayTitle(check.coupon) : undefined,
  });

  const payload: CouponValidationResponse = {
    valid: true,
    errorCode: null,
    messageFa: "کد تخفیف اعمال شد.",
    coupon: quote.coupon,
    quote,
  };
  return NextResponse.json({ data: payload });
}
