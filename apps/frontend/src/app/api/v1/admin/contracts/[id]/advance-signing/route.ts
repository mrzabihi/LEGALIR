// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/advance-signing
// ============================================================
// §T4 — the admin's manual "advance to party signing" action.
//
// WHY THIS EXISTS
// A contract can stall before signing for reasons that are not a legal
// defect in the text: the counterparty confirmed out-of-band, a review
// mail never arrived, the parties agreed to sign without the queue. The
// platform must let an AUTHORISED operator unblock it — deliberately,
// with a written reason, and without ever rewriting history.
//
// WHAT IT IS NOT
// It is NOT a review and NOT an approval. No `ContractAdminReview` row is
// created, no approval hash is bound, `reviewedByLegalir` stays FALSE, and
// the final PDF draws the amber «ثبت نهایی بدون بررسی لیگالیر» mark — not
// the blue reviewed stamp. The only thing it writes that authorises
// signing is a `self_final` registration with `actorKind: "admin"`.
//
// THE GATE
// The state machine is the structural guarantee: `PENDING_ADMIN_REVIEW`
// has NO edge to `READY_TO_SIGN`, so a contract that is genuinely in the
// review queue cannot be pulled out of it here. The legal sources are
// READY_FOR_REVIEW, COUNTERPARTY_REVIEW and ADMIN_APPROVED.
//
// POST body: { reasonFa: string }   — mandatory, ≥ 3 characters.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, readJson, requestMeta } from "@/lib/admin/http";
import {
  getContractById,
  getVersion,
  listContractDocuments,
  updateContractForUser,
} from "@/lib/contracts/db";
import { openAdminReview } from "@/lib/contracts/admin-review";
import { canPrintFaithfully, contractPrintIssues } from "@/lib/contracts/admin-print";
import { recordSelfFinalRegistration, registrationForHash } from "@/lib/contracts/registration";
import {
  activeSignatureRequest,
  latestSignatureRequestDetail,
} from "@/lib/contracts/signature/db";
import {
  assertTransition,
  IllegalTransitionError,
  stateLabelFa,
} from "@/lib/contracts/state-machine";
import { audit as appendContractAudit } from "@/lib/contracts/api-helpers";

interface Params {
  params: Promise<{ id: string }>;
}

interface AdvanceBody {
  reasonFa?: string;
}

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const body = ((await readJson(request)) as AdvanceBody | null) ?? {};
  const reasonFa = (body.reasonFa ?? "").trim();
  if (reasonFa.length < 3) {
    return adminError(400, "REASON_REQUIRED", "ثبت دلیل برای این اقدام الزامی است");
  }

  // A version must exist: signing authority is bound to a content hash, and
  // an unfrozen draft has nothing to bind to.
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  if (!currentVersion) {
    return adminError(
      409,
      "NO_VERSION",
      "برای این قرارداد هنوز نسخه‌ای تثبیت نشده است؛ ابتدا نسخه را ایجاد کنید"
    );
  }

  // A live request already owns the signing stage. Advancing again would
  // either do nothing or invalidate links the parties are holding.
  if (activeSignatureRequest(contract.id)) {
    return adminError(
      409,
      "SIGNING_IN_PROGRESS",
      "درخواست امضای فعال برای این قرارداد وجود دارد"
    );
  }

  // An open review is IN the queue. Leaving it is a decision, and decisions
  // go through the review route — never through this shortcut.
  if (openAdminReview(contract.id)) {
    return adminError(
      409,
      "REVIEW_PENDING",
      "این قرارداد در صف بررسی لیگالیر است؛ برای خروج از صف از تصمیم بررسی استفاده کنید"
    );
  }

  const existing = registrationForHash(contract.id, currentVersion.documentHash);
  if (existing) {
    return adminError(409, "ALREADY_REGISTERED", "برای این نسخه پیش‌تر مسیر ثبت تعیین شده است");
  }

  // Nothing may be silently dropped from the printed document.
  const printRequest = latestSignatureRequestDetail(contract.id);
  const printIssues = contractPrintIssues({
    contract,
    documents: listContractDocuments(contract.id),
    participants: printRequest?.participants ?? [],
  });
  if (!canPrintFaithfully(printIssues)) {
    return adminError(409, "PRINT_UNFAITHFUL", printIssues.map((i) => i.messageFa).join(" "));
  }

  // The state machine is the last word: PENDING_ADMIN_REVIEW has no edge
  // here, so an in-queue contract can never be advanced by this route.
  try {
    assertTransition(contract.state, "READY_TO_SIGN");
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return adminError(409, "ILLEGAL_TRANSITION", err.message);
    }
    throw err;
  }

  const actor = findUserById(auth.ctx.userId);
  const actorLabelFa = actor?.displayName?.trim() || "مدیر لیگالیر";

  // The ONE authorising record: self_final, actorKind admin, reviewed false.
  const registration = recordSelfFinalRegistration({
    contract,
    version: currentVersion,
    actorId: auth.ctx.userId,
    actorLabelFa,
    actorKind: "admin",
    reasonFa,
  });

  const updated = updateContractForUser(contract.userId, contract.id, {
    state: "READY_TO_SIGN",
  });

  // Two trails, both explicit that this was NOT a review.
  appendContractAudit({
    contractId: contract.id,
    actorId: auth.ctx.userId,
    actorLabel: actorLabelFa,
    action: "contract.admin_advanced_to_signing",
    descriptionFa: `قرارداد توسط ادمین (${actorLabelFa}) بدون بررسی لیگالیر به مرحلهٔ امضای طرفین فرستاده شد. دلیل: ${reasonFa}`,
    metadata: {
      registrationId: registration.id,
      contractVersionId: currentVersion.id,
      documentHash: currentVersion.documentHash,
      reviewedByLegalir: false,
      fromState: contract.state,
      toState: "READY_TO_SIGN",
    },
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.admin_advanced_to_signing",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason: reasonFa,
    before: { state: contract.state, registration: null },
    after: {
      state: "READY_TO_SIGN",
      registrationId: registration.id,
      contractVersionId: currentVersion.id,
      documentHash: currentVersion.documentHash,
      reviewedByLegalir: false,
      note: "این اقدام بررسی لیگالیر نیست و در سوابق نیز همان‌گونه ثبت شده است.",
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      contract: updated,
      registration,
      fromStateFa: stateLabelFa(contract.state),
      toStateFa: stateLabelFa("READY_TO_SIGN"),
      reviewedByLegalir: false,
    },
  });
}
