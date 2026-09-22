// ============================================================
// LEGALIR — /api/v1/legal-requests
// ============================================================
// GET  — list the caller's legal requests.
// POST — create a request in DRAFT state.
//
// Authorization: the user id comes from the session. A request is only
// ever listed/created for its owner.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listRequestsForUser, createRequest } from "@/lib/legal-request-db";
import { isSupportedCategory } from "@/lib/intake-schemas";
import type { LegalRequest } from "@legalir/types";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: listRequestsForUser(auth.ctx.userId) });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { title?: string; category?: string; intakeAnswers?: Record<string, string> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.title?.trim() || !body.category || !isSupportedCategory(body.category)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "عنوان و دسته‌بندی معتبر الزامی است" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const row: LegalRequest = {
    id: crypto.randomUUID(),
    userId: auth.ctx.userId,
    caseId: null,
    conversationId: null,
    title: body.title.trim(),
    category: body.category,
    state: "DRAFT",
    intakeAnswers: body.intakeAnswers ?? {},
    analysisId: null,
    selectedLawyerId: null,
    orgId: auth.ctx.orgId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ data: createRequest(row) }, { status: 201 });
}
