// ============================================================
// LEGALIR — GET /api/subscription/history
// ============================================================
// Returns payment/subscription history for the authenticated user.
// Requires a valid session cookie.
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById, cleanupExpiredSessions, querySubscriptionHistory } from "@/lib/db";

export async function GET(request: Request) {
  try {
    cleanupExpiredSessions();

    const sessionId = extractCookie(request.headers.get("cookie") ?? "", "legalir-session");
    if (!sessionId) {
      return jsonUnauthorized();
    }

    const session = findSessionById(sessionId);
    if (!session) {
      return jsonUnauthorized();
    }

    const items = querySubscriptionHistory(session.userId);

    return NextResponse.json(
      {
        data: {
          items,
          pagination: {
            page: 1,
            pageSize: 20,
            total: items.length,
            totalPages: 1,
          },
        },
        meta: { requestId: crypto.randomUUID() },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[subscription/history] Error:", err);
    return jsonInternalError();
  }
}

function jsonUnauthorized() {
  return NextResponse.json(
    { code: "UNAUTHORIZED", message: "نیاز به ورود مجدد", fieldErrors: [], retryable: false },
    { status: 401 },
  );
}

function jsonInternalError() {
  return NextResponse.json(
    { code: "INTERNAL_ERROR", message: "خطای داخلی سرور. لطفاً دوباره تلاش کنید", fieldErrors: [], retryable: true, correlationId: crypto.randomUUID() },
    { status: 500 },
  );
}

function extractCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  if (!match) return null;
  return match.slice(name.length + 1) || null;
}
