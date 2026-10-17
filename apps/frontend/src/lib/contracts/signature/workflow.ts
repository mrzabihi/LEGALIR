// ============================================================
// LEGALIR — Shared signature workflow (server-only)
// ============================================================
// ONE implementation of the signature lifecycle, called from BOTH the
// owner-session route (`/property-contracts/[id]/sign`) and the PUBLIC
// token-scoped route (`/contract-invitations/[token]`). The recipient of
// an SMS link signs on their OWN device without any LEGALIR session, so
// the logic can no longer live inside an owner-only handler.
//
// Actions:
//   create_request   freeze the current version and open a request
//   request_otp      send a one-time code to a participant's mobile
//   verify_otp       verify the code and record the signature
//   record_physical  record a wet-ink signature with its scanned proof
//   decline          record a participant's refusal
//
// A signature is bound to ONE immutable version and its SHA-256 hash.
// Before it is recorded the version's hash is RECOMPUTED from its stored
// snapshot and compared — a mismatch refuses the signature (tamper
// evidence). The OTP is never stored; the provider keeps only a hash with
// a TTL and an attempt limit, and a signature is idempotent per
// (participant, version) so a retried request cannot double-sign.
//
// The actor is passed in, not read from a session: the owner path passes
// the session user, the token path passes a participant-scoped actor. A
// `lockedParticipantId` pins the signer when the caller already knows who
// they are (a token identifies exactly one participant) so a crafted body
// can never sign on a different party's behalf.
//
// LEGAL NOTE: this is «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type {
  ContractApproval,
  ContractDocument,
  ContractParty,
  PropertyContract,
  PropertyContractState,
  PropertyContractVersion,
  SignatureParticipant,
  SignatureRequest,
  SignatureSignMethod,
} from "@legalir/types";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";
import { audit, badRequest, conflict, ok } from "@/lib/contracts/api-helpers";
import {
  getVersion,
  insertApproval,
  insertContractDocument,
  listApprovals,
  listParties,
  updateContractForUser,
} from "@/lib/contracts/db";
import { writeContractFile } from "@/lib/contracts/storage";
import { assertTransition, IllegalTransitionError, isSignable } from "@/lib/contracts/state-machine";
import { partyRoleLabelFa, signingPolicyFor } from "@/lib/contracts/registry";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { createVersion } from "@/lib/contracts/snapshot";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  insertParticipant,
  insertSignatureRequest,
  listParticipants,
  sweepExpiredRequests,
  toRequestDetail,
  updateParticipant,
  updateSignatureRequest,
} from "@/lib/contracts/signature/db";
import { activeSignatureProvider, verifyVersionIntegrity } from "@/lib/contracts/signature";
import { normalizeIranMobile } from "@legalir/validation";
import { smsConfigured } from "@/lib/sms/gateway";

export const DEFAULT_EXPIRY_HOURS = 72;

export type SignAction =
  | "create_request"
  | "request_otp"
  | "verify_otp"
  | "record_physical"
  | "decline";

