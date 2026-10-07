// ============================================================
// LEGALIR — GET /api/v1/plans
// ============================================================
// Reads the plan catalog (the single source of truth) and projects it
// onto the public `Plan` shape the pricing / subscription / checkout
// pages already consume. No numbers are hard-coded here — every value
// comes from the `subscription_plans` table, and a plan is only listed
// once it is `active` (a draft/inactive/archived plan is not purchasable).
// ============================================================

import { NextResponse } from "next/server";
import { isPurchasable, planToPublic, readPlans, sortPlans } from "@/lib/usage/plans";

export async function GET() {
  const plans = sortPlans(readPlans())
    .filter(isPurchasable)
    .map(planToPublic);

  return NextResponse.json({ data: plans });
}
