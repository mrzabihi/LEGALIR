// ============================================================
// LEGALIR — GET /api/v1/contracts/[id] (demo dataset)
// ============================================================
// Returns the full V1ContractDetail (versions, analysis, attachments).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoContract, updateDemoContract } from "@/lib/demo-seed";
import { recordActivity } from "@/lib/db";
import type { V1ContractState } from "@legalir/types";

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
  const contract = getDemoContract(userId, id);
  if (!contract) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "قرارداد یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: contract });
}

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

  let body: {
    title?: string;
    state?: V1ContractState;
    answers?: Record<string, string>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اطلاعات ناقص است" },
      { status: 400 }
    );
  }

  const updated = updateDemoContract(userId, id, body);
  if (!updated) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "قرارداد یافت نشد" },
      { status: 404 }
    );
  }

  recordActivity({
    userId,
    type: "contract",
    title: updated.title,
    status: updated.state,
    statusFa: "در حال ویرایش",
    description: "ویرایش قرارداد",
    category: updated.category,
    categoryFa: null,
    sourceId: id,
  });

  return NextResponse.json({ data: updated });
}
