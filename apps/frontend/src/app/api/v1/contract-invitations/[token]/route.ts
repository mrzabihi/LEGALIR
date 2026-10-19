// ============================================================
// LEGALIR — /api/v1/contract-invitations/[token]  (PUBLIC, no session)
// ============================================================
// The PUBLIC face of a signature invitation. The recipient of a
// signature SMS opens this link with the one-time token — NO session is
// required, so the link must disclose the minimum: the contract's
// reference code, its type, the recipient's role and the deadline.
// Never the contract body, never another party's data.
//
//   GET  — resolve the invitation and report whether it is still usable.
//   POST — act on the invitation. The token LOCKS the participant, so a
//          crafted body can never sign for a different party:
//
//            open           record that the document was opened (VIEWED)
//            request_review ask LEGALIR's legal AI or a specialised
//                           lawyer to review THIS version — optional,
//                           never blocks signing
//            request_otp    send a one-time code to the SIGNER's own mobile
//            verify_otp     verify the code and RECORD the signature
//            decline        record a refusal
//
// A token is SINGLE-USE for TERMINAL acts: it is consumed when a
// signature is recorded or a refusal is declared, so the same link can
// never record two signatures (no double-sign). `open`, the optional
// review request and the OTP steps do NOT consume it — the recipient
// needs the same link to read the document, ask for a review and then
// sign.
//
// Only the SHA-256 HASH of the token is ever stored, so this route
// hashes the incoming token and looks the invitation up by that hash —
// a leaked database cannot be replayed against this endpoint.
//
// LEGAL NOTE: this is «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { InvitationStatus, LawyerReviewRequest } from "@legalir/types";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  findInvitationByTokenHash,
  getParticipant,
  getSignatureRequest,
  sweepExpiredRequests,
  updateInvitation,
  updateParticipant,
} from "@/lib/contracts/signature/db";
import { getContractById, getVersion } from "@/lib/contracts/db";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { currentVersionStamp } from "@/lib/contracts/stamp-review";
import { signingPolicyFor } from "@/lib/contracts/registry";
import { stateLabelFa } from "@/lib/contracts/state-machine";
import { renderContract } from "@/lib/contracts/template";
import {
  activeLawyerReview,
  insertLawyerReview,
  insertReviewComment,
} from "@/lib/contracts/review-db";

import { insertAiReview } from "@/lib/contracts/review-db";
import { listLawyerProfiles } from "@/lib/lawyer-db";
import { audit, badRequest, ok } from "@/lib/contracts/api-helpers";
import { readConversations, writeConversations, type StoredConversation } from "@/lib/db";
import { appendMessage } from "@/lib/ai/store";
import { classifyMessage } from "@/lib/ai/pipeline/classify";
import type { AiContractReview } from "@legalir/types";
import {
  declineForParticipant,
  requestOtpForParticipant,
  verifyOtpForParticipant,
  type SignBody,
  type SignContext,
} from "@/lib/contracts/signature/workflow";
import { clientFingerprintFrom } from "@/lib/contracts/signature/fingerprint";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";

interface Params {
  params: Promise<{ token: string }>;
}

