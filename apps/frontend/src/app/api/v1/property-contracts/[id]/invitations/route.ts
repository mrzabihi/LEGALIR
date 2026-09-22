// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/invitations
// ============================================================
// POST   — issue an invitation for each participant of the active
//          signature request. The RAW token is returned ONCE; only its
//          SHA-256 hash is persisted, so a database leak cannot be
//          replayed.
// DELETE — revoke an invitation by id.
//
// An invitation carries an expiry (72h by default) and a
// `verifyBeforeView` flag: when set, the recipient must prove identity
// before the document is shown.
// ============================================================

import crypto from "node:crypto";
import type { SignatureInvitation } from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  activeSignatureRequest,
  insertInvitation,
  listInvitations,
  listParticipants,
  updateInvitation,
} from "@/lib/contracts/signature/db";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_EXPIRY_HOURS = 72;

interface InvitationBody {
  participantIds?: string[];
  expiresInHours?: number;
  verifyBeforeView?: boolean;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  const activeRequest = activeSignatureRequest(contract.id);
  if (!activeRequest) return conflict("ابتدا درخواست امضا ایجاد کنید.", "NO_REQUEST");

  let body: InvitationBody;
  try {
    body = (await request.json()) as InvitationBody;
  } catch {
    body = {};
  }

  const participants = listParticipants(activeRequest.id).filter(
    (p) => !body.participantIds || body.participantIds.includes(p.id)
  );
  if (participants.length === 0) {
    return badRequest("شرکت‌کننده‌ای برای دعوت یافت نشد.", "NO_PARTICIPANT");
  }

  const expiresInHours = body.expiresInHours ?? DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
  const verifyBeforeView = body.verifyBeforeView ?? true;

  const issued: { participantId: string; token: string; expiresAt: string }[] = [];
  for (const participant of participants) {
    // The raw token is generated here and returned once; only the hash
    // is ever written to disk.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    insertInvitation({
      id: `sinv-${crypto.randomUUID()}`,
      contractId: contract.id,
      signatureRequestId: activeRequest.id,
      participantId: participant.id,
      tokenHash,
      recipientMasked: participant.mobileMasked,
      status: "ACTIVE",
      verifyBeforeView,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    });

    issued.push({ participantId: participant.id, token: rawToken, expiresAt });
  }

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "signature.invitations_issued",
    descriptionFa: `${issued.length} دعوت‌نامه امضا صادر شد.`,
    metadata: { requestId: activeRequest.id, count: issued.length },
  });

  return ok({ invitations: issued, expiresAt });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  const url = new URL(request.url);
  const invitationId = url.searchParams.get("invitationId");
  if (!invitationId) return badRequest("شناسه دعوت‌نامه الزامی است.", "INVALID_BODY");

  const activeRequest = activeSignatureRequest(contract.id);
  if (!activeRequest) return conflict("درخواست امضایی در جریان نیست.", "NO_REQUEST");

  const invitation = listInvitations(activeRequest.id).find((i) => i.id === invitationId);
  if (!invitation) return badRequest("دعوت‌نامه یافت نشد.", "NO_INVITATION");

  const updated = updateInvitation(invitation.id, {
    status: "REVOKED",
    revokedAt: new Date().toISOString(),
  })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "signature.invitation_revoked",
    descriptionFa: "دعوت‌نامه امضا لغو شد.",
    metadata: { invitationId: invitation.id },
  });

  return ok({ invitation: updated });
}

/** GET — the invitations for the active request (never the raw token). */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const activeRequest = activeSignatureRequest(ctx.contract.id);
  if (!activeRequest) return ok({ invitations: [] as SignatureInvitation[] });

  return ok({ invitations: listInvitations(activeRequest.id) });
}