export interface SignBody {
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

/** Who is performing the action — the session user or a token-scoped signer. */
export interface SignatureActor {
  userId: string;
  actorLabel: string;
}

/**
 * Everything a workflow function needs. `lockedParticipantId` pins the
 * signer for the token-scoped (public) flows, where the caller must not be
 * able to choose an arbitrary participant via the request body.
 *
 * `ownerId` is the CONTRACT OWNER's user id — the scope under which the
 * contract row is updated. It is carried separately from `actor.userId`
 * because a token-scoped signer is NOT the owner: the state advance must
 * still be written under the owner's scope, while the audit trail names
 * the real actor.
 */
export interface SignContext {
  contract: PropertyContract;
  actor: SignatureActor;
  ownerId: string;
  fingerprint: string;
  lockedParticipantId?: string;
}

// ------------------------------------------------------------
// create_request — freeze the version, open the request
// ------------------------------------------------------------

export function createSignatureRequest(
  ctx: SignContext,
  body: SignBody
): NextResponse {
  const { contract, actor, ownerId, fingerprint } = ctx;

  // The per-type signing policy is data, not code. A type whose online
  // signing is not yet allowed (a notary/registration step is mandatory —
  // sale, vehicle…) refuses here, before a version is frozen, so no
  // signature can ever be collected for it until a legal approval flips
  // the flag. The refusal carries the policy's own Persian note.
  const policy = signingPolicyFor(contract.type);
  if (!policy.onlineSigningAllowed) {
    return conflict(policy.noteFa, "ONLINE_SIGNING_DISABLED");
  }

  // A stale in-flight request is retired first, so an expired deadline
  // reads as expired rather than blocking a fresh request forever.
  sweepExpiredRequests(contract.id);

  if (activeSignatureRequest(contract.id)) {
    return conflict("یک درخواست امضا در جریان است.", "REQUEST_IN_FLIGHT");
  }

  // THE COMPULSORY GATE: a signature may only be prepared once the
  // CURRENT version carries a valid LEGALIR admin approval. This is the
  // server-side enforcement of the same invariant the UI reads — a
  // direct API call cannot issue a signature past it. It is checked
  // BEFORE the signable-state test so a call from any pre-approval state
  // (e.g. READY_FOR_REVIEW) is refused for the REAL reason, not a
  // generic "not signable".
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, currentVersion?.documentHash ?? null);
  if (!approval) {
    return conflict(
      "پیش از آماده‌سازی امضا، نسخه فعلی باید تأیید واحد بررسی حقوقی لیگالیر را دریافت کند.",
      "ADMIN_APPROVAL_REQUIRED"
    );
  }

  // With a valid, bound approval in hand, preparing the signature IS the
  // move into the signature stage. An approved contract sits in
  // ADMIN_APPROVED; the UI's "آماده‌سازی برای امضا" already offers this,
  // so the server accepts it and records the transition (ADMIN_APPROVED →
  // READY_TO_SIGN) as part of opening the request. Any other state must
  // still be genuinely signable.
  const approvalUnlocksSigning =
    contract.state === "ADMIN_APPROVED" ||
    contract.state === "READY_FOR_REVIEW" ||
    contract.state === "COUNTERPARTY_REVIEW";
  if (!approvalUnlocksSigning && !isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  // Freeze the content as a new immutable version. Every signature in
  // this request binds to this version and its hash. Because the
  // snapshot is deterministic, freezing the approved content reproduces
  // the approved hash, so the signed version is exactly the reviewed one.
  const { version } = createVersion(contract, actor.userId);

  // Persist the move into the signature stage so the contract state
  // agrees with the request that was just opened.
  let working = contract;
  if (contract.state !== "READY_TO_SIGN" && !isSignable(contract.state)) {
    const next: PropertyContractState = "READY_TO_SIGN";
    try {
      assertTransition(contract.state, next);
      working = updateContractForUser(ownerId, contract.id, { state: next }) ?? contract;
    } catch (err) {
      if (!(err instanceof IllegalTransitionError)) throw err;
    }
  }

  const parties = listParties(contract.id);
  const selected = body.partyId
    ? parties.filter((p) => p.id === body.partyId)
    : body.guests && body.guests.length > 0
      ? parties.filter((p) => p.isInitiator)
      : parties;

  if (selected.length === 0) return badRequest("طرف امضاکننده مشخص نیست", "NO_PARTY");

  // Every signer must have a valid mobile — normalize to canonical E.164
  // before it becomes a participant, so the OTP provider and the stored
  // participant row agree on one identity regardless of input format.
  for (const party of selected) {
    if (!normalizeIranMobile(party.identity.mobile)) {
      return badRequest("شماره موبایل یکی از طرفین معتبر نیست", "INVALID_MOBILE");
    }
  }
  for (const guest of body.guests ?? []) {
    if (!normalizeIranMobile(guest.mobile)) {
      return badRequest("شماره موبایل یکی از امضاکنندگان معتبر نیست", "INVALID_MOBILE");
    }
  }

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
    createdBy: actor.userId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
  };
  insertSignatureRequest(request);