/** A short response for a token that cannot be used, with a Persian reason. */
function unusable(code: string, message: string, status = 410) {
  return NextResponse.json({ code, message }, { status });
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve an invitation by raw token, expiring it (and its request) when
 * its deadline has passed. Returns either the invitation or a response
 * describing why it cannot be used.
 */
function resolveToken(rawToken: string) {
  const invitation = findInvitationByTokenHash(hashToken(rawToken));
  if (!invitation) {
    return { error: unusable("NOT_FOUND", "این دعوت‌نامه معتبر نیست یا منقضی شده است.", 404) };
  }

  const contract = getContractById(invitation.contractId);
  if (!contract) {
    return { error: unusable("NOT_FOUND", "قرارداد مربوط به این دعوت‌نامه یافت نشد.", 404) };
  }

  if (invitation.status === "REVOKED") {
    return { error: unusable("REVOKED", "این دعوت‌نامه لغو شده است.") };
  }
  if (invitation.status === "USED") {
    return { error: unusable("USED", "این دعوت‌نامه قبلاً استفاده شده است.") };
  }

  const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
  if (expired || invitation.status === "EXPIRED") {
    if (invitation.status !== "EXPIRED") {
      updateInvitation(invitation.id, { status: "EXPIRED" });
      // Retire the in-flight request too and log the real reason (§9).
      sweepExpiredRequests(invitation.contractId);
      appendSignatureEvent({
        signatureRequestId: invitation.signatureRequestId,
        contractId: invitation.contractId,
        participantId: invitation.participantId,
        type: "REQUEST_EXPIRED",
        descriptionFa: "مهلت دعوت‌نامه امضا به پایان رسید.",
        contractVersionId: null,
        documentHash: null,
        metadata: { invitationId: invitation.id },
      });
    }
    return { error: unusable("EXPIRED", "مهلت این دعوت‌نامه به پایان رسیده است.") };
  }

  return { invitation, contract };
}

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const resolved = resolveToken(token);
  if ("error" in resolved) return resolved.error;

  const { invitation, contract } = resolved;
  const participant = getParticipant(invitation.participantId);
  const policy = signingPolicyFor(contract.type);

  // Whether this invitation can still record a signature. A participant
  // who has already signed or declined is done; the token is then also
  // consumed, so this is a belt-and-braces check.
  const canSign =
    isContractFeatureEnabled("CONTRACT_SIGNING_ENABLED") &&
    policy.onlineSigningAllowed &&
    !!participant &&
    participant.status !== "SIGNED" &&
    participant.status !== "DECLINED";

  // The recipient views the EXACT frozen version this invitation was
  // issued for — rendered from the snapshot, never from the mutable
  // working data — so the text they read is the text they sign.
  const signatureRequest = getSignatureRequest(contract.id, invitation.signatureRequestId);
  const version = signatureRequest
    ? getVersion(contract.id, signatureRequest.contractVersionId)
    : null;
  const rendered = version
    ? renderContract(
        { ...contract, data: version.snapshot.data },
        version.snapshot.parties,
        version.snapshot.payments
      )
    : null;

  // A document is a draft until the contract is finalized by the final
  // super-admin approval. A signed-but-not-finalized version is STILL a
  // draft: the watermark is derived from stored state, never from the UI.
  const draft = contract.state !== "FINALIZED" && contract.state !== "ARCHIVED";

  // The review mark this version may show — read from the SAME gates the
  // PDF route uses, so the sheet the party reads and the file they sign
  // can never disagree. The seal/hologram images are served by the
  // sibling `stamp-asset` route under this same token, because a signer
  // may have no session at all and the owner route is session-scoped.
  const approval = version ? currentVersionApproval(contract, version.documentHash) : null;
  const official = version ? currentVersionStamp(contract, version.documentHash) : null;
  const stamp = approval
    ? {
        applied: true as const,
        reviewedAt: approval.decidedAt ?? null,
        reviewingOfficeFa: approval.reviewingOfficeFa,
        reviewerInitials: approval.reviewerInitials,
        reviewId: approval.id,
        official: official !== null,
        sealHref: official
          ? `/api/v1/contract-invitations/${encodeURIComponent(token)}/stamp-asset/seal`
          : undefined,
        hologramHref: official
          ? `/api/v1/contract-invitations/${encodeURIComponent(token)}/stamp-asset/hologram`
          : undefined,
        approvedByLabelFa: official?.approvedByLabelFa ?? null,
        approvedAt: official?.appliedAt ?? null,
      }
    : { applied: false as const };

  return NextResponse.json({
    data: {
      referenceCode: contract.referenceCode,
      typeFa: contract.typeFa,
      title: contract.title,
      roleFa: participant?.roleFa ?? "امضاکننده",
      recipientMasked: invitation.recipientMasked,
      expiresAt: invitation.expiresAt,
      verifyBeforeView: invitation.verifyBeforeView,
      status: invitation.status as InvitationStatus,
      // Sign-relevant state (additive).
      participantStatus: participant?.status ?? null,
      canSign,
      onlineSigningAllowed: policy.onlineSigningAllowed,
      signingPolicyNoteFa: policy.noteFa,
      // The document itself, from the immutable version snapshot.
      document:
        rendered && version
          ? {
              rendered,
              meta: {
                typeFa: contract.typeFa,
                referenceCode: contract.referenceCode,
                contractDateIso: contract.createdAt,
                templateVersion: version.templateVersion,
              },
              versionNumber: version.versionNumber,
              documentHash: version.documentHash,
              draft,
              // The public sheet prints a human state («در انتظار امضا»),
              // never a raw enum key such as «SIGNED».
              stateFa: stateLabelFa(contract.state),
              // Only the recipient's own signature state is disclosed; the
              // other party's actions are never exposed on this link.
              signatureMarks: participant
                ? {
                    [participant.roleFa]: {
                      signedAt: participant.signedAt,
                      statusFa:
                        participant.status === "SIGNED"
                          ? "امضا شده"
                          : participant.status === "DECLINED"
                            ? "خودداری کرده"
                            : "در انتظار امضا",
                    },
                  }
                : {},
            }
          : null,
      // The same review/official mark the PDF draws, so the on-screen
      // A4 sheet is not a different document from the file being signed.
      stamp,
      pdfHref: `/api/v1/contract-invitations/${encodeURIComponent(token)}/pdf`,
    },
  });
}

