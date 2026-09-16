// ============================================================
// LEGALIR — POST /api/v1/contracts/[id]/generate
// ============================================================
// "Generates" a deterministic draft contract version from the persisted
// answers and marks the contract as generated.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { generateDemoContract, getDemoContract } from "@/lib/demo-seed";
import { recordActivity, consumeDailyRequest, queryDailyQuota, spendEnergy } from "@/lib/db";

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

  // Enforce the day's allowance before generating.
  const quota = queryDailyQuota(userId);
  if (quota.exhausted) {
    return NextResponse.json(
      {
        code: "QUOTA_EXHAUSTED",
        message: "سهمیه درخواست امروز شما به پایان رسیده است.",
        quota,
      },
      { status: 429 }
    );
  }

  const result = generateDemoContract(userId, id);
  if (!result) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "قرارداد یافت نشد" },
      { status: 404 }
    );
  }

  consumeDailyRequest(userId);

  // Deduct the per-request energy cost (idempotent per contract).
  spendEnergy({
    userId,
    sourceType: "contract",
    sourceId: id,
    description: "کسر انرژی بابت تولید قرارداد",
  });

  const contract = getDemoContract(userId, id);
  recordActivity({
    userId,
    type: "contract",
    title: contract?.title ?? "قرارداد",
    status: "generated",
    statusFa: "تولید شده",
    description: "تولید پیش‌نویس قرارداد",
    category: contract?.category ?? null,
    categoryFa: null,
    sourceId: id,
  });

  return NextResponse.json({ data: result });
}
