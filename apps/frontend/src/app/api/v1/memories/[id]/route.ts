// ============================================================
// LEGALIR — PATCH/DELETE /api/v1/memories/[id] (demo dataset)
// ============================================================
// PATCH updates key/value/status; DELETE soft-deletes (status →
// "deleted"). Matches V1MemoryUpdateRequest / V1DocumentDeleteResponse.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { updateDemoMemory, deleteDemoMemory } from "@/lib/demo-seed";
import type { V1MemoryUpdateRequest } from "@legalir/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = (await request.json()) as V1MemoryUpdateRequest;
  const updated = updateDemoMemory(userId, id, body);
  if (!updated) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "حافظه یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const ok = deleteDemoMemory(userId, id);
  if (!ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "حافظه یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { deleted: true as const } });
}
