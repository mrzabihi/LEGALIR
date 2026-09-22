// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/docx
// ============================================================
// GET — stream the immutable Word (.docx) for a contract version.
//
//   ?version=final   the final version (default once finalized)
//   ?version=<id>    a specific version id
//
// Rendered from the version SNAPSHOT, never the mutable working data,
// so the bytes always match the recorded hash. Authorization is the
// shared `requireContract` guard (404 on a foreign contract).
// ============================================================

import { NextResponse } from "next/server";
import {
  conflict,
  isErrorResponse,
  notFound,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { getVersion, listVersions } from "@/lib/contracts/db";
import { renderContractDocx } from "@/lib/contracts/docx";

type Params = { params: Promise<{ id: string }> };

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

  if (!versionId) return conflict("نسخه‌ای برای تولید فایل Word وجود ندارد.", "NO_VERSION");

  const version = getVersion(contract.id, versionId);
  if (!version) return notFound("نسخه یافت نشد");

  let bytes: Uint8Array;
  try {
    bytes = renderContractDocx({ contract, version });
  } catch {
    return conflict("تولید فایل Word ناموفق بود.", "DOCX_FAILED");
  }

  const fileName = `${contract.referenceCode}-v${version.versionNumber}.docx`;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
