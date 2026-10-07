// ============================================================
// LEGALIR — /api/v1/admin/plans/[code]
// ============================================================
// GET   — the plan template plus its edit history.
// PATCH — edit a plan's numbers/spec/status. Every changed field is written
//         to the plan audit trail in the same pass. Super-admin only
//         (`admin:system:manage`), enforced server-side.
//
// Editing a plan does NOT retroactively change live subscriptions: each
// subscription carries a frozen `plan_snapshot` taken at purchase time.
// A plan with purchase history is never hard-deleted — it is deactivated or
// archived instead.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta } from "@/lib/admin/http";
import {
  getPlanByCode,
  readPlanAudit,
  updatePlanWithAudit,
} from "@/lib/usage/plans";
import type { PlanCode, PlanStatus, SubscriptionPlan } from "@legalir/types";

const EDITABLE_FIELDS = [
  "nameFa",
  "shortDescriptionFa",
  "descriptionFa",
  "status",
  "displayOrder",
  "tags",
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

const PLAN_STATUSES: PlanStatus[] = ["draft", "active", "inactive", "archived"];

const NUMERIC_FIELDS = [
  "durationDays",
  "activityCostPoints",
  "dailyRequestLimit",
  "tokenLimit",
  "aiMessageLimit",
  "documentAnalysisLimit",
  "contractDraftLimit",
  "contractCreationLimit",
  "listPrice",
  "salePrice",
  "displayOrder",
] as const;

const POSITIVE_FIELDS = new Set(["durationDays", "activityCostPoints"]);

/** Validate the incoming field set against the plan rules. Persian errors. */
function validate(
  updates: Record<string, unknown>,
  before: SubscriptionPlan
): string | null {
  for (const key of NUMERIC_FIELDS) {
    if (!(key in updates)) continue;
    const v = updates[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return "INVALID_LIMIT";
    if (!Number.isInteger(v) || v < 0) return "INVALID_LIMIT";
    if (POSITIVE_FIELDS.has(key) && v <= 0) {
      return key === "durationDays" ? "INVALID_DURATION" : "INVALID_ACTIVITY_COST";
    }
  }
  // Prices are non-negative integers, and sale may not exceed list.
  const list = "listPrice" in updates ? (updates["listPrice"] as number) : before.listPrice;
  const sale = "salePrice" in updates ? (updates["salePrice"] as number) : before.salePrice;
  if (typeof list !== "number" || !Number.isInteger(list) || list < 0) return "INVALID_PRICE";
  if (typeof sale !== "number" || !Number.isInteger(sale) || sale < 0) return "INVALID_PRICE";
  if (sale > list) return "SALE_ABOVE_LIST";
  if ("status" in updates && !PLAN_STATUSES.includes(updates["status"] as PlanStatus)) {
    return "INVALID_STATUS";
  }
  if ("features" in updates && !Array.isArray(updates["features"])) return "INVALID_BODY";
  if ("tags" in updates && !Array.isArray(updates["tags"])) return "INVALID_BODY";
  return null;
}

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
      plan: { ...plan, status: plan.status ?? (plan.isActive ? "active" : "inactive") },
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
  const before = getPlanByCode(code);
  if (!before) {
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

  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { code: "NO_CHANGES", message: "هیچ تغییری ارسال نشده است" },
      { status: 400 }
    );
  }

  const invalid = validate(updates, before);
  if (invalid) {
    const msg: Record<string, string> = {
      INVALID_DURATION: "مدت اشتراک باید عددی مثبت و بزرگ‌تر از صفر باشد",
      INVALID_ACTIVITY_COST: "هزینهٔ هر فعالیت باید عددی مثبت باشد",
      INVALID_LIMIT: "سقف‌ها باید عدد صحیح و نامنفی باشند",
      INVALID_PRICE: "قیمت باید عدد صحیح و نامنفی (تومان) باشد",
      SALE_ABOVE_LIST: "قیمت فروش نمی‌تواند از قیمت فهرست بیشتر باشد",
      INVALID_STATUS: "وضعیت پلن نامعتبر است",
      INVALID_BODY: "بدنه درخواست نامعتبر است",
    };
    return NextResponse.json(
      { code: invalid, message: msg[invalid] ?? "درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const updated = updatePlanWithAudit(
    code as PlanCode,
    updates as Partial<Omit<SubscriptionPlan, "id" | "code" | "createdAt">>,
    auth.ctx.userId
  );
  if (!updated) {
    return NextResponse.json(
      { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد" },
      { status: 404 }
    );
  }

  // Mirror the edit into the general admin audit trail with a semantic action
  // so an operator scanning the audit log sees publish/deactivate/price events.
  const meta = requestMeta(request);
  const priceChanged = "listPrice" in updates || "salePrice" in updates;
  const featuresChanged = "features" in updates;
  const prevStatus = before.status ?? (before.isActive ? "active" : "inactive");
  const statusChanged = "status" in updates && updates["status"] !== prevStatus;
  const auditAction = statusChanged
    ? updates["status"] === "active"
      ? "plan.publish"
      : updates["status"] === "archived"
        ? "plan.archive"
        : "plan.deactivate"
    : priceChanged
      ? "plan.price.change"
      : featuresChanged
        ? "plan.features.change"
        : "plan.update";
  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: auditAction,
    resourceType: "plan",
    resourceId: code,
    after: {
      ...(priceChanged ? { listPrice: updated.listPrice, salePrice: updated.salePrice } : {}),
      ...(statusChanged
        ? { status: updated.status ?? (updated.isActive ? "active" : "inactive") }
        : {}),
      fields: Object.keys(updates),
    },
    ...meta,
  });

  return NextResponse.json({
    data: { ...updated, status: updated.status ?? (updated.isActive ? "active" : "inactive") },
  });
}
