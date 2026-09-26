// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/sign
// ============================================================
// POST — the signature workflow, in four actions:
//
//   create_request  freeze the current version and open a signature
//                   request with one participant per signer
//   request_otp     send a one-time code to a participant's mobile
//   verify_otp      verify the code and record the signature
//   decline         record a participant's refusal
//
// A signature is bound to ONE immutable version and its SHA-256 hash.
// Before the signature is recorded the version's hash is RECOMPUTED
// from its stored snapshot and compared with the recorded hash — a
// mismatch refuses the signature (tamper evidence).
//
// The OTP itself is never stored: the provider keeps only a hash of
// the code, with a TTL and an attempt limit. The signature is
// idempotent per (participant, version) so a retried request cannot
// double-sign.
//
// LEGAL NOTE: this is «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

import crypto from "node:crypto";
import type {
  ContractApproval,
  ContractParty,
  PropertyContract,
  SignatureParticipant,
  SignatureRequest,
} from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  getVersion,
  insertApproval,
  listApprovals,
  listParties,
  updateContractForUser,
} from "@/lib/contracts/db";
import { assertTransition, IllegalTransitionError, isSignable } from "@/lib/contracts/state-machine";
import { partyRoleLabelFa } from "@/lib/contracts/registry";
import { createVersion } from "@/lib/contracts/snapshot";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  insertParticipant,
  insertSignatureRequest,
  listParticipants,
  toRequestDetail,
  updateParticipant,
  updateSignatureRequest,
} from "@/lib/contracts/signature/db";
import { activeSignatureProvider, verifyVersionIntegrity } from "@/lib/contracts/signature";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";

interface Params {
  params: Promise<{ id: string }>;
}

const DEFAULT_EXPIRY_HOURS = 72;

type SignAction = "create_request" | "request_otp" | "verify_otp" | "decline";

interface SignBody {
  action?: SignAction;
  participantId?: string;
  partyId?: string;
  guests?: { roleFa: string; mobile: string }[];
  expiresInHours?: number;
  code?: string;
  consentGiven?: boolean;
  consentVersion?: string;
  idempotencyKey?: string;
  reason?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  if (!isContractFeatureEnabled("CONTRACT_SIGNING_ENABLED")) {
    return conflict("امضای الکترونیکی در حال حاضر فعال نیست.", "FEATURE_DISABLED");
  }

  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  switch (body.action) {
    case "create_request":
      return createRequest(userId, contract, body);
    case "request_otp":
      return requestOtp(contract, body);
    case "verify_otp":
      return verifyOtp(userId, contract, body);
    case "decline":
      return decline(userId, contract, body);
    default:
      return badRequest("عملیات درخواستی معتبر نیست", "INVALID_ACTION");
  }
}

// ------------------------------------------------------------
// create_request — freeze the version, open the request
// ------------------------------------------------------------

