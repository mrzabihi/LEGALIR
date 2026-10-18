// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/attestations
// ============================================================
// An admin may VERIFY a signature the party themselves gave — the OTP
// they watched arrive, a wet-ink scan they checked, a call they made.
//
// An attestation is EVIDENCE ABOUT a signature, never a signature:
//   • it NEVER changes a participant's status;
//   • it NEVER advances the contract state;
//   • it cannot be recorded for a party who has not signed — there is
//     nothing to attest to.
//
// Every row records the mandatories the § instruction asks for: the
// time (createdAt), the admin user (id + label), the party, the frozen
// contract version + hash, and the ORIGIN of the confirmation
// (`channel`: the party's own dedicated link vs. an out-of-band admin
// verification). `noteFa` — what the admin actually saw or checked — is
// mandatory. Nothing here is ever written by the signing route.
// ============================================================

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  SignatureAttestation,
  SignatureAttestationChannel,
  SignatureParticipant,
  SignatureRequest,
} from "@legalir/types";
import { SIGNATURE_ATTESTATION_CHANNEL_FA } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, readJson, requestMeta } from "@/lib/admin/http";
import { getContractById } from "@/lib/contracts/db";
import {
  appendSignatureEvent,
  getParticipant,
  insertAttestation,
  latestSignatureRequest,
  listAttestations,
  listParticipants,
} from "@/lib/contracts/signature/db";

interface Params {
  params: Promise<{ id: string }>;
}

interface AttestationBody {
  participantId?: string;
  channel?: SignatureAttestationChannel;
  noteFa?: string;
}

const CHANNELS: SignatureAttestationChannel[] = [
  "party_link",
  "sms_otp_observed",
  "wet_ink_verified",
  "phone_call",
];

/** GET — every attestation recorded for this contract, oldest first. */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const attestations = listAttestations(contract.id).map((a) => ({
    ...a,
    channelFa: SIGNATURE_ATTESTATION_CHANNEL_FA[a.channel],
  }));

  return NextResponse.json({
    data: {
      contractId: contract.id,
      attestations,
    },
  });
}

/** POST — record one verification of a signature a party already gave. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const body = (await readJson(request)) as AttestationBody | null;
  if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

  const participantId = (body.participantId ?? "").trim();
  if (!participantId) {
    return adminError(400, "PARTICIPANT_REQUIRED", "انتخاب طرف قرارداد الزامی است");
  }

  // The origin must be one of the recorded channels — an attestation
  // without a stated origin is exactly what the § instruction forbids.
  const channel = body.channel;
  if (!channel || !CHANNELS.includes(channel)) {
    return adminError(400, "CHANNEL_REQUIRED", "منشأ تأیید الزامی است");
  }

  // The note is mandatory: it must say what the admin actually saw or
  // checked, not merely that something was verified.
  const noteFa = (body.noteFa ?? "").trim();
  if (noteFa.length < 5) {
    return adminError(
      400,
      "NOTE_REQUIRED",
      "یادداشت الزامی است: دقیقاً بنویسید چه چیزی را بررسی کردید"
    );
  }

  const signatureRequest = latestSignatureRequest(contract.id);
  if (!signatureRequest) {
    return adminError(409, "NO_REQUEST", "درخواست امضایی برای این قرارداد ثبت نشده است");
  }

  const participant = findParticipant(signatureRequest, participantId);
  if (!participant) {
    return adminError(404, "PARTICIPANT_NOT_FOUND", "این طرف در درخواست امضای فعلی نیست");
  }

  // An attestation about a signature that does not exist would be a
  // fabricated confirmation. The party must have signed first.
  if (participant.status !== "SIGNED") {
    return adminError(
      409,
      "PARTICIPANT_NOT_SIGNED",
      "برای طرفی که هنوز امضا نکرده است نمی‌توان تأییدیهٔ امضا ثبت کرد."
    );
  }

  const actor = findUserById(auth.ctx.userId);
  const adminLabelFa = actor?.displayName?.trim() || "مدیر لیگالیر";

  const attestation: SignatureAttestation = {
    id: `satt-${crypto.randomUUID()}`,
    contractId: contract.id,
    signatureRequestId: signatureRequest.id,
    participantId: participant.id,
    contractVersionId: signatureRequest.contractVersionId,
    documentHash: signatureRequest.documentHash,
    channel,
    noteFa,
    adminUserId: auth.ctx.userId,
    adminLabelFa,
    createdAt: new Date().toISOString(),
  };
  insertAttestation(attestation);

  // The event trail records the verification in the same place as the
  // party's own actions, but the type makes the origin unmistakable.
  appendSignatureEvent({
    signatureRequestId: signatureRequest.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "ADMIN_ATTESTATION",
    descriptionFa: `${adminLabelFa} امضای ${participant.roleFa} را بررسی و تأیید کرد (${SIGNATURE_ATTESTATION_CHANNEL_FA[channel]}).`,
    contractVersionId: signatureRequest.contractVersionId,
    documentHash: signatureRequest.documentHash,
    metadata: {
      attestationId: attestation.id,
      channel,
      noteFa,
      adminUserId: auth.ctx.userId,
      adminLabelFa,
    },
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.signature.attested",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason: noteFa,
    // Neither the contract state nor the participant status changes:
    // this is evidence about a signature, not a signature (§).
    before: { participantStatus: participant.status, state: contract.state },
    after: {
      participantStatus: participant.status,
      state: contract.state,
      attestationId: attestation.id,
      channel,
      contractVersionId: signatureRequest.contractVersionId,
      documentHash: signatureRequest.documentHash,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      attestation: {
        ...attestation,
        channelFa: SIGNATURE_ATTESTATION_CHANNEL_FA[channel],
        participantRoleFa: participant.roleFa,
      },
      stateChanged: false,
      participantStatusChanged: false,
    },
  });
}

/** The participant on the request, or null when the id is not theirs. */
function findParticipant(
  signatureRequest: SignatureRequest,
  participantId: string
): SignatureParticipant | null {
  const participant = getParticipant(participantId);
  if (!participant || participant.signatureRequestId !== signatureRequest.id) return null;
  // Guard against a participant row from another contract reusing the id.
  return listParticipants(signatureRequest.id).find((p) => p.id === participant.id) ?? null;
}
