// ============================================================
// LEGALIR — PATCH /api/v1/me/account-type
// ============================================================
// Sets the platform account type (PERSONAL | BUSINESS). LAWYER is NOT
// settable here — it is granted only through the lawyer-application
// flow, which also assigns the LAWYER role. Authorization is enforced
// server-side: the user id comes from the session, never the body.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { setPlatformAccountType, findUserById } from "@/lib/db";
import { normalizeAccountType, type PlatformAccountType } from "@legalir/types";

const SETTABLE: PlatformAccountType[] = ["PERSONAL", "BUSINESS"];

export async function PATCH(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { accountType?: string };
  try {
    body = (await request.json()) as { accountType?: string };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const requested = normalizeAccountType(body.accountType);
  if (!SETTABLE.includes(requested)) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "نوع حساب انتخابی معتبر نیست. برای حساب وکیل از مسیر درخواست وکالت استفاده کنید.",
      },
      { status: 400 }
    );
  }

  const updated = setPlatformAccountType(auth.ctx.userId, requested);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "کاربر یافت نشد" }, { status: 404 });
  }

  const user = findUserById(auth.ctx.userId)!;
  return NextResponse.json({
    data: {
      platformAccountType: requested,
      accountType: user.accountType ?? "individual",
      accountTypeLocked: (user.accountType ?? "individual") === "legal",
    },
  });
}
