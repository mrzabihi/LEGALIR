// ============================================================
// LEGALIR — /api/v1/contract-invitations/[token]/pdf  (PUBLIC, token-scoped)
// ============================================================
// The PDF for the exact version an invitation was issued for. The token
// is the credential: it identifies one recipient and one frozen version,
// so this route never needs (and never accepts) a session or a contract
// id from the caller.
//
// A token stays usable for DOWNLOAD after the recipient has signed or
// declined — the document they acted on must remain retrievable for
// them. It is refused only when revoked or unknown. The bytes are
// rendered from the version SNAPSHOT, so they match the recorded hash.
//
// The watermark/stamp decision is the SAME gate as the owner PDF route:
// a draft carries the «پیش‌نویس» watermark, and the official seal is
// drawn only when a Super-Admin approval is still bound to this version.
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
import { renderContractPdf } from "@/lib/contracts/pdf";
import { mergedLegalBasisCatalog, preSignTipsForType } from "@/lib/contracts/legal-review-db";

interface Params {
  params: Promise<{ token: string }>;
}

/** Public-safe initials, e.g. «م.م» — never the full name. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LG";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join(".");
}

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = findInvitationByTokenHash(hash);

  if (!invitation) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "این دعوت‌نامه معتبر نیست یا منقضی شده است." },
      { status: 404 }
    );
  }
  if (invitation.status === "REVOKED") {
    return NextResponse.json(
      { code: "REVOKED", message: "این دعوت‌نامه لغو شده است." },
      { status: 410 }
    );
  }

  const contract = getContractById(invitation.contractId);
  if (!contract) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "قرارداد مربوط به این دعوت‌نامه یافت نشد." },
      { status: 404 }
    );
  }

  const signatureRequest = getSignatureRequest(contract.id, invitation.signatureRequestId);
  const version = signatureRequest
    ? getVersion(contract.id, signatureRequest.contractVersionId)
    : null;
  if (!version) {
    return NextResponse.json(
      { code: "NO_VERSION", message: "نسخه‌ای برای تولید PDF وجود ندارد." },
      { status: 409 }
    );
  }

  // The stamp is drawn ONLY when this exact version still carries a
  // valid, bound approval; otherwise the renderer applies the draft
  // watermark.
  const approval = currentVersionApproval(contract, version.documentHash);
  const official = currentVersionStamp(contract, version.documentHash);

  let bytes: Uint8Array;
  try {
    bytes = await renderContractPdf({
      contract,
      version,
      baseUrl: new URL(request.url).origin,
      legalBasisCatalog: mergedLegalBasisCatalog(),
      preSignTips: preSignTipsForType(contract.type),
      stamp: approval
        ? {
            applied: true,
            reviewId: approval.id,
            reviewedAt: approval.decidedAt ?? undefined,
            reviewingOfficeFa: approval.reviewingOfficeFa,
            reviewerInitials: approval.reviewerInitials,
            officialStamp: official
              ? {
                  sha256: official.stampAssetSha256 ?? "",
                  version: official.stampAssetVersion,
                  approvedAt: official.appliedAt,
                  approvedByInitials: official.approvedByLabelFa
                    ? initialsFrom(official.approvedByLabelFa)
                    : null,
                }
              : null,
          }
        : { applied: false },
    });
  } catch {
    return NextResponse.json(
      { code: "PDF_FAILED", message: "تولید فایل PDF ناموفق بود." },
      { status: 409 }
    );
  }

  const fileName = `${contract.referenceCode}-v${version.versionNumber}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
