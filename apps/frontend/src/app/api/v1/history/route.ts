// ============================================================
// LEGALIR — /api/v1/history
// ============================================================
// The single owner-scoped surface for the history section:
//
//   GET    — list the ACTIVE history, or the ARCHIVE view when
//            `?archived=true`. Also returns the archived count (for the
//            header badge) and the retention limits (so the UI can
//            explain them). Runs the retention sweep opportunistically
//            so the 100-item / 31-day rule holds even between job ticks.
//   PATCH  — archive / restore one item (conversation or activity row).
//   DELETE — permanently remove one item and the data private to it.
//
// Every operation resolves the user from the session cookie and scopes
// the lookup to that user, so a foreign id can never be read or mutated.
// ============================================================

import { NextResponse } from "next/server";
import {
  queryHistory,
  archiveActivity,
  archiveConversation,
  readConversations,
  type ActivityRow,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { enforceRetentionForUser, RETENTION_MAX_ITEMS, RETENTION_MAX_AGE_DAYS } from "@/lib/history/retention";
import { purgeHistoryItem } from "@/lib/history/purge";
import type { V1HistoryItem } from "@legalir/types";

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
    const userId = getUserIdFromRequest(request);
    if (!userId) return jsonUnauthorized();

    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "newest";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);
    const archivedView = url.searchParams.get("archived") === "true";

    // Enforce the retention limits before reading so the list the user
    // sees already reflects the 100-item / 31-day rule. Idempotent.
    enforceRetentionForUser(userId);

    // Conversation-derived items (every chat the user made).
    const conversations: V1HistoryItem[] = readConversations()
      .filter((c) => c.userId === userId)
      .map((c) => {
        const cat = c.category ? (CATEGORY_MAP[c.category] ?? "other") : "other";
        const archived = Boolean(c.archivedAt) || c.status === "archived";
        return {
          id: c.id,
          userId: c.userId,
          type: "conversation" as const,
          title: c.title,
          category: cat as V1HistoryItem["category"],
          categoryFa: CATEGORY_FA[cat] ?? "سایر",
          status: c.status,
          statusFa: STATUS_FA[c.status] ?? c.status,
          description: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          archived,
          archivedAt: c.archivedAt ?? null,
          retentionStartedAt: c.retentionStartedAt ?? c.createdAt,
          sourceItemId: c.sourceItemId ?? null,
        };
      });

    // Other recorded activities (documents, contracts, cases,
    // subscriptions). Conversations are derived above, so exclude them.
    const activityResult = queryHistory({
      userId,
      category,
      search,
      type,
      sort,
      page: 1,
      pageSize: 10000,
    });
    const activities: V1HistoryItem[] = activityResult.items
      .filter((a) => a.type !== "conversation")
      .map((a) => ({
        id: a.id,
        userId: a.user_id,
        type: a.type as V1HistoryItem["type"],
        title: a.title,
        category: a.category as V1HistoryItem["category"],
        categoryFa: a.category_fa,
        status: a.status,
        statusFa: a.status_fa,
        description: a.description,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        archived: Boolean(a.archived),
        archivedAt: a.archived_at ?? null,
        retentionStartedAt: a.retention_started_at ?? a.created_at,
        sourceItemId: a.source_item_id ?? null,
      }));

    const all = [...conversations, ...activities];

    // The archive badge counts every archived item, independent of the
    // active filters (so the number never changes as the user filters).
    const archivedCount = all.filter((a) => a.archived).length;

    // Split active vs archived, then apply the remaining filters.
    let items = all.filter((a) => a.archived === archivedView);

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

    // Sort. The archive view defaults to most-recently-archived first.
    if (sort === "oldest") items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
    else if (archivedView) {
      items.sort((a, b) => (b.archivedAt ?? b.updatedAt).localeCompare(a.archivedAt ?? a.updatedAt));
    } else items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json(
      {
        data: {
          items: paged,
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
          archivedCount,
          retention: { maxItems: RETENTION_MAX_ITEMS, maxAgeDays: RETENTION_MAX_AGE_DAYS },
        },
        meta: { requestId: crypto.randomUUID() },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[history] GET error:", err);
    return jsonInternalError();
  }
}

/**
 * PATCH /api/v1/history — archive or restore one item.
 * Conversations live in conversations.json; other items live in the
 * activities table. Both are persisted so the state survives reloads.
 */
export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return jsonUnauthorized();

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
    const conv = archiveConversation(userId, body.id, body.archived);
    if (conv) {
      return NextResponse.json({
        data: { id: conv.id, archived: body.archived, archivedAt: conv.archivedAt ?? null },
      });
    }

    // Otherwise it's an activity row (document / contract / case / subscription).
    const updated = archiveActivity(userId, body.id, body.archived);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "مورد یافت نشد", fieldErrors: [], retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { id: updated.id, archived: Boolean(updated.archived), archivedAt: updated.archived_at ?? null },
    });
  } catch (err) {
    console.error("[history] PATCH error:", err);
    return jsonInternalError();
  }
}

/**
 * DELETE /api/v1/history?id=… — permanently remove one history item and
 * the data private to it. Owner-scoped: a foreign id resolves to null and
 * returns 404, so nothing is ever deleted across users.
 */
export async function DELETE(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return jsonUnauthorized();

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "شناسه مورد الزامی است", fieldErrors: [], retryable: false },
        { status: 400 },
      );
    }

    const removed = purgeHistoryItem(userId, id);
    if (!removed) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "مورد یافت نشد", fieldErrors: [], retryable: false },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: { id: removed.id, title: removed.title, kind: removed.kind } });
  } catch (err) {
    console.error("[history] DELETE error:", err);
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
