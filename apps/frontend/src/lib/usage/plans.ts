// ============================================================
// LEGALIR — Subscription Plan Catalog (config-driven)
// ============================================================
// The plan catalog is the SINGLE SOURCE OF TRUTH for every plan number:
// daily requests, activity cost, token / AI-message / document / contract
// quotas, price and duration. The pricing page, the dashboard, the
// entitlement engine and the checkout flow all read from here — never
// from a hard-coded copy.
//
// The rows live in the `subscription_plans` table so an admin can edit
// them at runtime. On first read the table is seeded from the defaults
// below (the current business rules).
//
//   SILVER   50 req/day  →  5,000 daily points   3.0M tokens  3,000 msgs   5 docs   3 contracts
//   GOLD    150 req/day  → 15,000 daily points   4.5M tokens  4,500 msgs  15 docs  10 contracts
//   DIAMOND 300 req/day  → 30,000 daily points   9.0M tokens  9,000 msgs  50 docs  30 contracts
//
// Duration is 31 days for every plan. Daily points are DERIVED:
//   dailyPoints = dailyRequestLimit × activityCostPoints
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { BASE_ACTIVITY_COST } from "./activities";
import { computeDiscountPercent } from "./plan-pricing";
import type {
  PlanAuditEntry,
  PlanCode,
  PlanEntitlementSnapshot,
  PlanStatus,
  SubscriptionPlan,
} from "@legalir/types";

const TABLE = "subscription_plans";
const AUDIT_TABLE = "plan_audit";

/** Subscription duration for every plan (business rule). */
export const PLAN_DURATION_DAYS = 31;

/** The seeded defaults — the current business rules, as data. */
const DEFAULT_PLANS: Omit<SubscriptionPlan, "createdAt" | "updatedAt">[] = [
  {
    id: "plan-silver",
    code: "silver",
    nameFa: "نقره",
    descriptionFa: "مناسب استفاده شخصی",
    durationDays: PLAN_DURATION_DAYS,
    activityCostPoints: BASE_ACTIVITY_COST,
    dailyRequestLimit: 50,
    tokenLimit: 3_000_000,
    aiMessageLimit: 3_000,
    documentAnalysisLimit: 5,
    contractDraftLimit: 3,
    contractCreationLimit: 3,
    contractCreationUnlimited: false,
    listPrice: 5_000_000,
    salePrice: 2_500_000,
    currency: "IRT",
    features: [
      "۵۰ درخواست روزانه",
      "۳٬۰۰۰٬۰۰۰ توکن",
      "۳٬۰۰۰ پیام هوش مصنوعی",
      "۵ تحلیل سند",
      "۳ قرارداد",
      "مدت ۳۱ روزه",
    ],
    isActive: true,
  },
  {
    id: "plan-gold",
    code: "gold",
    nameFa: "طلا",
    descriptionFa: "مناسب کسب‌وکارها و نیازهای حقوقی منظم",
    durationDays: PLAN_DURATION_DAYS,
    activityCostPoints: BASE_ACTIVITY_COST,
    dailyRequestLimit: 150,
    tokenLimit: 4_500_000,
    aiMessageLimit: 4_500,
    documentAnalysisLimit: 15,
    contractDraftLimit: 10,
    contractCreationLimit: 10,
    contractCreationUnlimited: false,
    listPrice: 7_000_000,
    salePrice: 3_500_000,
    currency: "IRT",
    features: [
      "۱۵۰ درخواست روزانه",
      "۴٬۵۰۰٬۰۰۰ توکن",
      "۴٬۵۰۰ پیام هوش مصنوعی",
      "۱۵ تحلیل سند",
      "۱۰ قرارداد",
      "مدت ۳۱ روزه",
    ],
    isActive: true,
  },
  {
    id: "plan-diamond",
    code: "diamond",
    nameFa: "الماس",
    descriptionFa: "مناسب وکلا، مؤسسات حقوقی و استفاده حرفه‌ای",
    durationDays: PLAN_DURATION_DAYS,
    activityCostPoints: BASE_ACTIVITY_COST,
    dailyRequestLimit: 300,
    tokenLimit: 9_000_000,
    aiMessageLimit: 9_000,
    documentAnalysisLimit: 50,
    contractDraftLimit: 30,
    contractCreationLimit: 30,
    contractCreationUnlimited: false,
    listPrice: 10_000_000,
    salePrice: 4_860_000,
    currency: "IRT",
    features: [
      "۳۰۰ درخواست روزانه",
      "۹٬۰۰۰٬۰۰۰ توکن",
      "۹٬۰۰۰ پیام هوش مصنوعی",
      "۵۰ تحلیل سند",
      "۳۰ قرارداد",
      "مدت ۳۱ روزه",
    ],
    isActive: true,
  },
];

