// ============================================================
// LEGALIR — GET|PUT|DELETE /api/v1/lawyer/rates
// ============================================================
// The lawyer's published price per service. The lawyer id is taken from the
// session's own profile, so a lawyer can only manage their own rates.
//
//   GET    — current rates + the append-only change history
//   PUT    — publish/change one service price (amount in Toman, integer)
//   DELETE — withdraw a service price
//
// Every change appends to `lawyer_rate_changes`. A request already accepted
// keeps its `agreedRate` snapshot and is never repriced.
// ============================================================

import { NextResponse } from "next/server";
import { badRequest, readBody, requireLawyer, str } from "@/lib/lawyer-portal/http";
import {
  clearLawyerRate,
  listLawyerRateChanges,
  listLawyerRates,
  setLawyerRate,
} from "@/lib/lawyer-portal/store";
import type { LawyerRateUnit } from "@legalir/types";

const UNITS: LawyerRateUnit[] = ["FIXED", "HOURLY", "PER_SESSION"];

export async function GET(request: Request) {
  const auth = requireLawyer(request, "lawyer:rates:manage");
  if (!auth.ok) return auth.response;

  const { profile } = auth.lawyer;
  return NextResponse.json({
    data: {
      rates: listLawyerRates(profile.id),
      changes: listLawyerRateChanges(profile.id).slice(0, 100),
    },
  });
}

export async function PUT(request: Request) {
  const auth = requireLawyer(request, "lawyer:rates:manage");
  if (!auth.ok) return auth.response;

  const body = await readBody(request);
  if (!body) return badRequest("بدنه درخواست نامعتبر است");

  const serviceKey = str(body["serviceKey"]);
  const unit = str(body["unit"]) as LawyerRateUnit;
  const amount = Number(body["amountToman"]);

  if (!UNITS.includes(unit)) return badRequest("روش محاسبه معتبر نیست");

  const result = setLawyerRate({
    lawyerId: auth.lawyer.profile.id,
    actor: auth.lawyer.actor,
    serviceKey,
    amountToman: amount,
    unit,
    noteFa: str(body["noteFa"]) || null,
  });
  if (!result.ok) return badRequest(result.messageFa);

  return NextResponse.json({ data: { rate: result.rate } });
}

export async function DELETE(request: Request) {
  const auth = requireLawyer(request, "lawyer:rates:manage");
  if (!auth.ok) return auth.response;

  const serviceKey = new URL(request.url).searchParams.get("serviceKey");
  if (!serviceKey) return badRequest("شناسهٔ سرویس الزامی است");

  const result = clearLawyerRate({
    lawyerId: auth.lawyer.profile.id,
    actor: auth.lawyer.actor,
    serviceKey,
  });
  if (!result.ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "نرخ موردنظر پیدا نشد" },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: { change: result.change } });
}
