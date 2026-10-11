// ============================================================
// LEGALIR — POST /api/v1/checkout/orders
// ============================================================
// The single authoritative purchase-commit endpoint. The client posts ONLY
// { planCode, couponCode? } — never an amount. The server re-resolves the plan,
// re-validates the coupon and re-computes the final amount, then:
//
//   • final = 0  → activates the subscription immediately (free order)
//   • final > 0  → records an `awaiting_payment` order; the real gateway is not
//                  active, so NOTHING is activated and the client is told so.
//
// Idempotency-Key (header) is required: a double-click / refresh / retry with
// the same key returns the SAME order and never double-charges or double-grants.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { commitOrder, toCheckoutOrderView } from "@/lib/checkout/orders";
import { requestMeta } from "@/lib/admin/http";
import { IDEMPOTENCY_HEADER } from "@/lib/api/idempotency";
import { CHECKOUT_ERROR_FA, type CheckoutOrderResponse } from "@legalir/types";

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { planCode?: unknown; couponCode?: unknown; idempotencyKey?: unknown } | null = null;
  try {
    body = (await request.json()) as {
      planCode?: unknown;
      couponCode?: unknown;
      idempotencyKey?: unknown;
    };
  } catch {
    body = null;
  }
  const planCode = typeof body?.planCode === "string" ? body.planCode.trim() : "";
  const couponCode = typeof body?.couponCode === "string" ? body.couponCode.trim() : "";
  // The header is authoritative; a body key is accepted as a fallback for
  // direct API consumers that cannot set headers.
  const idempotencyKey =
    request.headers.get(IDEMPOTENCY_HEADER)?.trim() ||
    (typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "");

  if (!planCode) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: CHECKOUT_ERROR_FA.PLAN_NOT_FOUND },
      { status: 400 }
    );
  }
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: CHECKOUT_ERROR_FA.VALIDATION_ERROR },
      { status: 400 }
    );
  }

  const { ip } = requestMeta(request);

  const result = await commitOrder({
    userId: auth.ctx.userId,
    planCode,
    couponCode,
    idempotencyKey,
    actorRole: auth.ctx.role,
    ip,
  });

  if (!result.ok) {
    // Coupon failures are 409 (a state conflict the user can act on); plan
    // failures are 404/409. The code + Persian message come straight from the
    // shared checkout error table — never invented here.
    const status =
      result.error === "PLAN_NOT_FOUND"
        ? 404
        : result.error === "PLAN_NOT_PURCHASABLE"
          ? 409
          : 409;
    return NextResponse.json(
      { code: result.error, message: CHECKOUT_ERROR_FA[result.error] },
      { status }
    );
  }

  const payload: CheckoutOrderResponse = {
    order: toCheckoutOrderView(result.order),
    messageFa: result.messageFa,
  };
  return NextResponse.json({ data: payload }, { status: result.replayed ? 200 : 201 });
}
