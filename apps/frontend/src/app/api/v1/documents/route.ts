// ============================================================
// LEGALIR — GET /api/v1/documents (demo dataset)
// ============================================================
// Serves the seeded «اسناد من» demo list from the JSON DB.
// Supports search, status filter and sorting, matching the
// V1DocumentListParams contract consumed by the frontend.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { listDemoDocuments } from "@/lib/demo-seed";
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

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const sort = url.searchParams.get("sort") ?? "newest";

  let items = listDemoDocuments(userId).map(toListItem);

  if (search) {
    items = items.filter((d) => d.name.toLowerCase().includes(search));
  }
  if (status && status !== "all") {
    items = items.filter((d) => d.status === status);
  }
  if (sort === "oldest") {
    items = items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (sort === "name") {
    items = items.sort((a, b) => a.name.localeCompare(b.name, "fa"));
  } else {
    items = items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({
    data: {
      items: paged,
      pagination: { page, pageSize, total, totalPages },
    },
  });
}
