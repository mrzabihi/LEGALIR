// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/stamp
// ============================================================
// The OFFICIAL LEGALIR stamp — a stronger act than the internal
// review, reserved to the SUPER ADMIN.
//
// GET  — the stamp context for one contract: whether the stamp master is
//        available, the current version + hash, whether a valid stamp is
//        already applied, and the full request history.
// POST — a stamp DECISION, the only four actions:
//
//          request   ثبت درخواست مهر برای نسخهٔ فعلی (bound to the hash)
//          apply     صدور مهر (Super Admin only) — binds the version hash
//                    AND the byte-identical stamp master
//          reject    رد درخواست مهر
//          cancel    لغو درخواست مهر
//
// Every action carries a MANDATORY reason and appends an immutable event
// plus the platform audit trail. The stamp can only be drawn when an
// APPLIED request's `documentHash` matches the CURRENT version AND its
// `stampAssetSha256` still matches the stamp master on disk
// (`currentVersionStamp`) — so a content change or a swapped stamp file
// invalidates the stamp automatically.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  ContractStampAction,
  ContractStampRequest,
  PropertyContract,
} from "@legalir/types";
import { CONTRACT_STAMP_STATUS_FA } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, mapDataError, readJson, requestMeta } from "@/lib/admin/http";
import { getContractById, getVersion } from "@/lib/contracts/db";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";
import { reviewStampInfo } from "@/lib/contracts/stamp-asset";
import {
  appendStampEvent,
  createPendingStampRequest,
  currentVersionStamp,
  listStampEvents,
  listStampRequests,
  updateStampRequest,
} from "@/lib/contracts/stamp-review";

interface Params {
  params: Promise<{ id: string }>;
}

interface StampBody {
  action?: ContractStampAction;
  reason?: string;
  stampRequestId?: string;
}

/** A stamp request with its status label + event history, for the API. */
function toDetail(request: ContractStampRequest) {
  return {
    ...request,
    statusFa: CONTRACT_STAMP_STATUS_FA[request.status],
    events: listStampEvents(request.id),
  };
}

// ------------------------------------------------------------
// GET — the stamp context
// ------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:stamp:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, currentVersion?.documentHash ?? null);
  const applied = currentVersionStamp(contract, currentVersion?.documentHash ?? null);

  const requests = listStampRequests(contract.id);

  return NextResponse.json({
    data: {
      contract: {
        id: contract.id,
        referenceCode: contract.referenceCode,
        typeFa: contract.typeFa,
        state: contract.state,
      },
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            documentHash: currentVersion.documentHash,
          }
        : null,
      // The stamp master must exist AND be byte-identical to what any
      // applied request was bound to; `reviewStampInfo` never exposes bytes.
      stampAsset: reviewStampInfo(),
      reviewed: approval !== null,
      featureEnabled: isContractFeatureEnabled("CONTRACT_STAMP_ENABLED"),
      applied: applied !== null,
      appliedRequest: applied ? toDetail(applied) : null,
      requests: requests.map(toDetail),
    },
  });
}

// ------------------------------------------------------------
// POST — the decision
// ------------------------------------------------------------

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:stamp:manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  if (!isContractFeatureEnabled("CONTRACT_STAMP_ENABLED")) {
    return adminError(409, "FEATURE_DISABLED", "سطح مهر رسمی لیگالیر در حال حاضر فعال نیست.");
  }

  const body = (await readJson(request)) as StampBody | null;
  if (!body || !body.action) return adminError(400, "ACTION_REQUIRED", "عملیات مهر الزامی است");

  const action = body.action;
  if (!["request", "apply", "reject", "cancel"].includes(action)) {
    return mapDataError("UNKNOWN_ACTION");
  }

  // The reason is MANDATORY for every stamp action — the stamp is an
  // official act, so the record must always say why (§ instruction).
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3) {
    return adminError(400, "REASON_REQUIRED", "ثبت دلیل برای اقدام مهر الزامی است");
  }

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const documentHash = currentVersion?.documentHash ?? null;

  if (action === "request") {
    return handleRequest(request, auth, contract, reason);
  }
  return handleDecision(request, auth, contract, body, action, reason, documentHash);
}

// ------------------------------------------------------------
// request — open a PENDING stamp request bound to the version
// ------------------------------------------------------------

