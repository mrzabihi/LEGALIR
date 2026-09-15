// ============================================================
// LEGALIR — POST /api/v1/documents/uploads/:id/complete (demo dataset)
// ============================================================
// Completes a document upload: marks the pending row as "ready"
// and returns the V1DocumentListItem for the created document.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { updateDemoDocumentStatus, listDemoDocuments } from "@/lib/demo-seed";
import { recordActivity } from "@/lib/db";
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