/** The action a POST body requests; `open` is the default. */
type TokenAction = "open" | "request_review" | "request_otp" | "verify_otp" | "decline";

interface TokenBody {
  action?: TokenAction;
  /** For `request_review`: which optional review the recipient wants. */
  reviewKind?: "ai" | "lawyer";
  /** The recipient's own note to the drafter, recorded separately. */
  note?: string;
  code?: string;
  consentGiven?: boolean;
  consentVersion?: string;
  idempotencyKey?: string;
  reason?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const resolved = resolveToken(token);
  if ("error" in resolved) return resolved.error;

  const { invitation, contract } = resolved;
  const fingerprint = clientFingerprintFrom(request);

  // The body is optional for the legacy `open` action (a bare POST).
  const contentType = request.headers.get("content-type") ?? "";
  let body: TokenBody = {};
  if (contentType.includes("application/json")) {
    try {
      body = (await request.json()) as TokenBody;
    } catch {
      body = {};
    }
  }
  const action: TokenAction = body.action ?? "open";

  const participant = getParticipant(invitation.participantId);
  if (!participant) {
    return unusable("NOT_FOUND", "امضاکننده این دعوت‌نامه یافت نشد.", 404);
  }

  // `open` records that the document was opened. It is idempotent and
  // does NOT consume the token — the signer still needs the link for the
  // review request and the OTP steps that follow.
  if (action === "open") return openInvitation(invitation, participant, contract, fingerprint);

  // The optional review paths are NOT signing, so the signing gates do
  // not apply to them: a recipient may ask for a review even when online
  // signing is disabled for their contract type.
  if (action === "request_review") {
    return requestReviewFromRecipient(invitation, participant, contract, body, fingerprint);
  }

  // Every remaining action signs or declines, so the feature + policy
  // gates apply first, exactly as the owner-session route enforces them.
  if (!isContractFeatureEnabled("CONTRACT_SIGNING_ENABLED")) {
    return unusable("FEATURE_DISABLED", "امضای الکترونیکی در حال حاضر فعال نیست.", 409);
  }
  const policy = signingPolicyFor(contract.type);
  if (!policy.onlineSigningAllowed) {
    return unusable("ONLINE_SIGNING_DISABLED", policy.noteFa, 409);
  }

  // The request the invitation was issued against must still be the
  // active one — a superseded version cancels it, and a token bound to a
  // cancelled request can never sign.
  const activeRequest = activeSignatureRequest(contract.id);
  if (!activeRequest || activeRequest.id !== invitation.signatureRequestId) {
    return unusable("REQUEST_INACTIVE", "این درخواست امضا دیگر فعال نیست.", 409);
  }

