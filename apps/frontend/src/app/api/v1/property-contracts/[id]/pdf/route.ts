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
import { renderContractPdf } from "@/lib/contracts/pdf";

interface Params {
  params: Promise<{ id: string }>;
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

  const baseUrl = url.origin;
  let bytes: Uint8Array;
  try {
    bytes = await renderContractPdf({ contract, version, baseUrl });
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
