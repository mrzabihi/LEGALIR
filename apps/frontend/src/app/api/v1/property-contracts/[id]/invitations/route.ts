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
//
// The issuing itself lives in `lib/contracts/signature/invitations.ts`
// so the owner workspace and the admin panel share ONE implementation:
// same token rules, same expiry, same per-recipient event trail.
// ============================================================

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
  appendSignatureEvent,
  listInvitations,
  updateInvitation,
} from "@/lib/contracts/signature/db";
import { issueSignatureInvitations } from "@/lib/contracts/signature/invitations";
import { clientFingerprintFrom } from "@/lib/contracts/signature/fingerprint";

interface Params {
  params: Promise<{ id: string }>;
}

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
  const fingerprint = clientFingerprintFrom(request);

  let body: InvitationBody;
  try {
    body = (await request.json()) as InvitationBody;
  } catch {
    body = {};
  }

  const outcome = await issueSignatureInvitations({
    contract,
    ...(body.participantIds ? { participantIds: body.participantIds } : {}),
    ...(body.expiresInHours !== undefined ? { expiresInHours: body.expiresInHours } : {}),
    ...(body.verifyBeforeView !== undefined ? { verifyBeforeView: body.verifyBeforeView } : {}),
    fingerprint,
    actorLabelFa: "کاربر",
  });

  if (!outcome.ok) {
    return outcome.code === "NO_REQUEST"
      ? conflict(outcome.messageFa, "NO_REQUEST")
      : badRequest(outcome.messageFa, "NO_PARTICIPANT");
  }

  const { invitations, expiresAt } = outcome.result;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "signature.invitations_issued",
    descriptionFa: `${invitations.length} دعوت‌نامه امضا صادر شد.`,
    metadata: { requestId: outcome.result.request.id, count: invitations.length },
  });

  return ok({ invitations, expiresAt });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  const fingerprint = clientFingerprintFrom(request);

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

  appendSignatureEvent({
    signatureRequestId: activeRequest.id,
    contractId: contract.id,
    participantId: invitation.participantId,
    type: "INVITATION_REVOKED",
    descriptionFa: "دعوت‌نامه امضا لغو شد.",
    contractVersionId: activeRequest.contractVersionId,
    documentHash: activeRequest.documentHash,
    clientFingerprint: fingerprint,
    metadata: { invitationId: invitation.id },
  });

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
