// ============================================================
// LEGALIR — Signature invitation issuing (server-only)
// ============================================================
// One implementation of "give this party a dedicated link", shared by
// the drafting workspace and the admin panel so the two surfaces can
// never diverge:
//
//   • a fresh 32-byte random token is generated and returned ONCE;
//     only its SHA-256 hash is persisted, so a store leak cannot be
//     replayed;
//   • delivery goes through the ONE SMS adapter, and the REAL outcome
//     (`sms` / `dev-console` / `none`) is recorded per recipient — the
//     code never claims a message was sent when it was not;
//   • every issue appends a per-recipient signature event, so the
//     contract history records WHO was invited, WHEN and HOW;
//   • a previous ACTIVE invitation for that participant is revoked in
//     the same call, so an old link stops working the moment a new one
//     is issued.
// ============================================================

import crypto from "node:crypto";
import type { PropertyContract, SignatureRequest } from "@legalir/types";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  insertInvitation,
  listInvitations,
  listParticipants,
  updateInvitation,
} from "./db";
import { getSmsGateway } from "@/lib/sms/gateway";
import { absoluteUrl } from "@/lib/site";

export const DEFAULT_EXPIRY_HOURS = 72;

export interface IssuedInvitation {
  participantId: string;
  token: string;
  expiresAt: string;
  delivered: boolean;
  channel: "sms" | "dev-console" | null;
  failureReasonFa: string | null;
}

export interface IssueInvitationsResult {
  request: SignatureRequest;
  invitations: IssuedInvitation[];
  expiresAt: string;
  /** Participants whose previous ACTIVE link was revoked by this call. */
  revokedInvitationIds: string[];
}

export type IssueInvitationsOutcome =
  | { ok: true; result: IssueInvitationsResult }
  | { ok: false; code: "NO_REQUEST" | "NO_PARTICIPANT"; messageFa: string };

export interface IssueInvitationsInput {
  contract: PropertyContract;
  /** Omit to invite every participant of the active request. */
  participantIds?: string[];
  expiresInHours?: number;
  verifyBeforeView?: boolean;
  /** Written into each event, so the trail shows who triggered it. */
  fingerprint?: string | null;
  /** Shown in the event copy, e.g. «کاربر» or «ادمین لیگالیر». */
  actorLabelFa?: string;
  /** Marks invitations created by the dev sample, so nobody mistakes them. */
  sample?: boolean;
}

/**
 * Issue a dedicated link for each requested participant.
 *
 * Refuses when there is no active signature request or when none of the
 * requested participants belong to it — a link is never issued for a
 * party the frozen version has not been bound to.
 */
export async function issueSignatureInvitations(
  input: IssueInvitationsInput
): Promise<IssueInvitationsOutcome> {
  const { contract } = input;

  const request = activeSignatureRequest(contract.id);
  if (!request) {
    return {
      ok: false,
      code: "NO_REQUEST",
      messageFa: "ابتدا درخواست امضا ایجاد کنید.",
    };
  }

  const participants = listParticipants(request.id).filter(
    (p) => !input.participantIds || input.participantIds.includes(p.id)
  );
  if (participants.length === 0) {
    return {
      ok: false,
      code: "NO_PARTICIPANT",
      messageFa: "شرکت‌کننده‌ای برای دعوت یافت نشد.",
    };
  }

  const expiresInHours = input.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
  const verifyBeforeView = input.verifyBeforeView ?? true;
  const actorLabelFa = input.actorLabelFa ?? "کاربر";

  const existingActive = listInvitations(request.id).filter((i) => i.status === "ACTIVE");
  const invitations: IssuedInvitation[] = [];
  const revokedInvitationIds: string[] = [];

  for (const participant of participants) {
    // A new link supersedes this party's previous one. Revoking first
    // means "resend" can never leave two working links for one person.
    for (const previous of existingActive.filter((i) => i.participantId === participant.id)) {
      updateInvitation(previous.id, {
        status: "REVOKED",
        revokedAt: new Date().toISOString(),
      });
      revokedInvitationIds.push(previous.id);
      appendSignatureEvent({
        signatureRequestId: request.id,
        contractId: contract.id,
        participantId: participant.id,
        type: "INVITATION_REVOKED",
        descriptionFa: `لینک پیشین ${participant.roleFa} لغو شد تا لینک تازه جای آن را بگیرد.`,
        contractVersionId: request.contractVersionId,
        documentHash: request.documentHash,
        clientFingerprint: input.fingerprint ?? null,
        metadata: { invitationId: previous.id, superseded: true, actor: actorLabelFa },
      });
    }

    // The raw token is returned once; only the hash is ever written.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const delivery = await getSmsGateway().send({
      to: participant.mobile,
      body: `لیگالیر — پیش‌نویس قرارداد ${contract.referenceCode} برای امضای شما آماده است: ${absoluteUrl(
        `/contracts/sign/${rawToken}`
      )}`,
      tag: "draft-invitation",
    });

    insertInvitation({
      id: `sinv-${crypto.randomUUID()}`,
      contractId: contract.id,
      signatureRequestId: request.id,
      participantId: participant.id,
      tokenHash,
      recipientMasked: participant.mobileMasked,
      status: "ACTIVE",
      verifyBeforeView,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      deliveryChannel: delivery.ok ? delivery.channel : "none",
      deliveryStatus: delivery.ok ? "SENT" : "FAILED",
      lastSentAt: new Date().toISOString(),
    });

    invitations.push({
      participantId: participant.id,
      token: rawToken,
      expiresAt,
      delivered: delivery.ok,
      channel: delivery.ok ? delivery.channel : null,
      failureReasonFa: delivery.ok ? null : delivery.detailFa,
    });

    // One event per recipient, so the trail records WHO was invited and
    // never only an aggregate count.
    appendSignatureEvent({
      signatureRequestId: request.id,
      contractId: contract.id,
      participantId: participant.id,
      type: delivery.ok ? "INVITATION_SENT" : "INVITATION_FAILED",
      descriptionFa: delivery.ok
        ? `دعوت‌نامه امضا برای ${participant.roleFa} ارسال شد (${actorLabelFa}).`
        : `ارسال دعوت‌نامه امضا برای ${participant.roleFa} ناموفق بود (${actorLabelFa}).`,
      contractVersionId: request.contractVersionId,
      documentHash: request.documentHash,
      clientFingerprint: input.fingerprint ?? null,
      metadata: {
        recipientMasked: participant.mobileMasked,
        expiresAt,
        verifyBeforeView,
        channel: delivery.ok ? delivery.channel : "none",
        actor: actorLabelFa,
        ...(input.sample ? { sample: true } : {}),
      },
    });
  }

  return {
    ok: true,
    result: { request, invitations, expiresAt, revokedInvitationIds },
  };
}