  const participants: SignatureParticipant[] = [];
  for (const party of selected) {
    participants.push(
      insertParticipant(
        buildParticipant(request, party, normalizeIranMobile(party.identity.mobile)!)
      )
    );
  }
  for (const guest of body.guests ?? []) {
    participants.push(
      insertParticipant(
        buildParticipant(request, null, normalizeIranMobile(guest.mobile)!, guest.roleFa)
      )
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
    clientFingerprint: fingerprint,
  });

  // The request is now dispatched to every participant — one open row
  // per signer, each with its own mobile. Recorded as its own event so
  // the trail distinguishes "created" from "sent" (§9).
  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: null,
    type: "REQUEST_SENT",
    descriptionFa: `درخواست امضا برای ${participants.length} طرف ارسال شد.`,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    clientFingerprint: fingerprint,
  });

  audit({
    contractId: contract.id,
    actorId: actor.userId,
    actorLabel: actor.actorLabel,
    action: "signature.request_created",
    descriptionFa: `درخواست امضا برای نسخه ${version.versionNumber} ایجاد شد.`,
    metadata: { requestId: request.id, versionId: version.id, participants: participants.length },
  });

  return ok({ request: toRequestDetail(request), version, contract: working });
}

/** Build a participant row for a party or a guest signer. */
export function buildParticipant(
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
    nameFa: party ? partyDisplayName(party) : "",
    mobileMasked: maskMobile(mobile),
    mobile,
    status: "PENDING",
    viewedAt: null,
    signedAt: null,
    signedMethod: null,
    proofDocumentId: null,
    declinedAt: null,
    declineReason: null,
    createdAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// request_otp — send a challenge to a participant
// ------------------------------------------------------------

export async function requestOtpForParticipant(
  ctx: SignContext,
  body: SignBody
): Promise<NextResponse> {
  const { contract, fingerprint } = ctx;

  // Retire an overdue request FIRST, so an expired deadline is reported
  // as expired rather than letting a stale request through.
  const swept = sweepExpiredRequests(contract.id);
  const request = activeSignatureRequest(contract.id);
  if (!request) {
    if (swept > 0) {
      return conflict("مهلت امضای این درخواست به پایان رسیده است.", "REQUEST_EXPIRED");
    }
    return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");
  }
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  const participant = resolveParticipant(request.id, body, ctx.lockedParticipantId);
  if (!participant) return badRequest("امضاکننده مشخص نیست", "NO_PARTICIPANT");
  if (participant.status === "SIGNED") {
    return conflict("این طرف قبلاً امضا کرده است.", "ALREADY_SIGNED");
  }
  if (!participant.mobile.trim()) {
    return badRequest("شماره موبایل این طرف ثبت نشده است.", "NO_MOBILE");
  }

  const provider = activeSignatureProvider();
  const issued = await provider.requestChallenge({
    subject: challengeSubject(request.id, participant.id),
    mobile: participant.mobile,
  });

  // The provider reports the REAL send outcome. A challenge that was not
  // delivered is recorded as a failure and surfaced to the caller — the
  // route never claims a code was sent when it was not (§8).
  if (!issued.sent) {
    const sms = { configured: smsConfigured() };
    appendSignatureEvent({
      signatureRequestId: request.id,
      contractId: contract.id,
      participantId: participant.id,
      type: "OTP_FAILED",
      descriptionFa: "ارسال کد تأیید ناموفق بود.",
      contractVersionId: request.contractVersionId,
      documentHash: request.documentHash,
      authMethod: "OTP_SMS",
      clientFingerprint: fingerprint,
      metadata: { stage: "request", reason: sms.configured ? "PROVIDER_ERROR" : "NOT_CONFIGURED" },
    });
    return NextResponse.json(
      {
        code: sms.configured ? "OTP_SEND_FAILED" : "SMS_NOT_CONFIGURED",
        message: sms.configured
          ? "ارسال کد تأیید ناموفق بود؛ شماره دیگری امتحان کنید یا کمی بعد تلاش کنید."
          : "سامانهٔ پیامک پیکربندی نشده است؛ ارسال کد تأیید ممکن نیست.",
        retryable: sms.configured,
        sms,
      },
      { status: 409 }
    );
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
    clientFingerprint: fingerprint,
    metadata: { channel: issued.channel },
  });

  return ok({
    sent: true,
    /** The real transport — `dev-console` is NOT an SMS to a phone. */
    channel: issued.channel,
    mobileMasked: issued.destinationMasked,
    expiresAt: issued.expiresAt,
    remainingAttempts: issued.remainingAttempts,
  });
}

