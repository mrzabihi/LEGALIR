// ============================================================
// LEGALIR — POST /api/v1/contracts/[id]/generate
// ============================================================
// "Generates" a deterministic draft contract version from the persisted
// answers and marks the contract as generated.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { generateDemoContract, getDemoContract } from "@/lib/demo-seed";
import { recordActivity } from "@/lib/db";
import { reserveUsage, completeUsage, getUsageSummary } from "@/lib/usage/engine";

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

  // Reserve the activity's cost atomically before generating. This checks
  // BOTH the daily request credit AND the period contract-creation quota.
  const reservation = reserveUsage({
    userId,
    activity: "CONTRACT_CREATE",
    source: "contract",
    relatedEntityId: id,
    idempotencyKey: `contract:${id}`,
  });
  if (!reservation.ok) {
    return NextResponse.json(
      {
        code: reservation.code ?? "QUOTA_EXHAUSTED",
        message: reservation.messageFa || "سهمیه شما به پایان رسیده است.",
        usage: getUsageSummary(userId),
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

  // The generation succeeded — commit the reservation.
  if (reservation.transaction) completeUsage(reservation.transaction.id);

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
