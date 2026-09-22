// ============================================================
// LEGALIR — DELETE /api/v1/account
// ============================================================
// Permanently deletes the authenticated user and all of their data.
// The user id comes from the session — a caller can only ever delete
// their own account. The session cookie is cleared on success.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { deleteAccount } from "@/lib/account-deletion";

export async function DELETE(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const result = deleteAccount(userId);
  if (!result.ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  const response = NextResponse.json({ data: { deleted: true } });
  // Clear the session cookie so the browser cannot reuse it.
  response.cookies.set("legalir-session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
