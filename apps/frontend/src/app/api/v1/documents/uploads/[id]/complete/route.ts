// ============================================================
// LEGALIR — POST /api/v1/documents/uploads/:id/complete (demo dataset)
// ============================================================
// Completes a document upload: marks the pending row as "ready"
// and returns the V1DocumentListItem for the created document.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { updateDemoDocumentStatus, getDemoDocument, setDemoDocumentStorageKey } from "@/lib/demo-seed";
import type { listDemoDocuments } from "@/lib/demo-seed";
import { saveDocumentFile } from "@/lib/document-storage";
import { recordActivity } from "@/lib/db";
import { MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";
import type { RiskLevel, V1DocumentListItem } from "@legalir/types";

function overallRisk(severities: RiskLevel[]): RiskLevel {
  if (severities.includes("critical")) return "critical";
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}

function toListItem(doc: ReturnType<typeof listDemoDocuments>[number]): V1DocumentListItem {
  const severities = (doc.report?.findings ?? []).map((f) => f.severity);
  return {
    id: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    riskLevel: doc.report ? overallRisk(severities) : null,
    findingCount: doc.report?.findings.length ?? 0,
  };
}

export async function POST(
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

  // The pending row must exist and belong to this user before we accept
  // any bytes for it.
  const pending = getDemoDocument(userId, id);
  if (!pending) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  // Persist the uploaded bytes so the preview/file/download routes can
  // serve them. Without this the row keeps `storageKey: null` and every
  // preview reports "file unavailable".
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "فایل ارسال نشده است" },
      { status: 400 }
    );
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json(
      { code: "FILE_TOO_LARGE", message: "حجم فایل بیش از حد مجاز است", retryable: false },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = saveDocumentFile(id, pending.name, bytes);
  setDemoDocumentStorageKey(userId, id, storageKey);

  // Mark the pending document as ready (analysis simulated client-side).
  const doc = updateDemoDocumentStatus(userId, id, "ready");
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  const findingCount = doc.report?.findings.length ?? 0;
  recordActivity({
    userId,
    type: "document",
    title: doc.name,
    status: "ready",
    statusFa: "آماده",
    description: findingCount > 0 ? `تحلیل سند — ${findingCount} یافته شناسایی شد` : "تحلیل سند",
    category: null,
    categoryFa: null,
    sourceId: doc.id,
  });

  return NextResponse.json({ data: toListItem(doc) });
}
