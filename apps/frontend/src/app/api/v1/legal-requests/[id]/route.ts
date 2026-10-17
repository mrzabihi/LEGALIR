// ============================================================
// LEGALIR — GET / PATCH /api/v1/legal-requests/[id]
// ============================================================
// GET   — the full consultation case room: the request, its transition
//         history, the assigned lawyer, the message thread and attachment
//         metadata. Readable by the owner AND the assigned lawyer — anyone
//         else gets 404 (not 403), so a foreign request is indistinguishable
//         from a missing one (no IDOR/BOLA enumeration).
// PATCH — the OWNER’s in-place edit of their own DRAFT request: the title,
//         category, intake answers, attachments, and the path-discovery
//         record. Restricted to the owner and to the DRAFT state, so a
//         submitted request can never be silently rewritten by a client.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getRequestById, updateRequest } from "@/lib/legal-request-db";
import { buildConsultationDetail, canViewConsultation } from "@/lib/consultation-detail";
import { isSupportedCategory } from "@/lib/intake-schemas";
import { discoveryRecordSchema } from "@/lib/intake/discovery";
import { getDemoDocument } from "@/lib/demo-seed";
import type { LegalRequest } from "@legalir/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row || !canViewConsultation(row, auth.ctx.userId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({
    data: buildConsultationDetail(row, auth.ctx.userId),
  });
}

/**
 * The whitelist of fields a client may patch on a DRAFT. Anything else is
 * ignored, so a client can never flip `state`, reassign `selectedLawyerId`,
 * or move `userId` through this route.
 */
interface DraftPatchBody {
  title?: string;
  category?: string;
  intakeAnswers?: Record<string, string>;
  attachmentDocumentIds?: string[];
  discovery?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  // A foreign or missing request is indistinguishable (404, never 403).
  if (!row || row.userId !== auth.ctx.userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }
  // Only a DRAFT is freely editable; once it moves on, the client must use
  // the state-machine routes instead of silent field rewrites.
  if (row.state !== "DRAFT") {
    return NextResponse.json(
      {
        code: "INVALID_STATE",
        message: "این درخواست دیگر پیش‌نویس نیست و از این مسیر قابل ویرایش نیست",
      },
      { status: 409 }
    );
  }

  let raw: DraftPatchBody;
  try {
    raw = (await request.json()) as DraftPatchBody;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const patch: Partial<Omit<LegalRequest, "id" | "userId" | "createdAt">> = {};

  if (typeof raw.title === "string") {
    const title = raw.title.trim();
    if (title) patch.title = title.slice(0, 200);
  }
  if (typeof raw.category === "string") {
    if (!isSupportedCategory(raw.category)) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "دسته‌بندی معتبر نیست" },
        { status: 400 }
      );
    }
    patch.category = raw.category;
  }
  if (raw.intakeAnswers && typeof raw.intakeAnswers === "object") {
    const entries = Object.entries(raw.intakeAnswers)
      .filter(([k, v]) => typeof k === "string" && typeof v === "string")
      .slice(0, 40)
      .map(([k, v]) => [k.slice(0, 80), String(v).slice(0, 2000)] as const);
    patch.intakeAnswers = Object.fromEntries(entries);
  }
  if (Array.isArray(raw.attachmentDocumentIds)) {
    // Only documents the CALLER actually owns may be attached, so a client
    // cannot bind another user's document id to their own request.
    const owned = raw.attachmentDocumentIds
      .filter((docId): docId is string => typeof docId === "string")
      .filter((docId) => Boolean(getDemoDocument(auth.ctx.userId, docId)));
    patch.attachmentDocumentIds = owned;
  }
  if (raw.discovery !== undefined) {
    const parsed = discoveryRecordSchema.safeParse(raw.discovery);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "ساختار تحلیل مسیر نامعتبر است" },
        { status: 400 }
      );
    }
    patch.discovery = parsed.data;
  }

  const updated = updateRequest(id, patch);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
