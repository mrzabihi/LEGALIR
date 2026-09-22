// ============================================================
// LEGALIR — GET /api/v1/onboarding
// ============================================================
// Returns the SERVER-DRIVEN onboarding decision for the current user.
// The client routes on `nextStep`; it never guesses from a query string.
// Authorization: the user id comes from the session, never the request.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { resolveOnboarding } from "@/lib/onboarding";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const state = resolveOnboarding(auth.ctx.userId);
  if (!state) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: state });
}
