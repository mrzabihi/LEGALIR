// ============================================================
// LEGALIR — GET|PUT /api/v1/lawyer/bank
// ============================================================
// The settlement account: the lawyer's own IBAN and the review state.
//
// The full IBAN is returned ONLY to the owning lawyer (this route resolves the
// lawyer from the session). Everything else — lists, admin tables, audit
// entries — reads a masked form. Any change resets the status to
// PENDING_REVIEW and appends an immutable bank event; an admin then verifies
// or returns it for correction with a recorded reason.
// ============================================================

import { NextResponse } from "next/server";
import { badRequest, readBody, requireLawyer } from "@/lib/lawyer-portal/http";
import { getBankRecord, listBankEvents, submitBankAccount } from "@/lib/lawyer-portal/store";

export async function GET(request: Request) {
  const auth = requireLawyer(request, "lawyer:bank:manage");
  if (!auth.ok) return auth.response;

  const record = getBankRecord(auth.lawyer.profile.id);
  return NextResponse.json({
    data: { ...record, events: listBankEvents(record.lawyerId) },
  });
}

export async function PUT(request: Request) {
  const auth = requireLawyer(request, "lawyer:bank:manage");
  if (!auth.ok) return auth.response;

  const body = await readBody(request);
  if (!body) return badRequest("بدنه درخواست نامعتبر است");

  const result = submitBankAccount({
    lawyerId: auth.lawyer.profile.id,
    actor: auth.lawyer.actor,
    submission: {
      holderName: typeof body["holderName"] === "string" ? body["holderName"] : "",
      bankName: typeof body["bankName"] === "string" ? body["bankName"] : "",
      iban: typeof body["iban"] === "string" ? body["iban"] : "",
      accountNumber: typeof body["accountNumber"] === "string" ? body["accountNumber"] : null,
      cardLast4: typeof body["cardLast4"] === "string" ? body["cardLast4"] : null,
    },
  });
  if (!result.ok) return badRequest(result.messageFa);

  return NextResponse.json({ data: result.record });
}