function createRequest(userId: string, contract: PropertyContract, body: SignBody) {
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }
  if (activeSignatureRequest(contract.id)) {
    return conflict("یک درخواست امضا در جریان است.", "REQUEST_IN_FLIGHT");
  }

  // Freeze the content as a new immutable version. Every signature in
  // this request binds to this version and its hash.
  const { version } = createVersion(contract, userId);

  const parties = listParties(contract.id);
  const selected = body.partyId
    ? parties.filter((p) => p.id === body.partyId)
    : body.guests && body.guests.length > 0
      ? parties.filter((p) => p.isInitiator)
      : parties;

  if (selected.length === 0) return badRequest("طرف امضاکننده مشخص نیست", "NO_PARTY");

  const now = new Date();
  const expiresInHours = body.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(now.getTime() + expiresInHours * 3600_000).toISOString();

  const request: SignatureRequest = {
    id: `sreq-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    provider: activeSignatureProvider().id,
    assuranceLevel: activeSignatureProvider().assuranceLevel(),
    status: "SENT",
    expiresAt,
    createdBy: userId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
  };
  insertSignatureRequest(request);

  const participants: SignatureParticipant[] = [];
  for (const party of selected) {
    participants.push(
      insertParticipant(buildParticipant(request, party, party.identity.mobile))
    );
  }
  for (const guest of body.guests ?? []) {
    participants.push(
      insertParticipant(buildParticipant(request, null, guest.mobile, guest.roleFa))
    );
  }

  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: null,
    type: "REQUEST_CREATED",
    descriptionFa: `درخواست امضا برای نسخه ${version.versionNumber} ایجاد شد.`,
    contractVersionId: version.id,
    documentHash: version.documentHash,
  });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "signature.request_created",
    descriptionFa: `درخواست امضا برای نسخه ${version.versionNumber} ایجاد شد.`,
    metadata: { requestId: request.id, versionId: version.id, participants: participants.length },
  });

  return ok({ request: toRequestDetail(request), version });
}

/** Build a participant row for a party or a guest signer. */
function buildParticipant(
  request: SignatureRequest,
  party: ContractParty | null,
  mobile: string,
  roleFaOverride?: string
): SignatureParticipant {
  return {
    id: `spart-${crypto.randomUUID()}`,
    signatureRequestId: request.id,
    contractId: request.contractId,
    partyId: party?.id ?? null,
    roleFa: roleFaOverride ?? (party ? partyRoleLabelFa(party.role) : "امضاکننده"),
    mobileMasked: maskMobile(mobile),
    mobile,
    status: "PENDING",
    viewedAt: null,
    signedAt: null,
    declinedAt: null,
    declineReason: null,
    createdAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// request_otp — send a challenge to a participant
// ------------------------------------------------------------

function requestOtp(contract: PropertyContract, body: SignBody) {
  const request = activeSignatureRequest(contract.id);
  if (!request) return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  const participant = resolveParticipant(request.id, body);
  if (!participant) return badRequest("امضاکننده مشخص نیست", "NO_PARTICIPANT");
  if (participant.status === "SIGNED") {
    return conflict("این طرف قبلاً امضا کرده است.", "ALREADY_SIGNED");
  }
  if (!participant.mobile.trim()) {
    return badRequest("شماره موبایل این طرف ثبت نشده است.", "NO_MOBILE");
  }

  const provider = activeSignatureProvider();
  const issued = provider.requestChallenge({
    subject: challengeSubject(request.id, participant.id),
    mobile: participant.mobile,
  });

  if (!issued.sent) {
    return conflict("تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید.", "RATE_LIMITED");
  }

  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "OTP_REQUESTED",
    descriptionFa: `کد تأیید برای ${participant.roleFa} ارسال شد.`,
    contractVersionId: request.contractVersionId,
    documentHash: request.documentHash,
    authMethod: "OTP_SMS",
  });

  return ok({
    sent: true,
    mobileMasked: issued.destinationMasked,
    expiresAt: issued.expiresAt,
    remainingAttempts: issued.remainingAttempts,
  });
}

// ------------------------------------------------------------
// verify_otp — verify the code and record the signature
// ------------------------------------------------------------

function verifyOtp(userId: string, contract: PropertyContract, body: SignBody) {
  const request = activeSignatureRequest(contract.id);
  if (!request) return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  const participant = resolveParticipant(request.id, body);
  if (!participant) return badRequest("امضاکننده مشخص نیست", "NO_PARTICIPANT");

  // Idempotency: a retried verify for an already-signed participant
  // returns the existing state instead of signing twice.
  if (participant.status === "SIGNED") {
    return ok({
      participant,
      request: toRequestDetail(request),
      allSigned: request.status === "COMPLETED",
      assuranceLevel: request.assuranceLevel,
      idempotent: true,
    });
  }

  // Consent must be explicit — never prechecked.
  if (body.consentGiven !== true) {
    return badRequest("برای امضا باید رضایت خود را اعلام کنید.", "CONSENT_REQUIRED");
  }

  // Re-prove the version's integrity before recording anything.
  const version = getVersion(contract.id, request.contractVersionId);
  if (!version) return conflict("نسخه امضا یافت نشد.", "NO_VERSION");
  const integrity = verifyVersionIntegrity(version);
  if (!integrity.ok) {
    appendSignatureEvent({
      signatureRequestId: request.id,
      contractId: contract.id,
      participantId: participant.id,
      type: "INTEGRITY_FAILED",
      descriptionFa: "عدم تطابق هش نسخه — امضا رد شد.",
      contractVersionId: version.id,
      documentHash: version.documentHash,
      metadata: { recomputed: integrity.recomputed, recorded: integrity.recorded },
    });
    return conflict("محتوای نسخه تغییر کرده است؛ امضا ممکن نیست.", "INTEGRITY_FAILED");
  }

  const provider = activeSignatureProvider();
  const verified = provider.verifyChallenge({
    subject: challengeSubject(request.id, participant.id),
    code: body.code ?? "",
  });
  if (!verified.ok) {
    appendSignatureEvent({
      signatureRequestId: request.id,
      contractId: contract.id,
      participantId: participant.id,
      type: "OTP_FAILED",
      descriptionFa: verified.messageFa ?? "کد تأیید نامعتبر بود.",
      contractVersionId: version.id,
      documentHash: version.documentHash,
      metadata: { code: verified.code },
    });
    return badRequest(verified.messageFa ?? "کد وارد شده صحیح نیست.", verified.code ?? "OTP_INVALID");
  }

  const now = new Date().toISOString();
  const signed = updateParticipant(participant.id, {
    status: "SIGNED",
    signedAt: now,
  })!;

  // Record the signature as an approval bound to this exact version.
  const existing = listApprovals(contract.id).find(
    (a) => a.partyId === participant.partyId && a.contractVersionId === version.id
  );
  const signature: ContractApproval = {
    id: existing?.id ?? `apr-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    partyId: participant.partyId ?? participant.id,
    status: "approved",
    comment: "تأیید و امضای الکترونیکی",
    method: "otp",
    approvedAt: now,
    createdAt: existing?.createdAt ?? now,
  };
  insertApproval(signature);

  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "OTP_VERIFIED",
    descriptionFa: `کد تأیید ${participant.roleFa} پذیرفته شد.`,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    authMethod: "OTP_SMS",
  });
  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "SIGNED",
    descriptionFa: `${participant.roleFa} قرارداد را امضا کرد (نسخه ${version.versionNumber}).`,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    authMethod: "OTP_SMS",
    metadata: {
      consentVersion: body.consentVersion ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    },
  });

  // The request completes when every participant has signed.
  const participants = listParticipants(request.id);
  const allSigned = participants.every((p) => p.status === "SIGNED");
  const updatedRequest = updateSignatureRequest(contract.id, request.id, {
    status: allSigned ? "COMPLETED" : "PARTIALLY_SIGNED",
    completedAt: allSigned ? now : null,
  })!;

  if (allSigned) {
    appendSignatureEvent({
      signatureRequestId: request.id,
      contractId: contract.id,
      participantId: null,
      type: "REQUEST_COMPLETED",
      descriptionFa: "همه طرفین قرارداد را امضا کردند.",
      contractVersionId: version.id,
      documentHash: version.documentHash,
    });
  }

  // Advance the contract state. Signing only ever moves to SIGNED; the
  // registration-policy state is the finalize step's job.
  let nextState = contract.state;
  if (allSigned) nextState = "SIGNED";
  else if (contract.state === "READY_TO_SIGN") nextState = "PARTIALLY_SIGNED";

  let updated = contract;
  if (nextState !== contract.state) {
    try {
      assertTransition(contract.state, nextState);
      updated = updateContractForUser(userId, contract.id, { state: nextState }) ?? contract;
    } catch (err) {
      if (!(err instanceof IllegalTransitionError)) throw err;
    }
  }

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: participant.roleFa,
    action: "contract.signed",
    descriptionFa: `${participant.roleFa} قرارداد را امضا کرد (نسخه ${version.versionNumber}).`,
    metadata: {
      requestId: request.id,
      versionId: version.id,
      documentHash: version.documentHash,
      participantId: participant.id,
      allSigned,
    },
  });

  return ok({
    participant: signed,
    request: toRequestDetail(updatedRequest),
    contract: updated,
    allSigned,
    assuranceLevel: request.assuranceLevel,
  });
}

