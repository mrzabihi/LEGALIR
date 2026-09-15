// ============================================================
// LEGALIR — GET /api/v1/memories (demo dataset)
// ============================================================
// Returns the seeded «حافظه» items plus the memory-enabled flag,
// matching V1MemoryListResponse. memoryEnabled derives from the
// user's privacy preference (storeConversationHistory).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getPreferences, recordActivity } from "@/lib/db";
import { listDemoMemories, createDemoMemory } from "@/lib/demo-seed";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const items = listDemoMemories(userId).filter((m) => m.status !== "deleted");
  const prefs = getPreferences(userId);
  const memoryEnabled = prefs.privacy.storeConversationHistory;

  return NextResponse.json({ data: { items, memoryEnabled } });
}

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  let body: { key?: string; value?: string; category?: "profile" | "preference" | "legal_context" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اطلاعات ناقص است" },
      { status: 400 }
    );
  }

  if (!body.key?.trim() || !body.value?.trim()) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "کلید و مقدار الزامی است" },
      { status: 400 }
    );
  }

  const item = createDemoMemory(userId, {
    key: body.key,
    value: body.value,
    category: body.category,
  });

  recordActivity({
    userId,
    type: "document",
    title: `دانش: ${item.key}`,
    status: "ready",
    statusFa: "ذخیره شد",
    description: item.value.slice(0, 160),
    category: null,
    categoryFa: null,
    sourceId: item.id,
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
