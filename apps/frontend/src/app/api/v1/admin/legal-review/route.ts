// ============================================================
// LEGALIR — /api/v1/admin/legal-review
// ============================================================
// The authorised revision path for per-type legal content (§7).
//
//   GET    — every contract type with its per-clause review report:
//            stored records (source, article, content version, review
//            state, reviewer) plus the seeded fallback, and the tips.
//   POST   — save a clause citation or a pre-sign tip. A save ALWAYS
//            bumps `contentVersion` and stamps `reviewedAt`, so the
//            printed annex can name the exact version it came from.
//   DELETE — remove a stored record (the seed then applies again, or the
//            clause is flagged if the seed has none).
//
// Gated on `admin:contracts:review` — the same permission that governs
// the contract review queue — and every write is recorded in the
// platform audit trail with actor, before → after and reason.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ContractLegalCitationStatus, ContractTypeId } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, mapDataError, readJson, requestMeta } from "@/lib/admin/http";
import { allContractDefinitions } from "@/lib/contracts/registry";
import {
  deleteLegalClauseRecord,
  deletePreSignTip,
  legalReviewTypeSummary,
  upsertLegalClauseRecord,
  upsertPreSignTip,
} from "@/lib/contracts/legal-review-db";

const STATUSES: ContractLegalCitationStatus[] = ["reviewed", "pending", "needs_revision"];

function isContractType(value: unknown): value is ContractTypeId {
  return (
    typeof value === "string" &&
    allContractDefinitions().some((d) => (d.id as string) === value)
  );
}

function isStatus(value: unknown): value is ContractLegalCitationStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The unvalidated write body. Every field is narrowed before use. */
interface LegalReviewWriteBody {
  kind?: unknown;
  contractType?: unknown;
  id?: unknown;
  clauseId?: unknown;
  sourceNameFa?: unknown;
  lawSourceId?: unknown;
  articleFa?: unknown;
  noteFa?: unknown;
  titleFa?: unknown;
  bodyFa?: unknown;
  order?: unknown;
  status?: unknown;
  reason?: unknown;
}

// ------------------------------------------------------------
// GET — the per-type report
// ------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;

  const requested = request.nextUrl.searchParams.get("type");
  if (requested && !isContractType(requested)) return mapDataError("NOT_FOUND");

  const types = allContractDefinitions()
    .filter((d) => !requested || d.id === requested)
    .map((definition) => ({
      typeId: definition.id,
      typeFa: definition.typeFa,
      implemented: definition.implemented,
      report: legalReviewTypeSummary(definition.id),
    }));

  return NextResponse.json({ data: { types } });
}