/** Read the catalog, seeding the defaults on first access. */
export function readPlans(): SubscriptionPlan[] {
  const rows = readTable<SubscriptionPlan>(TABLE);
  if (rows.length > 0) return rows;
  const now = new Date().toISOString();
  const seeded: SubscriptionPlan[] = DEFAULT_PLANS.map((p, i) => ({
    ...p,
    status: "active",
    displayOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
  writeTable(TABLE, seeded);
  return seeded;
}

export function getPlanByCode(code: string): SubscriptionPlan | undefined {
  return readPlans().find((p) => p.code === code);
}

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return readPlans().find((p) => p.id === id);
}

/** A plan's effective status, deriving one for legacy rows that lack `status`. */
export function planStatus(plan: SubscriptionPlan): PlanStatus {
  if (plan.status) return plan.status;
  return plan.isActive ? "active" : "inactive";
}

/** True when a plan may be purchased by users (only `active` plans are). */
export function isPurchasable(plan: SubscriptionPlan): boolean {
  return planStatus(plan) === "active" && plan.isActive;
}

/** The catalog order shown everywhere: displayOrder first, then creation. */
export function sortPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return [...plans].sort((a, b) => {
    const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** The public `PlanUsageLimit` rows a plan exposes (shared by every surface). */
function usageLimitsFor(plan: SubscriptionPlan) {
  return [
    { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", period: "month" as const, limit: plan.aiMessageLimit },
    { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", period: "month" as const, limit: plan.documentAnalysisLimit },
    { featureKey: "CONTRACT_GENERATION", nameFa: "تولید قرارداد", period: "month" as const, limit: plan.contractCreationLimit },
  ];
}

/**
 * Project a catalog row onto the public `Plan` shape every customer surface
 * consumes. ONE projection so the pricing page, the plan cards and the admin
 * preview can never drift. `discountPercent` is derived from the shared
 * formula, never stored.
 */
export function planToPublic(plan: SubscriptionPlan) {
  return {
    id: plan.id,
    code: plan.code,
    nameFa: plan.nameFa,
    shortDescriptionFa: plan.shortDescriptionFa,
    descriptionFa: plan.descriptionFa,
    durationDays: plan.durationDays,
    listPrice: plan.listPrice,
    salePrice: plan.salePrice,
    currency: plan.currency,
    discountPercent: computeDiscountPercent(plan.listPrice, plan.salePrice),
    displayOrder: plan.displayOrder,
    tags: plan.tags,
    features: plan.features,
    dailyRequestLimit: plan.dailyRequestLimit,
    totalTokenLimit: plan.tokenLimit,
    usageLimits: usageLimitsFor(plan),
  };
}

/** The daily points a plan grants: requests × activity cost. */
export function dailyPointsFor(plan: {
  dailyRequestLimit: number;
  activityCostPoints: number;
}): number {
  return plan.dailyRequestLimit * plan.activityCostPoints;
}

/** Freeze a plan's entitlements for a purchased subscription. */
export function snapshotFor(plan: SubscriptionPlan): PlanEntitlementSnapshot {
  return {
    dailyRequestLimit: plan.dailyRequestLimit,
    activityCostPoints: plan.activityCostPoints,
    tokenLimit: plan.tokenLimit,
    aiMessageLimit: plan.aiMessageLimit,
    documentAnalysisLimit: plan.documentAnalysisLimit,
    contractDraftLimit: plan.contractDraftLimit,
    contractCreationLimit: plan.contractCreationLimit,
  };
}

/** The free-tier snapshot used when a user has no active subscription. */
export const FREE_TIER_SNAPSHOT: PlanEntitlementSnapshot = {
  dailyRequestLimit: 10,
  activityCostPoints: BASE_ACTIVITY_COST,
  tokenLimit: 0,
  aiMessageLimit: 0,
  documentAnalysisLimit: 0,
  contractDraftLimit: 0,
  contractCreationLimit: 0,
};

/** Update a plan (admin). Returns the updated row, or undefined if missing. */
export function updatePlan(
  code: PlanCode,
  updates: Partial<Omit<SubscriptionPlan, "id" | "code" | "createdAt">>
): SubscriptionPlan | undefined {
  const rows = readPlans();
  const idx = rows.findIndex((p) => p.code === code);
  if (idx === -1) return undefined;
  const merged: SubscriptionPlan = {
    ...rows[idx]!,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  // `isActive` is a DERIVED mirror of `status` — keep the legacy boolean in
  // step so older consumers that read `isActive` never disagree with the
  // lifecycle state.
  if (updates.status !== undefined) {
    merged.isActive = updates.status === "active";
  }
  rows[idx] = merged;
  writeTable(TABLE, rows);
  return merged;
}

// ============================================================
// Create / lifecycle (admin)
// ============================================================

/** The codes/labels a plan may not collide with. */
const CODE_RE = /^[a-z][a-z0-9_-]{1,31}$/;

export interface CreatePlanInput {
  code: string;
  nameFa: string;
  descriptionFa: string;
  shortDescriptionFa?: string;
  durationDays: number;
  activityCostPoints: number;
  dailyRequestLimit: number;
  tokenLimit: number;
  aiMessageLimit: number;
  documentAnalysisLimit: number;
  contractDraftLimit: number;
  contractCreationLimit: number;
  contractCreationUnlimited: boolean;
  listPrice: number;
  salePrice: number;
  currency?: string;
  features: string[];
  status: PlanStatus;
  displayOrder?: number;
  tags?: string[];
}

export type PlanWriteResult =
  | { ok: true; plan: SubscriptionPlan }
  | { error: string };

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}
function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

const PLAN_STATUSES: PlanStatus[] = ["draft", "active", "inactive", "archived"];

/**
 * Create a new plan. Validates every field and rejects a duplicate code/id.
 * The new row is only written when it is fully valid — a partially-built plan
 * never lands in the catalog. `isActive` is derived from `status`.
 */
export function createPlan(input: CreatePlanInput): PlanWriteResult {
  const code = (input.code ?? "").trim().toLowerCase();
  if (!code) return { error: "CODE_REQUIRED" };
  if (!CODE_RE.test(code)) return { error: "INVALID_CODE" };
  if (readPlans().some((p) => p.code === code || p.id === `plan-${code}`)) {
    return { error: "CODE_EXISTS" };
  }
  if (!input.nameFa?.trim()) return { error: "NAME_REQUIRED" };
  if (!isPosInt(input.durationDays)) return { error: "INVALID_DURATION" };
  if (!isPosInt(input.activityCostPoints)) return { error: "INVALID_ACTIVITY_COST" };
  for (const n of [
    input.dailyRequestLimit,
    input.tokenLimit,
    input.aiMessageLimit,
    input.documentAnalysisLimit,
    input.contractDraftLimit,
    input.contractCreationLimit,
  ]) {
    if (!isNonNegInt(n)) return { error: "INVALID_LIMIT" };
  }
  if (!isNonNegInt(input.listPrice)) return { error: "INVALID_PRICE" };
  if (!isNonNegInt(input.salePrice)) return { error: "INVALID_PRICE" };
  if (input.salePrice > input.listPrice) return { error: "SALE_ABOVE_LIST" };
  if (!PLAN_STATUSES.includes(input.status)) return { error: "INVALID_STATUS" };
  if (input.displayOrder !== undefined && !isNonNegInt(input.displayOrder)) {
    return { error: "INVALID_ORDER" };
  }

  const now = new Date().toISOString();
  const plan: SubscriptionPlan = {
    id: `plan-${code}`,
    code,
    nameFa: input.nameFa.trim(),
    descriptionFa: input.descriptionFa ?? "",
    ...(input.shortDescriptionFa ? { shortDescriptionFa: input.shortDescriptionFa } : {}),
    status: input.status,
    isActive: input.status === "active",
    durationDays: input.durationDays,
    activityCostPoints: input.activityCostPoints,
    dailyRequestLimit: input.dailyRequestLimit,
    tokenLimit: input.tokenLimit,
    aiMessageLimit: input.aiMessageLimit,
    documentAnalysisLimit: input.documentAnalysisLimit,
    contractDraftLimit: input.contractDraftLimit,
    contractCreationLimit: input.contractCreationLimit,
    contractCreationUnlimited: input.contractCreationUnlimited,
    listPrice: input.listPrice,
    salePrice: input.salePrice,
    currency: input.currency ?? "IRT",
    features: Array.isArray(input.features) ? input.features.filter((f) => typeof f === "string") : [],
    ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    ...(Array.isArray(input.tags) ? { tags: input.tags.filter((t) => typeof t === "string") } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const rows = readPlans();
  rows.push(plan);
  writeTable(TABLE, rows);
  return { ok: true, plan };
}

/**
 * Change a plan's lifecycle status (publish → `active`, deactivate →
 * `inactive`, archive → `archived`). Never touches a purchased subscription —
 * each subscription keeps its frozen snapshot.
 */
export function setPlanStatus(
  code: string,
  status: PlanStatus,
  changedBy: string
): SubscriptionPlan | undefined {
  if (!PLAN_STATUSES.includes(status)) return undefined;
  const before = getPlanByCode(code);
  if (!before) return undefined;
  const after = updatePlan(code as PlanCode, { status });
  if (!after) return undefined;
  if (planStatus(before) !== status) {
    writePlanAudit([
      {
        id: `pa-${crypto.randomUUID()}`,
        planId: after.id,
        planCode: after.code,
        changedBy,
        field: "status",
        oldValue: planStatus(before),
        newValue: status,
        createdAt: new Date().toISOString(),
      },
    ]);
  }
  return after;
}

/** Append plan-edit audit rows (shared by create, edit and status changes). */
export function writePlanAudit(entries: PlanAuditEntry[]): void {
  if (entries.length === 0) return;
  const rows = readTable<PlanAuditEntry>(AUDIT_TABLE);
  rows.push(...entries);
  writeTable(AUDIT_TABLE, rows);
}

/** Record the creation of a plan as a single audit row. */
export function auditPlanCreated(plan: SubscriptionPlan, changedBy: string): void {
  writePlanAudit([
    {
      id: `pa-${crypto.randomUUID()}`,
      planId: plan.id,
      planCode: plan.code,
      changedBy,
      field: "created",
      oldValue: null,
      newValue: JSON.stringify({ code: plan.code, nameFa: plan.nameFa, status: planStatus(plan) }),
      createdAt: new Date().toISOString(),
    },
  ]);
}

/** Read the plan-edit audit trail, newest first. */
export function readPlanAudit(limit = 100): PlanAuditEntry[] {
  return readTable<PlanAuditEntry>(AUDIT_TABLE)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/**
 * Apply an admin edit to a plan and record one audit row per changed field.
 * The audit is written in the same synchronous pass as the update, so a
 * change can never land without its trail.
 */
export function updatePlanWithAudit(
  code: PlanCode,
  updates: Partial<Omit<SubscriptionPlan, "id" | "code" | "createdAt">>,
  changedBy: string
): SubscriptionPlan | undefined {
  const before = getPlanByCode(code);
  if (!before) return undefined;

  const after = updatePlan(code, updates);
  if (!after) return undefined;

  const now = new Date().toISOString();
  const entries: PlanAuditEntry[] = [];
  for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
    const oldValue = before[key as keyof SubscriptionPlan];
    const newValue = after[key as keyof SubscriptionPlan];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    entries.push({
      id: `pa-${crypto.randomUUID()}`,
      planId: after.id,
      planCode: after.code,
      changedBy,
      field: String(key),
      oldValue: oldValue == null ? null : JSON.stringify(oldValue),
      newValue: newValue == null ? null : JSON.stringify(newValue),
      createdAt: now,
    });
  }
  writePlanAudit(entries);
  return after;
}