// ------------------------------------------------------------
// decline — record a refusal
// ------------------------------------------------------------

function decline(userId: string, contract: PropertyContract, body: SignBody) {
  const request = activeSignatureRequest(contract.id);
  if (!request) return conflict("درخواست امضایی در جریان نیست.", "NO_REQUEST");

  const participant = resolveParticipant(request.id, body);
  if (!participant) return badRequest("امضاکننده مشخص نیست", "NO_PARTICIPANT");

  const now = new Date().toISOString();
  const declined = updateParticipant(participant.id, {
    status: "DECLINED",
    declinedAt: now,
    declineReason: body.reason ?? null,
  })!;

  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "DECLINED",
    descriptionFa: `${participant.roleFa} از امضا خودداری کرد.`,
    contractVersionId: request.contractVersionId,
    documentHash: request.documentHash,
    metadata: { reason: body.reason ?? null },
  });

  const updatedRequest = updateSignatureRequest(contract.id, request.id, {
    status: "DECLINED",
  })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: participant.roleFa,
    action: "contract.signature_declined",
    descriptionFa: `${participant.roleFa} از امضا خودداری کرد.`,
    metadata: { requestId: request.id, participantId: participant.id },
  });

  return ok({ participant: declined, request: toRequestDetail(updatedRequest) });
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** The challenge subject scopes a challenge to one request+participant. */
function challengeSubject(requestId: string, participantId: string): string {
  return `${requestId}:${participantId}`;
}

/** Resolve the participant from the body, defaulting to the first. */
function resolveParticipant(
  requestId: string,
  body: SignBody
): SignatureParticipant | null {
  const participants = listParticipants(requestId);
  if (body.participantId) {
    return participants.find((p) => p.id === body.participantId) ?? null;
  }
  if (body.partyId) {
    return participants.find((p) => p.partyId === body.partyId) ?? null;
  }
  return participants[0] ?? null;
}

/** Mask a mobile number for display, e.g. 0912***0003. */
function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}
