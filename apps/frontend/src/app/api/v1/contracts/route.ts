// ============================================================
// LEGALIR — GET /api/v1/contracts (demo dataset)
// ============================================================
// Serves the seeded «قراردادهای من» demo list with search, state,
// category filters and sorting, matching V1ContractListParams.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { listDemoContracts, createDemoContract } from "@/lib/demo-seed";
import { recordActivity } from "@/lib/db";
import type { V1ContractListItem, V1ContractType } from "@legalir/types";

function toListItem(c: ReturnType<typeof listDemoContracts>[number]): V1ContractListItem {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    typeFa: c.typeFa,
    category: c.category,
    state: c.state,
    currentVersionNumber: c.currentVersionNumber,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    hasDraft: c.state === "draft",
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
  const state = url.searchParams.get("state") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const sort = url.searchParams.get("sort") ?? "newest";

  let items = listDemoContracts(userId).map(toListItem);

  if (search) {
    items = items.filter((c) => c.title.toLowerCase().includes(search));
  }
  if (state) {
    items = items.filter((c) => c.state === state);
  }
  if (category) {
    items = items.filter((c) => c.category === category);
  }
  if (sort === "oldest") {
    items = items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (sort === "title") {
    items = items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
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

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  let body: { typeId?: V1ContractType; title?: string };
  try {
    body = (await request.json()) as { typeId?: V1ContractType; title?: string };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اطلاعات ناقص است" },
      { status: 400 }
    );
  }

  if (!body.typeId || !body.title || !body.title.trim()) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نوع قرارداد و عنوان الزامی است" },
      { status: 400 }
    );
  }

  const created = createDemoContract(userId, body.typeId, body.title.trim());

  recordActivity({
    userId,
    type: "contract",
    title: created.title,
    status: created.state,
    statusFa: "پیش‌نویس",
    description: `ایجاد ${created.typeFa}`,
    category: created.category,
    categoryFa: null,
    sourceId: created.id,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