// ------------------------------------------------------------
// POST — save a clause citation or a pre-sign tip
// ------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;

  const body = (await readJson(request)) as LegalReviewWriteBody | null;
  if (!body) return mapDataError("UNKNOWN_ACTION");

  const kind = body.kind;
  if (kind !== "clause" && kind !== "tip") return mapDataError("UNKNOWN_ACTION");

  const rawType = body.contractType;
  if (!isContractType(rawType)) return mapDataError("NOT_FOUND");
  const contractType = rawType;

  const actor = findUserById(auth.ctx.userId);
  const actorLabel = actor?.displayName?.trim() || "بازبین حقوقی لیگالیر";

  if (kind === "clause") {
    const clauseId = str(body.clauseId);
    if (clauseId.length < 2) return mapDataError("QUERY_REQUIRED");

    const sourceNameFa = str(body.sourceNameFa);
    if (sourceNameFa.length < 3) return adminError(400, "SOURCE_REQUIRED", "نام منبع حقوقی الزامی است");

    const articleFa = str(body.articleFa);
    if (articleFa.length < 3) return adminError(400, "ARTICLE_REQUIRED", "شماره یا عنوان ماده الزامی است");

    const noteFa = str(body.noteFa);
    if (noteFa.length < 10) {
      return adminError(400, "NOTE_REQUIRED", "توضیح استناد باید حداقل ۱۰ نویسه باشد");
    }

    if (!isStatus(body.status)) return adminError(400, "INVALID_STATUS", "وضعیت بررسی نامعتبر است");

    const { record, previous } = upsertLegalClauseRecord({
      contractType,
      clauseId,
      sourceNameFa,
      lawSourceId: str(body.lawSourceId) || null,
      articleFa,
      noteFa,
      status: body.status,
      reviewedBy: auth.ctx.userId,
      reviewedByLabelFa: actorLabel,
    });

    recordAudit({
      actorUserId: auth.ctx.userId,
      actorRole: auth.ctx.role,
      orgId: auth.ctx.orgId,
      action: "contract.legal_review.clause_saved",
      resourceType: "property_contract_legal_clause",
      resourceId: record.id,
      reason: str(body.reason) || null,
      before: previous
        ? {
            articleFa: previous.articleFa,
            sourceNameFa: previous.sourceNameFa,
            status: previous.status,
            contentVersion: previous.contentVersion,
          }
        : null,
      after: {
        contractType,
        clauseId,
        articleFa: record.articleFa,
        sourceNameFa: record.sourceNameFa,
        status: record.status,
        contentVersion: record.contentVersion,
      },
      ...requestMeta(request),
    });

    return NextResponse.json({
      data: {
        kind: "clause",
        record,
        previous,
        report: legalReviewTypeSummary(contractType),
      },
    });
  }

  // kind === "tip"
  const titleFa = str(body.titleFa);
  if (titleFa.length < 3) return adminError(400, "TITLE_REQUIRED", "عنوان نکته الزامی است");

  const tipBodyFa = str(body.bodyFa);
  if (tipBodyFa.length < 10) {
    return adminError(400, "MESSAGE_REQUIRED", "متن نکته باید حداقل ۱۰ نویسه باشد");
  }

  const sourceNameFa = str(body.sourceNameFa);
  if (sourceNameFa.length < 3) return adminError(400, "SOURCE_REQUIRED", "نام منبع حقوقی الزامی است");

  if (!isStatus(body.status)) return adminError(400, "INVALID_STATUS", "وضعیت بررسی نامعتبر است");

  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 1;

  const { tip, previous } = upsertPreSignTip({
    id: str(body.id) || null,
    contractType,
    titleFa,
    bodyFa: tipBodyFa,
    sourceNameFa,
    order,
    status: body.status,
    reviewedBy: auth.ctx.userId,
    reviewedByLabelFa: actorLabel,
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.legal_review.tip_saved",
    resourceType: "property_contract_pre_sign_tip",
    resourceId: tip.id,
    reason: str(body.reason) || null,
    before: previous
      ? {
          titleFa: previous.titleFa,
          status: previous.status,
          contentVersion: previous.contentVersion,
        }
      : null,
    after: {
      contractType,
      titleFa: tip.titleFa,
      status: tip.status,
      contentVersion: tip.contentVersion,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      kind: "tip",
      tip,
      previous,
      report: legalReviewTypeSummary(contractType),
    },
  });
}

// ------------------------------------------------------------
// DELETE — remove a stored record
// ------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;

  // The API client's `delete` carries no body, so the target is named in
  // the query string: `?kind=clause&id=<id>&reason=<text>`.
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  const id = str(params.get("id"));
  const reason = str(params.get("reason"));
  if ((kind !== "clause" && kind !== "tip") || !id) return mapDataError("UNKNOWN_ACTION");

  const removed = kind === "clause" ? deleteLegalClauseRecord(id) : deletePreSignTip(id);
  if (!removed) return mapDataError("NOT_FOUND");

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: `contract.legal_review.${kind}_deleted`,
    resourceType: kind === "clause" ? "property_contract_legal_clause" : "property_contract_pre_sign_tip",
    resourceId: id,
    reason: reason || null,
    // The removed row IS the before-state; spread it so the audit stores a
    // plain object rather than a typed record instance.
    before: { ...removed },
    after: null,
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      kind,
      removed,
      report: legalReviewTypeSummary(removed.contractType),
    },
  });
}
