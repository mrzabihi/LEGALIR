// ============================================================
// LEGALIR — GET /api/v1/calculators/[slug]
// ============================================================
// The PUBLIC, non-sensitive slice of a calculator's operational policy: is it
// enabled, who may run it, and what does one run cost in energy. The client
// workspace uses this to decide whether it may preview a result locally (free)
// or must route the run through the server (charged). The allow-lists stay
// admin-only — they are never exposed here.

import { NextResponse } from "next/server";
import { getCalculatorSetting } from "@/lib/admin/calculator-settings";
import { activeRuleOverrides, activeRuleRefs } from "@/lib/admin/calculator-rules";
import { getCalculator } from "@/lib/calculators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const calc = getCalculator(slug);
  if (!calc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "محاسبه‌گر یافت نشد" },
      { status: 404 }
    );
  }
  const setting = getCalculatorSetting(slug);
  return NextResponse.json({
    data: {
      slug: setting.slug,
      enabled: setting.enabled,
      accessTier: setting.accessTier,
      energyCost: setting.energyCost,
      // The published rule versions currently in force — so the client can
      // label a local preview with the same version the server would use.
      rules: activeRuleRefs(calc.def.datasetIds),
      // The same in-force sparse rate patches the server primes, so a FREE
      // calculator's local preview can apply them and match the server number.
      // Only published versions in force — a draft is never exposed here.
      ruleOverrides: activeRuleOverrides(calc.def.datasetIds),
    },
  });
}
