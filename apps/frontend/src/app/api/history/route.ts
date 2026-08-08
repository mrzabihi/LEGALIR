// ============================================================
// LEGALIR — GET /api/history
// ============================================================
// Returns service history with category, type, search, and sort filters.
// Requires a valid session cookie.
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById, cleanupExpiredSessions, queryHistory } from "@/lib/db";

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

    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "newest";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

    const result = queryHistory({
      userId: session.userId,
      category,
      search,
      type,
      sort,
      page,
      pageSize,
    });

    // Map to API response shape
    const items = result.items.map((a) => ({
      id: a.id,
      userId: a.user_id,
      type: a.type,
      title: a.title,
      category: a.category,
      categoryFa: a.category_fa,
      status: a.status,
      statusFa: a.status_fa,
      description: a.description,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      archived: Boolean(a.archived),
    }));

    return NextResponse.json(
      {
        data: { items, pagination: result.pagination },
        meta: { requestId: crypto.randomUUID() },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[history] Error:", err);
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
