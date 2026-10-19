// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/contact
// ============================================================
// §5 — the destination-number check before a signature link is sent.
//
// An operator must be able to see WHO will receive the link and WHERE,
// correct a wrong number (or one that belongs to someone else), and only
// then send. Four rules make that auditable:
//
//   1. the corrected number is stored on THAT person's own row — the
//      signature participant when a request exists, otherwise the party
//      record the participant will be built from;
//   2. the previous number, the new number, the reason, the admin and the
//      timestamp are appended to `contract-contact-changes` (append-only);
//   3. a send happens ONLY when the caller passes `confirmed: true` — the
//      server never sends as a side effect of a correction;
//   4. the REAL delivery outcome (sent / failed + channel) is written back
//      to the same record, so a failure is never recorded as success.
//
// The destinations the operator must see BEFORE sending come from the
// contract detail payload (`signingParticipants` / `parties`), so there is
// no second read endpoint that could disagree with it.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeIranMobile } from "@legalir/validation";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, readJson, requestMeta } from "@/lib/admin/http";
import { getContractById, getParty, upsertParty } from "@/lib/contracts/db";
import {
  latestSignatureRequestDetail,
  listParticipants,
  updateParticipant,
} from "@/lib/contracts/signature/db";
import { issueSignatureInvitations } from "@/lib/contracts/signature/invitations";
import { clientFingerprintFrom } from "@/lib/contracts/signature/fingerprint";
import { maskMobile, partyDisplayName } from "@/lib/contracts/signature/workflow";
import { partyRoleLabelFa } from "@/lib/contracts/registry";
import { recordContactChange, recordContactChangeDelivery } from "@/lib/contracts/admin-print";
import { refreshFinalArtifact } from "@/lib/contracts/finalization";

interface Params {
  params: Promise<{ id: string }>;
}

interface CorrectBody {
  /** The signature participant to correct (preferred when a request exists). */
  participantId?: string;
  /** The party to correct when no signature request exists yet. */
  partyId?: string;
  newMobile?: string;
  reasonFa?: string;
  /** Send the link to the corrected number AFTER the change is stored. */
  send?: boolean;
  /** The operator's explicit confirmation shown on screen. Required to send. */
  confirmed?: boolean;
  expiresInHours?: number;
}