  // The token LOCKS the participant: the actor's identity is derived
  // from the token, never from the body, so a crafted body cannot sign
  // on another party's behalf (IDOR).
  const actorLabel = participant.roleFa;
  const signCtx: SignContext = {
    contract,
    // The token-scoped signer is NOT the owner; a synthetic, non-user
    // actor id keeps the audit trail honest without implying a session.
    actor: { userId: `invitee:${participant.id}`, actorLabel },
    ownerId: contract.userId,
    fingerprint,
    lockedParticipantId: participant.id,
  };

  // The participant is locked by the token, so the signer's identity is
  // never taken from the body — only the fields that describe the act
  // itself are forwarded.
  const signBody: SignBody = {
    code: body.code,
    consentGiven: body.consentGiven,
    consentVersion: body.consentVersion,
    idempotencyKey: body.idempotencyKey,
    reason: body.reason,
  };

  const result =
    action === "request_otp"
      ? await requestOtpForParticipant(signCtx, signBody)
      : action === "verify_otp"
        ? verifyOtpForParticipant(signCtx, signBody)
        : action === "decline"
          ? declineForParticipant(signCtx, signBody)
          : unusable("INVALID_ACTION", "عملیات درخواستی معتبر نیست.", 400);

  // The token is consumed only when the participant has terminally acted
  // — a recorded signature or a refusal. A failed OTP attempt leaves the
  // invitation usable so the signer can retry.
  if (result.status === 200) {
    const after = getParticipant(participant.id);
    if (after && (after.status === "SIGNED" || after.status === "DECLINED")) {
      updateInvitation(invitation.id, { status: "USED", usedAt: new Date().toISOString() });
    }
  }

  return result;
}

/**
 * Record that the recipient opened the document: move a PENDING
 * participant to VIEWED (never downgrading a SIGNED/DECLINED one) and
 * append a DOCUMENT_VIEWED event. The token is NOT consumed — reading
 * the document is not a terminal act, and the same link must remain
 * usable for the optional review request and the signature.
 */
function openInvitation(
  invitation: { id: string; signatureRequestId: string; contractId: string; participantId: string },
  participant: { id: string; roleFa: string; status: string },
  contract: { referenceCode: string },
  fingerprint: string
) {
  const now = new Date().toISOString();

  if (participant.status === "PENDING") {
    updateParticipant(participant.id, { status: "VIEWED", viewedAt: now });
  }

  appendSignatureEvent({
    signatureRequestId: invitation.signatureRequestId,
    contractId: invitation.contractId,
    participantId: invitation.participantId,
    type: "DOCUMENT_VIEWED",
    descriptionFa: `${participant.roleFa} سند را از طریق دعوت‌نامه باز کرد.`,
    contractVersionId: null,
    documentHash: null,
    clientFingerprint: fingerprint,
    metadata: { invitationId: invitation.id },
  });

  return NextResponse.json({
    data: {
      referenceCode: contract.referenceCode,
      viewed: true,
      viewedAt: now,
    },
  });
}

/**
 * The receipt-side OPTIONAL reviews: ask LEGALIR's legal AI or a
 * specialised lawyer to look at THIS version.
 *
 * Neither is compulsory and neither blocks signing — the recipient can
 * ignore both and continue straight to the signature. Nothing here edits
 * the contract text: a review produces an OPINION that the drafter must
 * explicitly accept (via the normal edit path, which creates a new
 * version), so version supremacy is never bypassed (§4/§5).
 *
 * The recipient's optional note is recorded as a PARTY-VISIBILITY review
 * comment — separate from the drafter's internal notes — so it can never
 * be mistaken for a clause or an approval.
 */
