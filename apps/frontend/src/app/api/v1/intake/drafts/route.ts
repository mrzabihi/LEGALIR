// ============================================================
// LEGALIR — /api/v1/intake/drafts
// ============================================================
// GET  — list the caller's in-flight intake drafts (resume list).
// POST — start a new draft against the current schema version.
//
// Authorization: the user id always comes from the session, never the
// body. A draft is only ever readable/writable by its owner.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listDraftsForUser, createDraft } from "@/lib/intake-db";
import { buildIntakeSchema, isSupportedCategory } from "@/lib/intake-schemas";
import type { IntakeDraft } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: listDraftsForUser(auth.ctx.userId) });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { category?: string };
  try {
    body = (await request.json()) as { category?: string };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.category || !isSupportedCategory(body.category)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "دسته‌بندی حقوقی معتبر نیست" },
      { status: 400 }
    );
  }

  const schema = buildIntakeSchema(body.category);
  const now = new Date().toISOString();
  const draft: IntakeDraft = {
    id: generateId(),
    userId: auth.ctx.userId,
    category: body.category,
    schemaVersion: schema.version,
    currentStep: 0,
    answers: {},
    savedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ data: createDraft(draft) }, { status: 201 });
}