function handleRequest(
  request: NextRequest,
  auth: { ctx: { userId: string; role: string; orgId: string | null } },
  contract: PropertyContract,
  reason: string
) {
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;

  // A stamp is only ever requested for a version that has already passed
  // the internal LEGALIR review — the stamp is the final, official mark
  // on a reviewed document, never on an unreviewed one.
  const approval = currentVersionApproval(contract, currentVersion?.documentHash ?? null);
  if (!approval) {
    return adminError(
      409,
      "ADMIN_APPROVAL_REQUIRED",
      "پیش از درخواست مهر رسمی، نسخهٔ فعلی باید تأیید واحد بررسی حقوقی را دریافت کند."
    );
  }

  const asset = reviewStampInfo();
  if (!asset.available) {
    return adminError(503, "STAMP_ASSET_UNAVAILABLE", "فایل مهر رسمی لیگالیر در دسترس نیست.");
  }

  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName?.trim() || "مدیر ارشد لیگالیر";

  const stampRequest = createPendingStampRequest({
    contractId: contract.id,
    contractVersionId: currentVersion?.id ?? null,
    documentHash: currentVersion?.documentHash ?? null,
    requestedById: auth.ctx.userId,
    requestedByLabelFa: actorName,
    reasonFa: reason,
  });

  appendStampEvent({
    stampRequestId: stampRequest.id,
    action: "request",
    actorId: auth.ctx.userId,
    actorLabel: actorName,
    reasonFa: reason,
    documentHash: stampRequest.documentHash,
    stampAssetSha256: stampRequest.stampAssetSha256,
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.stamp.request",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason,
    before: { stampStatus: null },
    after: { stampStatus: "PENDING", documentHash: stampRequest.documentHash },
    ...requestMeta(request),
  });

  return NextResponse.json({ data: { stampRequest: toDetail(stampRequest) } });
}

// ------------------------------------------------------------
// apply / reject / cancel — the terminal decisions
// ------------------------------------------------------------

function handleDecision(
  request: NextRequest,
  auth: { ctx: { userId: string; role: string; orgId: string | null } },
  contract: PropertyContract,
  body: StampBody,
  action: "apply" | "reject" | "cancel",
  reason: string,
  documentHash: string | null
) {
  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName?.trim() || "مدیر ارشد لیگالیر";

  const requests = listStampRequests(contract.id);
  const target = body.stampRequestId
    ? requests.find((r) => r.id === body.stampRequestId) ?? null
    : requests.find((r) => r.status === "PENDING") ?? null;

  if (!target) return adminError(404, "NOT_FOUND", "درخواست مهر یافت نشد");
  if (target.status !== "PENDING") {
    return adminError(409, "ALREADY_DECIDED", "این درخواست مهر قبلاً تصمیم‌گیری شده است");
  }

  const now = new Date().toISOString();
  let status: ContractStampRequest["status"];
  let decidedAt: string | null = now;
  let appliedAt: string | null = null;

  if (action === "apply") {
    // The stamp can only be applied to the CURRENT version — a request
    // bound to an older hash is stale and must not authorise the stamp.
    if (!documentHash || target.documentHash !== documentHash) {
      return adminError(
        409,
        "STALE_STAMP_REQUEST",
        "نسخهٔ قرارداد از زمان ثبت درخواست تغییر کرده است؛ درخواست مهر باید دوباره ثبت شود."
      );
    }

    // The stamp master must still be byte-identical to what was approved,
    // otherwise the drawn image would not be the approved one.
    const asset = reviewStampInfo();
    if (!asset.available || !asset.sha256) {
      return adminError(503, "STAMP_ASSET_UNAVAILABLE", "فایل مهر رسمی لیگالیر در دسترس نیست.");
    }
    if (target.stampAssetSha256 && target.stampAssetSha256 !== asset.sha256) {
      return adminError(
        409,
        "STAMP_ASSET_CHANGED",
        "فایل مهر رسمی از زمان ثبت درخواست تغییر کرده است؛ درخواست مهر باید دوباره ثبت شود."
      );
    }

    status = "APPLIED";
    appliedAt = now;
  } else if (action === "reject") {
    status = "REJECTED";
    decidedAt = now;
  } else {
    status = "CANCELLED";
    decidedAt = now;
  }

  const updated = updateStampRequest(target.id, {
    status,
    approvedById: action === "apply" ? auth.ctx.userId : target.approvedById,
    approvedByLabelFa: action === "apply" ? actorName : target.approvedByLabelFa,
    reasonFa: reason,
    decidedAt,
    appliedAt,
  });
  if (!updated) return mapDataError("NOT_FOUND");

  appendStampEvent({
    stampRequestId: target.id,
    action,
    actorId: auth.ctx.userId,
    actorLabel: actorName,
    reasonFa: reason,
    documentHash: target.documentHash,
    stampAssetSha256: target.stampAssetSha256,
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: `contract.stamp.${action}`,
    resourceType: "property_contract",
    resourceId: contract.id,
    reason,
    before: { stampStatus: "PENDING" },
    after: { stampStatus: status, documentHash: target.documentHash },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      stampRequest: toDetail(updated),
      applied: status === "APPLIED",
    },
  });
}
