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
//
// `apply` is further gated on SIGNATURES: no stamp may be drawn until
// every participant of the request bound to THIS version has signed.
// The admin seal is never a substitute for a party's signature — it is
// the mark placed after all of them. The successful apply notifies each
// signer through the shared SMS adapter and reports the REAL per-party
// delivery outcome; when no gateway is configured the response says so
// instead of claiming a message was sent.
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
import { latestSignatureRequest, listParticipants } from "@/lib/contracts/signature/db";
import { getSmsGateway } from "@/lib/sms/gateway";
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

/**
 * The signature state of the CURRENT version, from real rows only.
 *
 * A stamp may be drawn only when a COMPLETED signature request is bound
 * to the current version hash — an approval that was signed for an
 * older version must never authorise stamping new text.
 */
function currentVersionSignatures(contractId: string, documentHash: string | null):
  | { ok: true; requestId: string }
  | { ok: false; reason: "SIGNATURES_REQUIRED" | "STALE_SIGNATURES"; detailFa: string } {
  const request = latestSignatureRequest(contractId);
  if (!request) {
    return {
      ok: false,
      reason: "SIGNATURES_REQUIRED",
      detailFa: "پیش از درج مهر رسمی، قرارداد باید توسط همهٔ طرفین امضا شود.",
    };
  }
  if (!documentHash || request.documentHash !== documentHash) {
    return {
      ok: false,
      reason: "STALE_SIGNATURES",
      detailFa:
        "نسخهٔ فعلی قرارداد با نسخه‌ای که امضا شده متفاوت است؛ مهر رسمی فقط روی نسخهٔ امضاشده درج می‌شود.",
    };
  }
  const participants = listParticipants(request.id);
  if (participants.length === 0) {
    return {
      ok: false,
      reason: "SIGNATURES_REQUIRED",
      detailFa: "پیش از درج مهر رسمی، قرارداد باید توسط همهٔ طرفین امضا شود.",
    };
  }
  const unsigned = participants.filter((p) => p.status !== "SIGNED");
  if (unsigned.length > 0 || request.status !== "COMPLETED") {
    return {
      ok: false,
      reason: "SIGNATURES_REQUIRED",
      detailFa: `پیش از درج مهر رسمی، این طرفین هنوز امضا نکرده‌اند: ${unsigned
        .map((p) => p.roleFa)
        .join("، ")}`,
    };
  }
  return { ok: true, requestId: request.id };
}

/**
 * Tell every signer that the final sealed version is available.
 *
 * The outcome is REAL: each entry says whether the adapter reached a
 * phone, only the dev console, or failed. A delivery failure never
 * rolls back a recorded stamp — the stamp is a server-side decision,
 * the SMS is a notification — but it is reported so the admin knows to
 * resend or hand the link over.
 */
async function notifySignersOfFinalApproval(
  contract: PropertyContract,
  contractVersionId: string,
  // Kept in the signature so every call site states which sealed version it
  // is notifying about; the version check itself is by id (see below).
  _documentHash: string
): Promise<
  {
    participantId: string;
    roleFa: string;
    delivered: boolean;
    channel: "sms" | "dev-console" | null;
    failureReasonFa: string | null;
  }[]
> {
  const request = latestSignatureRequest(contract.id);
  if (!request || request.contractVersionId !== contractVersionId) return [];

  const gateway = getSmsGateway();
  const base = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "").replace(/\/$/, "");
  const link = `${base}/contracts/verify/${contract.publicVerificationId ?? contract.id}`;
  const body = `لیگالیر — نسخهٔ نهایی و مهرشدهٔ قرارداد ${contract.referenceCode} آماده است. مشاهده: ${link}`;

  return Promise.all(
    listParticipants(request.id).map(async (participant) => {
      const outcome = await gateway.send({
        to: participant.mobile,
        body,
        tag: "final-approval",
      });
      return {
        participantId: participant.id,
        roleFa: participant.roleFa,
        delivered: outcome.ok,
        channel: outcome.ok ? outcome.channel : null,
        failureReasonFa: outcome.ok ? null : outcome.detailFa,
      };
    })
  );
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

  // `notify` is a RECORDED outcome, never a caller-supplied action: it is
  // appended by the apply path after the SMS adapter reports back.
  const action = body.action;
  if (action !== "request" && action !== "apply" && action !== "reject" && action !== "cancel") {
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
  return await handleDecision(request, auth, contract, body, action, reason, documentHash);
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

async function handleDecision(
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

    // The admin seal is placed AFTER the parties sign — never before and
    // never instead of them. The signature state is read from the real
    // request bound to THIS version hash (Spec B §۵/§۶).
    const signatures = currentVersionSignatures(contract.id, documentHash);
    if (!signatures.ok) {
      return adminError(409, signatures.reason, signatures.detailFa);
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

  // Notify every signer that the final sealed version exists. The stamp
  // is already recorded — a delivery failure is reported, never a reason
  // to pretend the SMS went out or to roll the decision back.
  const notifications =
    action === "apply" && target.documentHash
      ? await notifySignersOfFinalApproval(
          contract,
          target.contractVersionId ?? "",
          target.documentHash
        )
      : [];

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

  // A failed SMS is a real, surfaceable state; it is written into the
  // stamp event trail so the admin area can show it later.
  if (notifications.some((n) => !n.delivered)) {
    appendStampEvent({
      stampRequestId: target.id,
      action: "notify",
      actorId: auth.ctx.userId,
      actorLabel: actorName,
      reasonFa: notifications
        .filter((n) => !n.delivered)
        .map((n) => `${n.roleFa}: ${n.failureReasonFa ?? "ارسال ناموفق"}`)
        .join("؛ "),
      documentHash: target.documentHash,
      stampAssetSha256: target.stampAssetSha256,
    });
  }

  return NextResponse.json({
    data: {
      stampRequest: toDetail(updated),
      applied: status === "APPLIED",
      notifications,
    },
  });
}
