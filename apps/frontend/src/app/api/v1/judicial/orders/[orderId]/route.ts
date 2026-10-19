// ============================================================
// LEGALIR — /api/v1/judicial/orders/[orderId]
// ============================================================
// One owned tracked order.
//
//   GET    — the order as stored (a foreign id is indistinguishable from a
//            missing one).
//   PATCH  — edit a DRAFT (or a `waiting_user` order the operator returned).
//            A submitted order is a record; it is not silently rewritten.
//   DELETE — cancel an order that has not been delivered. Nothing is
//            hard-deleted: the row stays as `cancelled` with its history, so
//            "delete" is a withdrawal, never a data loss.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialError, notFoundRequest, readJson } from "@/lib/judicial/http";
import { listDemoDocuments } from "@/lib/demo-seed";
import {
  cancelOrder,
  getOwnedOrder,
  updateOrderDraft,
} from "@/lib/judicial/review-db";
import type { JudicialOrderAnswer } from "@legalir/types";

interface Params {
  params: Promise<{ orderId: string }>;
}

function readAnswers(value: unknown): JudicialOrderAnswer[] | undefined {
  if (value === undefined) return undefined;
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

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const order = getOwnedOrder(auth.ctx.userId, orderId);
  if (!order) return notFoundRequest();

  return NextResponse.json({ data: { order } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;

  const body = await readJson<{
    titleFa?: unknown;
    answers?: unknown;
    noteFa?: unknown;
    purposeFa?: unknown;
    attachmentIds?: unknown;
  }>(req);
  if (!body) return judicialError(400, "VALIDATION_ERROR", "بدنهٔ درخواست نامعتبر است.");

  const existing = getOwnedOrder(auth.ctx.userId, orderId);
  if (!existing) return notFoundRequest();

  const ownedDocIds = new Set(listDemoDocuments(auth.ctx.userId).map((d) => d.id));
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds
        .filter((id): id is string => typeof id === "string" && ownedDocIds.has(id))
        .slice(0, 30)
    : undefined;

  const next = updateOrderDraft(auth.ctx.userId, orderId, {
    ...(typeof body.titleFa === "string" ? { titleFa: body.titleFa } : {}),
    ...(readAnswers(body.answers) !== undefined
      ? { answers: readAnswers(body.answers) ?? [] }
      : {}),
    ...(typeof body.noteFa === "string" || body.noteFa === null
      ? { noteFa: body.noteFa as string | null }
      : {}),
    ...(typeof body.purposeFa === "string" || body.purposeFa === null
      ? { purposeFa: body.purposeFa as string | null }
      : {}),
    ...(attachmentIds !== undefined ? { attachmentIds } : {}),
  });

  if (!next) {
    return judicialError(
      409,
      "ORDER_NOT_EDITABLE",
      "این درخواست دیگر قابل ویرایش نیست؛ برای تغییر، با پشتیبانی تماس بگیرید."
    );
  }

  return NextResponse.json({ data: { order: next } });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const cancelled = cancelOrder(auth.ctx.userId, orderId);
  if (!cancelled) {
    const owned = getOwnedOrder(auth.ctx.userId, orderId);
    if (!owned) return notFoundRequest();
    return judicialError(
      409,
      "ORDER_NOT_CANCELLABLE",
      "این درخواست تحویل شده است و لغو آن ممکن نیست."
    );
  }
  return NextResponse.json({ data: { cancelled: true } });
}