function requestReviewFromRecipient(
  invitation: {
    id: string;
    signatureRequestId: string;
    contractId: string;
    participantId: string;
  },
  participant: { id: string; roleFa: string },
  contract: {
    id: string;
    type: string;
    domain: string;
    userId: string;
    referenceCode: string;
    title: string;
    currentVersionId: string | null;
  },
  body: TokenBody,
  fingerprint: string
) {
  const request = getSignatureRequest(contract.id, invitation.signatureRequestId);
  if (!request) {
    return unusable("REQUEST_INACTIVE", "این درخواست امضا دیگر فعال نیست.", 409);
  }

  const note = body.note?.trim();
  let commentId: string | null = null;
  if (note) {
    const comment = insertReviewComment({
      contractId: contract.id,
      contractVersionId: request.contractVersionId,
      partyId: null,
      authorLabelFa: participant.roleFa,
      authorKind: "party",
      visibility: "parties",
      kind: "comment",
      body: note,
      clauseRef: null,
    });
    commentId = comment.id;
  }

  // A note without a review is valid on its own: the recipient may simply
  // want to tell the drafter something. It is stored as a party-visibility
  // comment, never as a clause or an approval.
  if (!body.reviewKind) {
    if (!commentId) return badRequest("نوع بررسی مشخص نیست", "INVALID_BODY");
    return ok({ reviewKind: null, commentId });
  }

  if (body.reviewKind === "lawyer") {
    // A lawyer review is per contract, not per recipient: if one is
    // already in flight the recipient is pointed at it instead of a
    // duplicate being opened.
    const active = activeLawyerReview(contract.id);
    if (active) {
      appendSignatureEvent({
        signatureRequestId: invitation.signatureRequestId,
        contractId: contract.id,
        participantId: invitation.participantId,
        type: "DOCUMENT_VIEWED",
        descriptionFa: `${participant.roleFa} درخواست بررسی حقوقی داد؛ بررسی در جریان موجود است.`,
        contractVersionId: request.contractVersionId,
        documentHash: request.documentHash,
        clientFingerprint: fingerprint,
        metadata: { reviewKind: "lawyer", reviewId: active.id, reused: true, commentId },
      });
      return ok({ reviewKind: "lawyer", reviewId: active.id, reused: true });
    }

    const category = contract.domain;
    const match = listLawyerProfiles().find(
      (l) =>
        l.verificationStatus === "VERIFIED" &&
        l.acceptingRequests &&
        l.specializations.some((s) => s.category === category)
    );

    const now = new Date().toISOString();
    const review: LawyerReviewRequest = {
      id: `lrev-${crypto.randomUUID()}`,
      contractId: contract.id,
      contractVersionId: request.contractVersionId,
      documentHash: request.documentHash,
      // The requester is the invitee, not the owner — the audit trail
      // must name the party who actually asked.
      requestedBy: `invitee:${participant.id}`,
      lawyerId: match?.id ?? null,
      lawyerNameFa: match?.fullName ?? null,
      mode: "NON_BLOCKING",
      state: match ? "AWAITING_ACCEPTANCE" : "MATCHING",
      category,
      slaHours: 48,
      slaStartedAt: null,
      slaDueAt: null,
      summaryFa: null,
      // A recipient-requested review NEVER blocks the drafter's signing.
      blocksSigning: false,
      requestedAt: now,
      acceptedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    insertLawyerReview(review);

    appendSignatureEvent({
      signatureRequestId: invitation.signatureRequestId,
      contractId: contract.id,
      participantId: invitation.participantId,
      type: "DOCUMENT_VIEWED",
      descriptionFa: `${participant.roleFa} درخواست بررسی توسط وکیل متخصص داد.`,
      contractVersionId: request.contractVersionId,
      documentHash: request.documentHash,
      clientFingerprint: fingerprint,
      metadata: { reviewKind: "lawyer", reviewId: review.id, commentId },
    });

    audit({
      contractId: contract.id,
      actorId: `invitee:${participant.id}`,
      actorLabel: participant.roleFa,
      action: "lawyer_review.requested_by_party",
      descriptionFa: `${participant.roleFa} از طریق دعوت‌نامه درخواست بررسی حقوقی داد.`,
      metadata: { reviewId: review.id, category, commentId },
    });

    return ok({
      reviewKind: "lawyer",
      reviewId: review.id,
      reused: false,
      matched: match !== undefined,
      lawyerNameFa: match?.fullName ?? null,
    });
  }

  if (body.reviewKind === "ai") {
    // The AI review attaches the contract to the EXISTING Legalier
    // conversation pipeline. The recipient gets a pointer to a
    // conversation bound to this version; the analysis is clearly AI,
    // never a lawyer's opinion.
    const aiReview = createPartyAiReview(contract, participant, request);
    appendSignatureEvent({
      signatureRequestId: invitation.signatureRequestId,
      contractId: contract.id,
      participantId: invitation.participantId,
      type: "DOCUMENT_VIEWED",
      descriptionFa: `${participant.roleFa} پرسش از دستیار هوشمند حقوقی را انتخاب کرد.`,
      contractVersionId: request.contractVersionId,
      documentHash: request.documentHash,
      clientFingerprint: fingerprint,
      metadata: { reviewKind: "ai", reviewId: aiReview.id, commentId },
    });
    return ok({
      reviewKind: "ai",
      reviewId: aiReview.id,
      conversationId: aiReview.conversationId,
      summaryFa: aiReview.summaryFa,
    });
  }

  return badRequest("نوع بررسی مشخص نیست", "INVALID_BODY");
}

/**
 * Run the AI review through the EXISTING Legalier conversation
 * pipeline for a recipient who has no session. The conversation belongs
 * to the contract OWNER (the only persisted conversation scope), and the
 * review is labelled as AI analysis in both the record and the message.
 */
function createPartyAiReview(
  contract: { id: string; userId: string; referenceCode: string; title: string; domain: string },
  participant: { id: string; roleFa: string },
  request: { contractVersionId: string; documentHash: string }
): AiContractReview {
  const now = new Date().toISOString();
  const conversation = resolveOwnerConversation(contract);
  const perspectiveRoleFa = participant.roleFa;

  const question = `این قرارداد را از دید «${perspectiveRoleFa}» بررسی کن و مهم‌ترین ریسک‌ها و بندهای ناقص را فهرست کن.`;
  const classification = classifyMessage(question, true);

  const userMessageId = `msg-${crypto.randomUUID()}`;
  appendMessage(conversation.id, {
    id: userMessageId,
    conversationId: conversation.id,
    role: "user",
    content: question,
    status: "sent",
    createdAt: now,
  });

  const summaryFa = [
    "این تحلیل هوش مصنوعی است و جایگزین نظر وکیل نیست.",
    "",
    `قرارداد «${contract.title}» از دید «${perspectiveRoleFa}» بررسی شد.`,
    `دسته‌بندی حقوقی: ${classification.legalCategory}.`,
    "",
    "برای مشاهده تحلیل کامل و منابع، گفتگوی مرتبط را باز کنید.",
  ].join("\n");

  const assistantMessageId = `msg-${crypto.randomUUID()}`;
  appendMessage(conversation.id, {
    id: assistantMessageId,
    conversationId: conversation.id,
    role: "assistant",
    content: summaryFa,
    status: "completed",
    riskLevel: classification.initialRiskFlags.length > 0 ? "medium" : null,
    createdAt: new Date().toISOString(),
  });

  const review: AiContractReview = {
    id: `airev-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: request.contractVersionId,
    conversationId: conversation.id,
    messageId: assistantMessageId,
    perspectiveRoleFa,
    summaryFa,
    citations: [],
    isAiAnalysis: true,
    createdAt: new Date().toISOString(),
  };
  insertAiReview(review);
  return review;
}

/** The owner's conversation for this contract, created once on demand. */
function resolveOwnerConversation(contract: {
  userId: string;
  referenceCode: string;
  domain: string;
}): StoredConversation {
  const all = readConversations();
  const title = `بررسی قرارداد ${contract.referenceCode}`;
  const existing = all.find((c) => c.userId === contract.userId && c.title === title);
  if (existing) return existing;

  const now = new Date().toISOString();
  const conv: StoredConversation = {
    id: crypto.randomUUID(),
    userId: contract.userId,
    title,
    category: contract.domain,
    status: "active",
    riskLevel: null,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  all.push(conv);
  writeConversations(all);
  return conv;
}
