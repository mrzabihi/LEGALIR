// ============================================================
// LEGALIR — POST /api/v1/calculators/[slug]/run
// ============================================================
// Runs a legal calculator server-side. This is the ONLY place the
// admin-configured policy (enabled/disabled, access tier, energy cost) is
// enforced, and the ONLY place a run's energy is charged — through the shared
// usage engine. The compute itself is the same deterministic `runCalculator`
// the client uses; the server simply owns the gate.

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { authorizeCalculatorRun } from "@/lib/admin/calculator-settings";
import { CalculatorInputError, coerceInput, getCalculator } from "@/lib/calculators";
import type { CalculatorInput } from "@/lib/calculators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { slug } = await params;
  const calc = getCalculator(slug);
  if (!calc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "محاسبه‌گر یافت نشد" },
      { status: 404 }
    );
  }

  // Policy gate + real energy charge (idempotent per calculator/user/day).
  const auth = authorizeCalculatorRun(slug, userId);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.code ?? "DENIED", message: auth.messageFa },
      { status: auth.code === "CALCULATOR_NOT_FOUND" ? 404 : 403 }
    );
  }

  let raw: CalculatorInput;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    raw = (body?.["input"] ?? body ?? {}) as CalculatorInput;
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "بدنهٔ درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  try {
    const input = coerceInput(calc.def.fields, raw);
    const result = calc.compute(input);
    return NextResponse.json({
      data: { result, energyCost: auth.energyCost, transactionId: auth.transactionId },
    });
  } catch (err) {
    if (err instanceof CalculatorInputError) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: err.message, fields: err.fields },
        { status: 400 }
      );
    }
    throw err;
  }
}
