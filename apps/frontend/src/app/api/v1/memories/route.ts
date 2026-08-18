// ============================================================
// LEGALIR — GET /api/v1/memories (demo dataset)
// ============================================================
// Returns the seeded «حافظه» items plus the memory-enabled flag,
// matching V1MemoryListResponse. memoryEnabled derives from the
// user's privacy preference (storeConversationHistory).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getPreferences } from "@/lib/db";
import { listDemoMemories } from "@/lib/demo-seed";

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
