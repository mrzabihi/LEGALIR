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
import type {
  PlanAuditEntry,
  PlanCode,
  PlanEntitlementSnapshot,
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
  const seeded: SubscriptionPlan[] = DEFAULT_PLANS.map((p) => ({
    ...p,
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
  rows[idx] = merged;
  writeTable(TABLE, rows);
  return merged;
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
  if (entries.length > 0) {
    const rows = readTable<PlanAuditEntry>(AUDIT_TABLE);
    rows.push(...entries);
    writeTable(AUDIT_TABLE, rows);
  }
  return after;
}
