// ============================================================
// LEGALIR — POST /api/v1/history/[id]/edit
// ============================================================
// "Edit" a COMPLETED history item: build a brand-new process from the
// item's editable input, preserving the original result untouched. The
// new process gets its own id and a `source_item_id` link back to the
// source; the previous OUTPUT (messages, generated versions, Done
// status) is deliberately NOT copied.
//
// Only completed items can be edited — a draft is continued in place,
// not forked. The owner check is enforced here, not just in the UI.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { resolveHistoryItem, createEditedProcess } from "@/lib/history/purge";
import { classifyStatus, canEdit } from "@/lib/history/actions";
import type { V1HistoryItem } from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) return jsonUnauthorized();

    const { id } = await params;
    const item = resolveHistoryItem(userId, id);
    if (!item) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "مورد یافت نشد", fieldErrors: [], retryable: false },
        { status: 404 },
      );
    }

    // Only a completed item can seed a new process. A draft is continued
    // in place; a processing/failed item has no finished result to fork.
    const probe = {
      type: item.kind,
      status: item.activity?.status ?? item.conversation?.status ?? "",
    } as Pick<V1HistoryItem, "type" | "status">;
    if (classifyStatus(probe) !== "completed" || !canEdit(probe)) {
      return NextResponse.json(
        {
          code: "NOT_EDITABLE",
          message: "فقط موارد تکمیل‌شده را می‌توان به فرایند جدید تبدیل کرد",
          fieldErrors: [],
          retryable: false,
        },
        { status: 409 },
      );
    }

    const result = createEditedProcess(userId, item);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("[history] edit error:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "خطای داخلی سرور. لطفاً دوباره تلاش کنید",
        fieldErrors: [],
        retryable: true,
        correlationId: crypto.randomUUID(),
      },
      { status: 500 },
    );
  }
}

function jsonUnauthorized() {
  return NextResponse.json(
    { code: "UNAUTHORIZED", message: "نیاز به ورود مجدد", fieldErrors: [], retryable: false },
    { status: 401 },
  );
}
