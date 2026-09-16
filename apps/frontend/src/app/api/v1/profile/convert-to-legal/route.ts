import { NextResponse } from "next/server";
import { convertAccountToLegal, getAccountType } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * POST /api/v1/profile/convert-to-legal
 *
 * One-way account-type transition: individual → legal. A `legal` account
 * can never be converted back. The rule is enforced here (backend), not
 * only in the UI — a direct API call from a legal account is rejected.
 */
export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const result = convertAccountToLegal(userId);

  if (!result.ok) {
    if (result.reason === "already_legal") {
      return NextResponse.json(
        {
          code: "ACCOUNT_TYPE_LOCKED",
          message: "حساب شما حقوقی است و امکان بازگشت به حساب شخصی وجود ندارد",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { code: "NOT_FOUND", message: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { accountType: getAccountType(userId), accountTypeLocked: true },
  });
}
