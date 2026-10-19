// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/pdf
// ============================================================
// GET — stream the A4 PDF for a contract version to an operator.
//
//   ?version=final   the final version (default once finalized)
//   ?version=<id>    a specific version id, so the operator can inspect
//                    the exact snapshot a decision is bound to
//   (omitted)        the final version when one exists, else the newest
//
// The owner-facing PDF route is owner-scoped, so an operator could not
// preview or print the document they are reviewing. This route closes
// that gap with the permission the review drawer already requires
// (`admin:contracts:read`).
//
// The PDF is rendered from the version SNAPSHOT through the SAME
// renderer and the SAME input builder as the owner and invitation
// routes, so the operator, the owner and the stored final artifact can
// never disagree about what the contract contains. Content rows are
// read-only here; nothing is written.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError } from "@/lib/admin/http";
import { getContractById, getVersion, listVersions } from "@/lib/contracts/db";
import { renderContractPdf } from "@/lib/contracts/pdf";
import { buildContractPdfInputs } from "@/lib/contracts/pdf-inputs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const requested = request.nextUrl.searchParams.get("version");
  let versionId: string | null = null;
  if (requested && requested !== "final") {
    versionId = requested;
  } else if (contract.finalVersionId) {
    versionId = contract.finalVersionId;
  } else {
    versionId = listVersions(contract.id)[0]?.id ?? null;
  }

  if (!versionId) {
    return adminError(409, "NO_VERSION", "نسخه‌ای برای تولید PDF وجود ندارد.");
  }

  const version = getVersion(contract.id, versionId);
  if (!version) return adminError(404, "NOT_FOUND", "نسخه یافت نشد");

  let bytes: Uint8Array;
  try {
    bytes = await renderContractPdf({
      contract,
      version,
      baseUrl: request.nextUrl.origin,
      ...buildContractPdfInputs({ contract, version }),
    });
  } catch {
    return adminError(409, "PDF_FAILED", "تولید فایل PDF ناموفق بود.");
  }

  const fileName = `${contract.referenceCode}-v${version.versionNumber}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      // The drawer embeds this in an <iframe> and the app-wide
      // `X-Frame-Options: DENY` would blank it. No third-party origin can
      // frame it, and the sandbox removes any same-origin document
      // privileges from the response.
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "sandbox; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Document-SHA256": version.documentHash,
    },
  });
}
