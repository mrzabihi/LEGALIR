// ============================================================
// LEGALIR — /api/v1/admin/plans/[code]
// ============================================================
// GET   — the plan template plus its edit history.
// PATCH — edit a plan's numbers. Every changed field is written to the
//         plan audit trail in the same pass. Staff-only
//         (`admin:system:manage`).
//
// Editing a plan does NOT retroactively change live subscriptions: each
// subscription carries a frozen `plan_snapshot` taken at purchase time.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import {
  getPlanByCode,
  readPlanAudit,
  updatePlanWithAudit,
} from "@/lib/usage/plans";
import type { PlanCode, SubscriptionPlan } from "@legalir/types";

const EDITABLE_FIELDS = [
  "nameFa",
  "descriptionFa",
  "durationDays",
  "activityCostPoints",
  "dailyRequestLimit",
  "tokenLimit",
  "aiMessageLimit",
  "documentAnalysisLimit",
  "contractDraftLimit",
  "contractCreationLimit",
  "contractCreationUnlimited",
  "listPrice",
  "salePrice",
  "features",
  "isActive",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = requirePermission(request, "admin:system:manage");
  if (!auth.ok) return auth.response;

  const { code } = await params;
  const plan = getPlanByCode(code);
  if (!plan) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      plan,
      audit: readPlanAudit().filter((a) => a.planCode === code),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = requirePermission(request, "admin:system:manage");
  if (!auth.ok) return auth.response;

  const { code } = await params;
  if (!getPlanByCode(code)) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد" },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const updates: Partial<Omit<SubscriptionPlan, "id" | "code" | "createdAt">> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (updates as Record<string, unknown>)[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { code: "NO_CHANGES", message: "هیچ تغییری ارسال نشده است" },
      { status: 400 }
    );
  }

  const updated = updatePlanWithAudit(code as PlanCode, updates, auth.ctx.userId);
  if (!updated) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: updated });
}