// ------------------------------------------------------------
// verify_otp — verify the code and record the signature
// ------------------------------------------------------------

export function verifyOtpForParticipant(
  ctx: SignContext,
  body: SignBody
): NextResponse {
  const { contract, actor, fingerprint } = ctx;

  const swept = sweepExpiredRequests(contract.id);
  const request = activeSignatureRequest(contract.id);
  if (!request) {
    if (swept > 0) {
      return conflict("مهلت امضای این درخواست به پایان رسیده است.", "REQUEST_EXPIRED");
    }
    return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");
  }
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  const participant = resolveParticipant(request.id, body, ctx.lockedParticipantId);
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
      clientFingerprint: fingerprint,
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
      authMethod: "OTP_SMS",
      clientFingerprint: fingerprint,
      metadata: { code: verified.code },
    });
    return badRequest(verified.messageFa ?? "کد وارد شده صحیح نیست.", verified.code ?? "OTP_INVALID");
  }

  appendSignatureEvent({
    signatureRequestId: request.id,
    contractId: contract.id,
    participantId: participant.id,
    type: "OTP_VERIFIED",
    descriptionFa: `کد تأیید ${participant.roleFa} پذیرفته شد.`,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    authMethod: "OTP_SMS",
    clientFingerprint: fingerprint,
  });

  return commitSignature({
    actor,
    ownerId: ctx.ownerId,
    contract,
    request,
    participant,
    version,
    method: "OTP_ELECTRONIC",
    approvalMethod: "otp",
    approvalComment: "تأیید و امضای الکترونیکی",
    signatureDescriptionFa: `${participant.roleFa} قرارداد را امضا کرد (نسخه ${version.versionNumber}).`,
    authMethod: "OTP_SMS",
    fingerprint,
    proofDocumentId: null,
    metadata: {
      consentVersion: body.consentVersion ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    },
  });
}

// ------------------------------------------------------------
// record_physical — a wet-ink signature with its scanned proof
// ------------------------------------------------------------
// A party who signs on a printed copy uploads the scan. The scan is
// stored as a private contract document (never a public URL) and the
// participant is recorded as signed by PHYSICAL_WET_INK, bound to the
// same immutable version and hash as an OTP signature.

