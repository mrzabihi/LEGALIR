// ============================================================
// LEGALIR — GET /api/v1/conversations/[id]/references
// ============================================================
// Returns the persisted V1Reference[] for a conversation by flattening
// the `references` attached to each assistant message in the AI store.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getMessages } from "@/lib/ai/store";
import type { V1Reference } from "@legalir/types";

export async function GET(
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

  const messages = getMessages(id);
  const references: V1Reference[] = messages.flatMap((m) =>
    Array.isArray(m.references) ? (m.references as V1Reference[]) : []
  );

  return NextResponse.json({ data: references });
}
