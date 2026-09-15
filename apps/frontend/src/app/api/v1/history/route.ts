// ============================================================
// LEGALIR — GET /api/v1/history
// ============================================================
// Returns the user's full history: every conversation they created
// (grouped by the category they chose) merged with other recorded
// activities (documents, contracts). Supports category, type,
// search, and sort filters. Requires a valid session cookie.
// ============================================================

import { NextResponse } from "next/server";
import {
  findSessionById,
  cleanupExpiredSessions,
  queryHistory,
  archiveActivity,
  readConversations,
  writeConversations,
} from "@/lib/db";
// Map a conversation's LegalCategory to the history category tabs.
const CATEGORY_MAP: Record<string, string> = {
  family: "family",
  contract: "contracts",
  real_estate: "real_estate",
  labor: "commerce",
  commerce: "commerce",
  criminal: "cases",
  tax: "commerce",
  companies: "commerce",
  checks: "commerce",
  immigration: "other",
  cyber: "cases",
  other: "other",
};

const CATEGORY_FA: Record<string, string> = {
  cases: "پرونده‌ها",
  contracts: "قراردادها",
  real_estate: "املاک",
  family: "خانواده",
  commerce: "تجارت",
  other: "سایر",
};

const STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  completed: "تکمیل شده",
  archived: "بایگانی شده",
  failed: "ناموفق",
};

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

    // Build conversation-derived history items (every chat the user made).
    const conversations = readConversations()
      .filter((c) => c.userId === session.userId)
      .map((c) => {
        const cat = c.category ? (CATEGORY_MAP[c.category] ?? "other") : "other";
        return {
          id: c.id,
          userId: c.userId,
          type: "conversation" as const,
          title: c.title,
          category: cat,
          categoryFa: CATEGORY_FA[cat] ?? "سایر",
          status: c.status,
          statusFa: STATUS_FA[c.status] ?? c.status,
          description: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          archived: c.status === "archived",
        };
      });

    // Merge with other recorded activities (documents, contracts, cases,
    // subscriptions). Conversations are derived above, so exclude them here.
    const activityResult = queryHistory({
      userId: session.userId,
      category,
      search,
      type,
      sort,
      page: 1,
      pageSize: 10000,
    });
    const activities = activityResult.items
      .filter((a) => a.type !== "conversation")
      .map((a) => ({
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

    let items = [...conversations, ...activities];

    // Apply filters.
    if (category && category !== "all") {
      items = items.filter((a) => a.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) => a.title.toLowerCase().includes(q) || (a.description?.toLowerCase().includes(q) ?? false)
      );
    }
    if (type && type !== "all") {
      items = items.filter((a) => a.type === type);
    }

    // Sort.
    if (sort === "oldest") items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
    else items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json(
      {
        data: {
          items: paged,
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        },
        meta: { requestId: crypto.randomUUID() },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[history] Error:", err);
    return jsonInternalError();
  }
}

/**
 * PATCH /api/v1/history — toggle the archived flag on a history item.
 * Conversations live in conversations.json; other items live in the
 * activities table. Both are persisted so the state survives reloads.
 */
export async function PATCH(request: Request) {
  try {
    const sessionId = extractCookie(request.headers.get("cookie") ?? "", "legalir-session");
    if (!sessionId) return jsonUnauthorized();
    const session = findSessionById(sessionId);
    if (!session) return jsonUnauthorized();

    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      archived?: boolean;
    };
    if (!body.id || typeof body.archived !== "boolean") {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "شناسه و وضعیت بایگانی الزامی است", fieldErrors: [], retryable: false },
        { status: 400 },
      );
    }

    // Try conversations first (chat items).
    const conversations = readConversations();
    const conv = conversations.find(
      (c) => c.id === body.id && c.userId === session.userId
    );
    if (conv) {
      conv.status = body.archived ? "archived" : "active";
      conv.updatedAt = new Date().toISOString();
      writeConversations(conversations);
      return NextResponse.json({ data: { id: conv.id, archived: body.archived } });
    }

    // Otherwise it's an activity row (document / contract / subscription).
    const updated = archiveActivity(session.userId, body.id, body.archived);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "مورد یافت نشد", fieldErrors: [], retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: { id: updated.id, archived: Boolean(updated.archived) } });
  } catch (err) {
    console.error("[history] PATCH error:", err);
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