export async function recordPhysicalForParticipant(
  ctx: SignContext,
  form: FormData
): Promise<NextResponse> {
  const { contract, actor, fingerprint } = ctx;

  const swept = sweepExpiredRequests(contract.id);
  const request = activeSignatureRequest(contract.id);
  if (!request) {
    if (swept > 0) {
      return conflict("مهلت امضای این درخواست به پایان رسیده است.", "REQUEST_EXPIRED");
    }
    return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");
  }
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }

  const participants = listParticipants(request.id);
  const participantId = ctx.lockedParticipantId ?? String(form.get("participantId") ?? "");
  const participant = participantId
    ? participants.find((p) => p.id === participantId) ?? null
    : participants[0] ?? null;
  if (!participant) return badRequest("امضاکننده مشخص نیست", "NO_PARTICIPANT");
  if (participant.status === "SIGNED") {
    return conflict("این طرف قبلاً امضا کرده است.", "ALREADY_SIGNED");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("اسکن نسخه امضاشده بارگذاری نشده است.", "NO_FILE");
  }
  if (!(SUPPORTED_DOCUMENT_MIMES as readonly string[]).includes(file.type)) {
    return badRequest("فرمت فایل پشتیبانی نمی‌شود", "UNSUPPORTED_FORMAT");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return badRequest("حجم فایل بیش از حد مجاز است", "FILE_TOO_LARGE");
  }

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
      clientFingerprint: fingerprint,
      metadata: { recomputed: integrity.recomputed, recorded: integrity.recorded },
    });
    return conflict("محتوای نسخه تغییر کرده است؛ امضا ممکن نیست.", "INTEGRITY_FAILED");
  }

  const documentId = `doc-${crypto.randomUUID()}`;
  let stored;
  try {
    stored = writeContractFile({
      contractId: contract.id,
      documentId,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  } catch {
    return badRequest("ذخیره فایل ناموفق بود", "STORAGE_FAILED");
  }

  const doc: ContractDocument = {
    id: documentId,
    contractId: contract.id,
    category: "signed_scan",
    fileName: file.name,
    mime: file.type,
    sizeBytes: stored.sizeBytes,
    storageKey: stored.storageKey,
    hash: stored.hash,
    description: `اسکن نسخه امضاشدهٔ ${participant.roleFa}`,
    photoCategory: null,
    uploadedBy: actor.userId,
    uploadedAt: new Date().toISOString(),
  };
  insertContractDocument(doc);

  return commitSignature({
    actor,
    ownerId: ctx.ownerId,
    contract,
    request,
    participant,
    version,
    method: "PHYSICAL_WET_INK",
    approvalMethod: "physical",
    approvalComment: "امضای دستی روی نسخه چاپی",
    signatureDescriptionFa: `${participant.roleFa} نسخه چاپی قرارداد را امضا و اسکن آن را بارگذاری کرد (نسخه ${version.versionNumber}).`,
    authMethod: "PHYSICAL_WET_INK",
    fingerprint,
    proofDocumentId: documentId,
    metadata: { proofDocumentId: documentId, method: "PHYSICAL_WET_INK" },
  });
}

// ------------------------------------------------------------
// commitSignature — the shared record-a-signature tail
// ------------------------------------------------------------
// Verify-OTP and record-physical differ only in how the signature was
// proven; everything that follows — the participant row, the bound
// approval, the events, the request completion and the state advance —
// is identical and lives here once.

interface CommitSignatureParams {
  actor: SignatureActor;
  ownerId: string;
  contract: PropertyContract;
  request: SignatureRequest;
  participant: SignatureParticipant;
  version: PropertyContractVersion;
  method: SignatureSignMethod;
  approvalMethod: ContractApproval["method"];
  approvalComment: string;
  signatureDescriptionFa: string;
  authMethod: string;
  fingerprint: string;
  proofDocumentId: string | null;
  metadata: Record<string, unknown>;
}

function commitSignature(p: CommitSignatureParams): NextResponse {
  const now = new Date().toISOString();
  const signed = updateParticipant(p.participant.id, {
    status: "SIGNED",
    signedAt: now,
    signedMethod: p.method,
    proofDocumentId: p.proofDocumentId,
  })!;

  // Record the signature as an approval bound to this exact version.
  const existing = listApprovals(p.contract.id).find(
    (a) => a.partyId === p.participant.partyId && a.contractVersionId === p.version.id
  );
  const signature: ContractApproval = {
    id: existing?.id ?? `apr-${crypto.randomUUID()}`,
    contractId: p.contract.id,
    contractVersionId: p.version.id,
    partyId: p.participant.partyId ?? p.participant.id,
    status: "approved",
    comment: p.approvalComment,
    method: p.approvalMethod,
    approvedAt: now,
    createdAt: existing?.createdAt ?? now,
  };
  insertApproval(signature);

  appendSignatureEvent({
    signatureRequestId: p.request.id,
    contractId: p.contract.id,
    participantId: p.participant.id,
    type: "SIGNED",
    descriptionFa: p.signatureDescriptionFa,
    contractVersionId: p.version.id,
    documentHash: p.version.documentHash,
    authMethod: p.authMethod,
    clientFingerprint: p.fingerprint,
    metadata: p.metadata,
  });

  // The request completes when every participant has signed.
  const allSigned = listParticipants(p.request.id).every((x) => x.status === "SIGNED");
  const updatedRequest = updateSignatureRequest(p.contract.id, p.request.id, {
    status: allSigned ? "COMPLETED" : "PARTIALLY_SIGNED",
    completedAt: allSigned ? now : null,
  })!;

  if (allSigned) {
    appendSignatureEvent({
      signatureRequestId: p.request.id,
      contractId: p.contract.id,
      participantId: null,
      type: "REQUEST_COMPLETED",
      descriptionFa: "همه طرفین قرارداد را امضا کردند.",
      contractVersionId: p.version.id,
      documentHash: p.version.documentHash,
      clientFingerprint: p.fingerprint,
    });
  }

  // Advance the contract state. Signing only ever moves to SIGNED; the
  // registration-policy state is the finalize step's job.
  let nextState = p.contract.state;
  if (allSigned) nextState = "SIGNED";
  else if (p.contract.state === "READY_TO_SIGN") nextState = "PARTIALLY_SIGNED";

  let updated = p.contract;
  if (nextState !== p.contract.state) {
    try {
      assertTransition(p.contract.state, nextState);
      updated = updateContractForUser(p.ownerId, p.contract.id, { state: nextState }) ?? p.contract;
    } catch (err) {
      if (!(err instanceof IllegalTransitionError)) throw err;
    }
  }

  audit({
    contractId: p.contract.id,
    actorId: p.actor.userId,
    actorLabel: p.participant.roleFa,
    action: "contract.signed",
    descriptionFa: p.signatureDescriptionFa,
    metadata: {
      requestId: p.request.id,
      versionId: p.version.id,
      documentHash: p.version.documentHash,
      participantId: p.participant.id,
      method: p.method,
      proofDocumentId: p.proofDocumentId,
      allSigned,
    },
  });

  return ok({
    participant: signed,
    request: toRequestDetail(updatedRequest),
    contract: updated,
    allSigned,
    assuranceLevel: p.request.assuranceLevel,
  });
}

// ------------------------------------------------------------
// decline — record a refusal
// ------------------------------------------------------------

export function declineForParticipant(
  ctx: SignContext,
  body: SignBody
): NextResponse {
  const { contract, actor, fingerprint } = ctx;

  const request = activeSignatureRequest(contract.id);
  if (!request) return conflict("درخواست امضایی در جریان نیست.", "NO_REQUEST");

  const participant = resolveParticipant(request.id, body, ctx.lockedParticipantId);
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
    clientFingerprint: fingerprint,
    metadata: { reason: body.reason ?? null },
  });

  const updatedRequest = updateSignatureRequest(contract.id, request.id, {
    status: "DECLINED",
  })!;

  audit({
    contractId: contract.id,
    actorId: actor.userId,
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

/**
 * Resolve the participant from the request body, defaulting to the first.
 * A `lockedParticipantId` (token-scoped flows) wins over the body so a
 * crafted body cannot redirect a signature to another party.
 */
function resolveParticipant(
  requestId: string,
  body: SignBody,
  lockedParticipantId?: string
): SignatureParticipant | null {
  const participants = listParticipants(requestId);
  if (lockedParticipantId) {
    return participants.find((p) => p.id === lockedParticipantId) ?? null;
  }
  if (body.participantId) {
    return participants.find((p) => p.id === body.participantId) ?? null;
  }
  if (body.partyId) {
    return participants.find((p) => p.partyId === body.partyId) ?? null;
  }
  return participants[0] ?? null;
}

/** The human name of a party row, for labels outside the document. */
export function partyDisplayName(party: ContractParty): string {
  if (party.personKind === "legal") {
    return party.identity.companyName?.trim() || "شخص حقوقی";
  }
  return [party.identity.firstName, party.identity.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/** Mask a mobile number for display, e.g. 0912***0003. */
export function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}