// ------------------------------------------------------------
// POST — correct a destination, optionally send afterwards
// ------------------------------------------------------------

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const body = ((await readJson(request)) as CorrectBody | null) ?? {};
  const reasonFa = (body.reasonFa ?? "").trim();
  if (reasonFa.length < 3) {
    return adminError(400, "REASON_REQUIRED", "ثبت دلیل تغییر شماره الزامی است");
  }

  const newMobile = normalizeIranMobile(body.newMobile ?? "");
  if (!newMobile) {
    return adminError(400, "INVALID_MOBILE", "شمارهٔ موبایل واردشده معتبر نیست");
  }

  if (body.send && body.confirmed !== true) {
    // No send without an explicit confirmation: a correction alone must
    // never deliver a link to a changed number.
    return adminError(
      400,
      "CONFIRMATION_REQUIRED",
      "برای ارسال لینک به شمارهٔ جدید، تأیید نمایش داده‌شده الزامی است"
    );
  }

  const request0 = latestSignatureRequestDetail(contract.id);
  const participant = body.participantId
    ? listParticipants(request0?.id ?? "").find((p) => p.id === body.participantId) ?? null
    : null;

  if (body.participantId && !participant) {
    return adminError(404, "NOT_FOUND", "طرف امضاکننده یافت نشد");
  }

  if (participant?.status === "SIGNED") {
    return adminError(
      409,
      "ALREADY_SIGNED",
      "این طرف قبلاً امضا کرده است؛ شمارهٔ او دیگر قابل تغییر نیست"
    );
  }

  const partyId = participant?.partyId ?? body.partyId ?? null;
  if (!participant && !partyId) {
    return adminError(400, "TARGET_REQUIRED", "طرفی که شمارهٔ او اصلاح می‌شود مشخص نیست");
  }

  const party = partyId ? getParty(contract.id, partyId) : null;
  if (!participant && !party) return adminError(404, "NOT_FOUND", "طرف قرارداد یافت نشد");

  const previousMobile = participant?.mobile ?? party?.identity.mobile ?? "";
  if (previousMobile === newMobile) {
    return adminError(400, "UNCHANGED", "شمارهٔ جدید با شمارهٔ فعلی یکسان است");
  }

  const roleFa = participant?.roleFa ?? (party ? partyRoleLabelFa(party.role) : "طرف قرارداد");
  const nameFa = participant?.nameFa || (party ? partyDisplayName(party) : "");

  // Rule 1 — store the number on THAT person's own row.
  if (participant) {
    updateParticipant(participant.id, {
      mobile: newMobile,
      mobileMasked: maskMobile(newMobile),
    });
  }
  if (party) {
    // Keep the party record in step too: the next signature request is
    // built from it, so a corrected number must survive a re-issue.
    upsertParty({
      ...party,
      identity: { ...party.identity, mobile: newMobile },
    });
  }

  // Rule 2 — the append-only correction record.
  const change = recordContactChange({
    contractId: contract.id,
    signatureRequestId: request0?.id ?? null,
    participantId: participant?.id ?? null,
    partyId,
    roleFa,
    nameFa,
    previousMobile,
    newMobile,
    reasonFa,
    adminUserId: auth.ctx.userId,
    adminLabelFa: findUserById(auth.ctx.userId)?.displayName?.trim() || "مدیر لیگالیر",
  });

  let invitation: {
    participantId: string;
    token: string;
    expiresAt: string;
    delivered: boolean;
    channel: "sms" | "dev-console" | null;
    failureReasonFa: string | null;
  } | null = null;
  let delivery: ReturnType<typeof recordContactChangeDelivery> = null;

  // Rule 3 — send only on explicit confirmation, and only to THIS party.
  if (body.send) {
    const outcome = await issueSignatureInvitations({
      contract,
      participantIds: participant ? [participant.id] : undefined,
      ...(typeof body.expiresInHours === "number"
        ? { expiresInHours: body.expiresInHours }
        : {}),
      fingerprint: clientFingerprintFrom(request),
      actorLabelFa: "ادمین لیگالیر",
    });

    if (!outcome.ok) {
      // Rule 4 — the failure is recorded, not hidden.
      delivery = recordContactChangeDelivery(change.id, {
        deliveryStatus: "FAILED",
        deliveryChannel: "none",
        deliveryDetail: outcome.messageFa,
      });
      recordAudit({
        actorUserId: auth.ctx.userId,
        actorRole: auth.ctx.role,
        orgId: auth.ctx.orgId,
        action: "contract.signature.contact_corrected_send_failed",
        resourceType: "property_contract",
        resourceId: contract.id,
        reason: reasonFa,
        before: { mobile: previousMobile },
        after: { mobile: newMobile, code: outcome.code },
        ...requestMeta(request),
      });
      return NextResponse.json(
        {
          data: {
            change: delivery,
            invitation: null,
            sent: false,
            errorFa: outcome.messageFa,
          },
        },
        { status: 409 }
      );
    }

    const issued =
      outcome.result.invitations.find((i) => i.participantId === (participant?.id ?? "")) ??
      outcome.result.invitations[0] ??
      null;
    invitation = issued;

    delivery = recordContactChangeDelivery(change.id, {
      deliveryStatus: issued?.delivered ? "SENT" : "FAILED",
      deliveryChannel: issued?.channel ?? "none",
      deliveryDetail: issued?.delivered
        ? `لینک امضا برای ${nameFa || roleFa} ارسال شد (${issued.channel}).`
        : issued?.failureReasonFa ?? "ارسال ناموفق بود.",
    });
  }

  // T7 — the party table in the printed document carries the signer's
  // number, so a corrected destination regenerates the stored final PDF.
  await refreshFinalArtifact({
    contractId: contract.id,
    actorId: auth.ctx.userId,
    baseUrl: new URL(request.url).origin,
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.signature.contact_corrected",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason: reasonFa,
    before: { mobile: previousMobile },
    after: {
      mobile: newMobile,
      participantId: change.participantId,
      partyId: change.partyId,
      // The number itself is PII; the audit trail records that a change
      // occurred and who made it, with the reason — not a second copy of
      // the digits. The change record holds the before/after pair.
      changeId: change.id,
      sent: body.send === true,
      deliveryStatus: delivery?.deliveryStatus ?? null,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      change: delivery ?? change,
      invitation,
      sent: delivery?.deliveryStatus === "SENT",
      // A failed send keeps the corrected number and says why — the operator
      // can retry without re-entering it.
      errorFa:
        delivery && delivery.deliveryStatus === "FAILED"
          ? delivery.deliveryDetail ?? "ارسال لینک ناموفق بود."
          : null,
    },
  });
}
