// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/invitations
// ============================================================
// The admin's INDEPENDENT resend (§5): one party at a time, never the
// whole request as a side effect.
//
// The issuing itself is NOT re-implemented here — it reuses
// `issueSignatureInvitations`, the same function the owner workspace
// calls. One implementation therefore governs token size, hashing,
// expiry, delivery reporting and the per-recipient event trail.
//
// What is admin-specific:
//   • the actor in every event reads «ادمین لیگالیر», so the trail
//     distinguishes an owner-initiated send from an admin resend;
//   • the raw token is returned ONCE in this response (over HTTPS) so
//     the operator can hand the link over when SMS is unavailable —
//     it is never persisted and never re-readable;
//   • every resend is written to the platform audit log.
//
// POST body: { participantIds?: string[]; expiresInHours?: number;
//              verifyBeforeView?: boolean }
// Omit `participantIds` to invite every participant of the active
// request; pass one id to resend to that party alone.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, readJson, requestMeta } from "@/lib/admin/http";
import { getContractById } from "@/lib/contracts/db";
import { issueSignatureInvitations } from "@/lib/contracts/signature/invitations";
import { clientFingerprintFrom } from "@/lib/contracts/signature/fingerprint";

interface Params {
  params: Promise<{ id: string }>;
}

interface ResendBody {
  participantIds?: string[];
  expiresInHours?: number;
  verifyBeforeView?: boolean;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const body = ((await readJson(request)) as ResendBody | null) ?? {};
  const fingerprint = clientFingerprintFrom(request);

  const outcome = await issueSignatureInvitations({
    contract,
    ...(Array.isArray(body.participantIds) && body.participantIds.length > 0
      ? { participantIds: body.participantIds }
      : {}),
    ...(typeof body.expiresInHours === "number" ? { expiresInHours: body.expiresInHours } : {}),
    ...(typeof body.verifyBeforeView === "boolean"
      ? { verifyBeforeView: body.verifyBeforeView }
      : {}),
    fingerprint,
    actorLabelFa: "ادمین لیگالیر",
  });

  if (!outcome.ok) {
    return outcome.code === "NO_REQUEST"
      ? adminError(409, "NO_REQUEST", outcome.messageFa)
      : adminError(400, "NO_PARTICIPANT", outcome.messageFa);
  }

  const {
    request: signatureRequest,
    invitations,
    expiresAt,
    revokedInvitationIds,
  } = outcome.result;

  const actor = findUserById(auth.ctx.userId);
  const actorLabelFa = actor?.displayName?.trim() || "مدیر لیگالیر";

  const failed = invitations.filter((i) => !i.delivered);

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.signature.invitation_resent",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason:
      invitations.length === 1
        ? `ارسال مجدد لینک امضا برای یک طرف (${actorLabelFa})`
        : `ارسال لینک امضا برای ${invitations.length} طرف (${actorLabelFa})`,
    before: { revokedInvitationIds },
    after: {
      signatureRequestId: signatureRequest.id,
      contractVersionId: signatureRequest.contractVersionId,
      documentHash: signatureRequest.documentHash,
      participantIds: invitations.map((i) => i.participantId),
      // The REAL delivery outcome is recorded — never a claim that the
      // SMS went out when the adapter reported a failure.
      channels: invitations.map((i) => (i.delivered ? i.channel : "none")),
      failedCount: failed.length,
      expiresAt,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      requestId: signatureRequest.id,
      contractVersionId: signatureRequest.contractVersionId,
      documentHash: signatureRequest.documentHash,
      invitations,
      expiresAt,
      revokedInvitationIds,
      actorLabelFa,
      // Surfaced so the operator can hand over the link exactly for the
      // parties whose SMS did not go out.
      failedParticipantIds: failed.map((i) => i.participantId),
    },
  });
}
