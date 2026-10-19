// ============================================================
// LEGALIR — /api/v1/contract-invitations/[token]/stamp-asset/[kind]
// ============================================================
// The signing party's view of the official mark on the exact version
// their invitation froze.
//
// The owner route for these assets is session-scoped, and a signer may
// have no account at all — but the very same bytes are already rendered
// INTO the PDF this token can download (`[token]/pdf`). Refusing them
// here would only make the on-screen sheet disagree with the file the
// party signs, which is exactly the divergence this surface exists to
// prevent.
//
// The gate is identical to the PDF route's: the invitation must exist
// and not be revoked, and the version it froze must carry an APPLIED
// Super-Admin stamp whose hash still matches the content AND whose
// stamp master is still byte-identical (`currentVersionStamp`). Revoked
// invitations lose the asset too; an expired one keeps it, because the
// document it acted on must remain retrievable.
//
//   kind=seal       the blue LEGALIR legal seal
//   kind=hologram   the print-only hologram (ink is added by the printer)
// ============================================================

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  findInvitationByTokenHash,
  getSignatureRequest,
} from "@/lib/contracts/signature/db";
import { getContractById, getVersion } from "@/lib/contracts/db";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { currentVersionStamp } from "@/lib/contracts/stamp-review";
import { loadHologram, loadReviewStamp } from "@/lib/contracts/stamp-asset";

interface Params {
  params: Promise<{ token: string; kind: string }>;
}

function notFound(message: string) {
  return NextResponse.json({ code: "NOT_FOUND", message }, { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  const { token, kind } = await params;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = findInvitationByTokenHash(hash);
  if (!invitation) return notFound("این دعوت‌نامه معتبر نیست یا منقضی شده است.");
  if (invitation.status === "REVOKED") {
    return NextResponse.json(
      { code: "REVOKED", message: "این دعوت‌نامه لغو شده است." },
      { status: 410 }
    );
  }

  const contract = getContractById(invitation.contractId);
  if (!contract) return notFound("قرارداد مربوط به این دعوت‌نامه یافت نشد.");

  const request = getSignatureRequest(contract.id, invitation.signatureRequestId);
  const version = request ? getVersion(contract.id, request.contractVersionId) : null;
  if (!version) return notFound("نسخه‌ای برای این دعوت‌نامه وجود ندارد.");

  // BOTH gates: the review approval that authorises the mark, and the
  // stamp binding that proves the master was actually applied to THIS
  // hash. A stale or unbound stamp renders the PDF without the mark, so
  // it must not load the images here either.
  if (
    !currentVersionApproval(contract, version.documentHash) ||
    !currentVersionStamp(contract, version.documentHash)
  ) {
    return notFound("مهر رسمی برای این نسخه فعال نیست.");
  }

  const asset = kind === "seal" ? loadReviewStamp() : kind === "hologram" ? loadHologram() : null;
  if (!asset) return notFound("فایل مهر رسمی در دسترس نیست.");

  return new NextResponse(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(asset.sizeBytes),
      // Private: a shared proxy must never cache a security asset.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
