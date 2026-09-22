// ============================================================
// LEGALIR — GET /api/v1/plans
// ============================================================
// Reads the plan catalog (the single source of truth) and projects it
// onto the public `Plan` shape the pricing / subscription / checkout
// pages already consume. No numbers are hard-coded here — every value
// comes from the `subscription_plans` table.
// ============================================================

import { NextResponse } from "next/server";
import { readPlans } from "@/lib/usage/plans";
import type { Plan, PlanUsageLimit } from "@legalir/types";

function usageLimitsFor(plan: ReturnType<typeof readPlans>[number]): PlanUsageLimit[] {
  return [
    {
      featureKey: "AI_CHAT_MESSAGE",
      nameFa: "پیام هوش مصنوعی",
      period: "month",
      limit: plan.aiMessageLimit,
    },
    {
      featureKey: "DOCUMENT_ANALYSIS",
      nameFa: "تحلیل سند",
      period: "month",
      limit: plan.documentAnalysisLimit,
    },
    {
      featureKey: "CONTRACT_GENERATION",
      nameFa: "تولید قرارداد",
      period: "month",
      limit: plan.contractCreationLimit,
    },
  ];
}

export async function GET() {
  const plans: Plan[] = readPlans()
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      code: p.code,
      nameFa: p.nameFa,
      descriptionFa: p.descriptionFa,
      durationDays: p.durationDays,
      listPrice: p.listPrice,
      salePrice: p.salePrice,
      currency: p.currency,
      features: p.features,
      dailyRequestLimit: p.dailyRequestLimit,
      totalTokenLimit: p.tokenLimit,
      usageLimits: usageLimitsFor(p),
    }));

  return NextResponse.json({ data: plans });
}
