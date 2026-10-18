// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/pdf
// ============================================================
// GET — stream the immutable PDF for a contract version.
//
//   ?version=final   the final version (default once finalized)
//   ?version=<id>    a specific version id
//
// The PDF is rendered from the version SNAPSHOT, never from the
// mutable working data, so the bytes always match the recorded hash.
// ============================================================

import { NextResponse } from "next/server";
import {
  conflict,
  isErrorResponse,
  notFound,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { getVersion, listVersions } from "@/lib/contracts/db";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { currentVersionStamp } from "@/lib/contracts/stamp-review";
import { renderContractPdf } from "@/lib/contracts/pdf";
import { mergedLegalBasisCatalog, preSignTipsForType } from "@/lib/contracts/legal-review-db";

interface Params {
  params: Promise<{ id: string }>;
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
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { contract } = ctx;
  const url = new URL(request.url);
  const requested = url.searchParams.get("version");

  let versionId: string | null = null;
  if (requested && requested !== "final") {
    versionId = requested;
  } else if (contract.finalVersionId) {
    versionId = contract.finalVersionId;
  } else {
    versionId = listVersions(contract.id)[0]?.id ?? null;
  }

  if (!versionId) return conflict("نسخه‌ای برای تولید PDF وجود ندارد.", "NO_VERSION");

  const version = getVersion(contract.id, versionId);
  if (!version) return notFound("نسخه یافت نشد");

  // The stamp is drawn ONLY when the requested version still carries a
  // valid, bound admin approval. This re-derives the gate from the
  // version's OWN hash, so an older unapproved version can never be
  // exported with the stamp, and a draft carries the watermark instead.
  const approval = currentVersionApproval(contract, version.documentHash);

  // The OFFICIAL LEGALIR stamp is a separate, higher gate: it is drawn
  // only when a Super-Admin approval is still bound to THIS version's
  // hash AND the stamp master on disk is byte-identical to what was
  // approved. Otherwise the renderer falls back to the legacy text mark
  // (when reviewed) or the draft watermark (when not).
  const official = currentVersionStamp(contract, version.documentHash);

  const baseUrl = url.origin;
  let bytes: Uint8Array;
  try {
    bytes = await renderContractPdf({
      contract,
      version,
      baseUrl,
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
    return conflict("تولید فایل PDF ناموفق بود.", "PDF_FAILED");
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
