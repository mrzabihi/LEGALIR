// ============================================================
// LEGALIR — /api/v1/judicial/requests
// ============================================================
// GET  — the caller's own drafting requests (the resume list).
// POST — create one request. Idempotent by the client's key: a double-click or
//        a retried request returns the ORIGINAL row and creates nothing new.
//
// AUTHORIZATION
//   • the user id always comes from the session — never the body;
//   • the service must be enterable FOR THIS CALLER right now (config status
//     AND feature flag), so hiding a card in the UI is never the gate;
//   • an optional `caseId` is accepted only when the case is the caller's own
//     (a foreign id is dropped, not stored).
//
// Starting a request writes NOTHING outside the judicial tables. It does not
// create a judicial case, does not file anything, and does not change the
// linked case's status.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getCaseById } from "@/lib/case-db";
import { judicialFlagContext } from "@/lib/judicial/context";
import { isJudicialServiceEnterable } from "@/lib/judicial/service-config";
import {
  createRequest,
  isDraftableType,
  listRequestsForUser,
  serviceIdForType,
} from "@/lib/judicial/db";
import { toRequestSummary } from "@/lib/judicial/present";
import type {
  JudicialCreateRequestInput,
  JudicialServiceId,
  JudicialStartMode,
} from "@legalir/types";

function isStartMode(value: unknown): value is JudicialStartMode {
  return value === "ai_draft" || value === "ready_document";
}

function isServiceId(value: unknown): value is JudicialServiceId {
  return (
    value === "judicial_statement" ||
    value === "judicial_brief" ||
    value === "judicial_petition" ||
    value === "judicial_complaint" ||
    value === "judicial_criminal_record" ||
    value === "judicial_credit_check"
  );
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "1";
  const items = listRequestsForUser(auth.ctx.userId, { includeArchived }).map(toRequestSummary);
  return NextResponse.json({ data: { items, total: items.length } });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  let body: Partial<JudicialCreateRequestInput> & { idempotencyKey?: string };
  try {
    body = (await req.json()) as Partial<JudicialCreateRequestInput>;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (!isServiceId(body.serviceId)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "خدمت انتخاب‌شده معتبر نیست." },
      { status: 400 }
    );
  }
  if (!isStartMode(body.startMode)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "روش شروع مشخص نیست." },
      { status: 400 }
    );
  }
  if (
    body.documentType !== undefined &&
    body.documentType !== null &&
    !isDraftableType(body.documentType)
  ) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نوع سند انتخاب‌شده معتبر نیست." },
      { status: 400 }
    );
  }
  if (body.narrative !== undefined && typeof body.narrative !== "string") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شرح موضوع باید متن باشد." },
      { status: 400 }
    );
  }
  if (body.narrative && body.narrative.length > 20_000) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شرح موضوع بیش از حد طولانی است." },
      { status: 400 }
    );
  }

  // The client sends its own key in the body; the header is accepted as a
  // fallback so the shared API client's Idempotency-Key works too.
  const idempotencyKey = (
    body.idempotencyKey?.trim() ||
    req.headers.get("Idempotency-Key")?.trim() ||
    ""
  ).slice(0, 120);
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شناسهٔ یکتای درخواست ارسال نشده است." },
      { status: 400 }
    );
  }

  // The family the request will resolve to decides which service must be
  // enterable. "Don't know yet" starts under the entry service the caller
  // came from; the type is derived once they describe the problem.
  const targetServiceId =
    body.documentType && isDraftableType(body.documentType)
      ? serviceIdForType(body.documentType)
      : body.serviceId;

  const ctx = judicialFlagContext({ userId: auth.ctx.userId, orgId: auth.ctx.orgId });
  if (!isJudicialServiceEnterable(targetServiceId, ctx)) {
    return NextResponse.json(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "این خدمت در حال حاضر برای حساب شما فعال نیست.",
      },
      { status: 403 }
    );
  }

  // A case link is accepted only when the case is the caller's OWN.
  let caseId = body.caseId ?? null;
  if (caseId) {
    const owned = getCaseById(caseId);
    if (!owned || owned.user_id !== auth.ctx.userId) caseId = null;
  }

  // "Continue from one of my cases" is explicit user consent; the case's own
  // description seeds the narrative only when the user has not written one.
  let narrative = body.narrative ?? "";
  if (!narrative.trim() && body.narrativeFromCase && caseId) {
    const owned = getCaseById(caseId);
    narrative = owned?.description ?? "";
  }

  const { request, replayed } = createRequest(auth.ctx.userId, {
    serviceId: body.serviceId,
    startMode: body.startMode,
    documentType: body.documentType ?? null,
    narrative,
    titleFa: body.titleFa,
    caseId,
    narrativeFromCase: Boolean(body.narrativeFromCase),
    idempotencyKey,
  });

  return NextResponse.json(
    { data: { request: toRequestSummary(request), replayed } },
    { status: replayed ? 200 : 201 }
  );
}
