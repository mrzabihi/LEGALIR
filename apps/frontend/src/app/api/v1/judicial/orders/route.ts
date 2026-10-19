// ============================================================
// LEGALIR — /api/v1/judicial/orders
// ============================================================
// The tracked-request lane for the two provider-dependent services
// (گواهی عدم سوءپیشینه، استعلام اعتبار معاملاتی). Ligalir does not issue
// either artifact; it records a real request and an operator moves it.
//
//   GET  — the caller's own orders (all statuses, newest first).
//   POST — create one order, either as a draft or submitted directly.
//          Idempotent by `idempotencyKey`.
//
// AUTHORIZATION
//   • `userId` always comes from the session;
//   • the service must be ORDERABLE for this caller right now — the same
//     server-side availability projection the entry cards read;
//   • attachment ids are filtered to the caller's own documents, so a
//     foreign id is never stored.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listDemoDocuments } from "@/lib/demo-seed";
import { judicialFlagContext } from "@/lib/judicial/context";
import { requireServiceOrderable } from "@/lib/judicial/http";
import { createOrder, listOrdersForUser } from "@/lib/judicial/review-db";
import {
  fromOrderAnswers,
  judicialOrderConfig,
  validateOrderForm,
} from "@/lib/judicial/order-fields";
import type { JudicialOrderAnswer, JudicialServiceId } from "@legalir/types";

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

/** Keep only well-formed answer rows; the client can add none. */
function readAnswers(value: unknown): JudicialOrderAnswer[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is JudicialOrderAnswer =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as JudicialOrderAnswer).fieldId === "string" &&
        typeof (row as JudicialOrderAnswer).labelFa === "string" &&
        typeof (row as JudicialOrderAnswer).value === "string"
    )
    .map((row) => ({
      fieldId: row.fieldId.slice(0, 80),
      labelFa: row.labelFa.slice(0, 200),
      value: row.value.trim().slice(0, 2000),
    }))
    .filter((row) => row.fieldId && row.value);
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const items = listOrdersForUser(auth.ctx.userId);
  return NextResponse.json({ data: { items, total: items.length } });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  let body: {
    serviceId?: unknown;
    titleFa?: unknown;
    answers?: unknown;
    noteFa?: unknown;
    purposeFa?: unknown;
    attachmentIds?: unknown;
    submit?: unknown;
    idempotencyKey?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
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

  const ctx = judicialFlagContext({ userId: auth.ctx.userId, orgId: auth.ctx.orgId });
  const gate = requireServiceOrderable(body.serviceId, ctx);
  if (gate) return gate;

  const idempotencyKey = (
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : "") ||
    req.headers.get("Idempotency-Key") ||
    ""
  )
    .trim()
    .slice(0, 120);
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شناسهٔ یکتای درخواست ارسال نشده است." },
      { status: 400 }
    );
  }

  const titleFa = typeof body.titleFa === "string" ? body.titleFa.trim() : "";
  if (!titleFa) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "موضوع درخواست را وارد کنید." },
      { status: 400 }
    );
  }

  // Attachments are references to the caller's OWN documents; anything else
  // is dropped rather than stored.
  const ownedDocIds = new Set(listDemoDocuments(auth.ctx.userId).map((d) => d.id));
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds
        .filter((id): id is string => typeof id === "string" && ownedDocIds.has(id))
        .slice(0, 30)
    : [];

  const submit = body.submit === true;
  const answers = readAnswers(body.answers);

  // A submitted order must carry the information the operator needs. A draft
  // is allowed to be incomplete — that is what a draft is. The SAME validator
  // the submit route runs is used here, so direct submission and hand-off
  // cannot disagree about what "complete" means.
  const purposeFa = typeof body.purposeFa === "string" ? body.purposeFa : "";
  if (submit) {
    const config = judicialOrderConfig(body.serviceId);
    const mapped = fromOrderAnswers(config, answers);
    const errors = validateOrderForm(
      config,
      mapped.values,
      purposeFa,
      mapped.consent,
      true
    );
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "برای ثبت نهایی، اطلاعات خواسته‌شده را کامل کنید.",
          fieldErrors: errors,
        },
        { status: 400 }
      );
    }
  }

  const { order, replayed } = createOrder(auth.ctx.userId, {
    serviceId: body.serviceId,
    titleFa,
    answers,
    noteFa: typeof body.noteFa === "string" ? body.noteFa : null,
    purposeFa: purposeFa || null,
    attachmentIds,
    submit,
    idempotencyKey,
  });

  return NextResponse.json(
    { data: { order, replayed } },
    { status: replayed ? 200 : 201 }
  );
}
