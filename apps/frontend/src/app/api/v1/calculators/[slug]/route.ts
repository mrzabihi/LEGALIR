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
import { getCalculator } from "@/lib/calculators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!getCalculator(slug)) {
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
    },
  });
}
