// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/stamp-asset/[kind]
// ============================================================
// GET — the authorized owner's view of the official mark on THEIR OWN
// finalized contract. The masters are PRIVATE (never under public/), so a
// stamped document is the only thing that may reference them.
//
// The gate is the same hash-bound check the PDF uses: the contract's
// current version must carry a valid APPLIED Super-Admin stamp whose
// stamp-master hash still matches the bytes on disk. An unstamped or
// stale contract gets 404 — the asset is never exposed for a document
// that is not allowed to carry it.
//
//   kind=seal       the blue LEGALIR legal seal
//   kind=hologram   the print-only hologram (ink is added by the printer)
// ============================================================

import { NextResponse } from "next/server";
import { notFound, requireContract } from "@/lib/contracts/api-helpers";
import { getVersion } from "@/lib/contracts/db";
import { currentVersionStamp } from "@/lib/contracts/stamp-review";
import { loadHologram, loadReviewStamp } from "@/lib/contracts/stamp-asset";

interface Params {
  params: Promise<{ id: string; kind: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id, kind } = await params;
  const ctx = requireContract(request, id);
  if (!("contract" in ctx)) return ctx;

  const contract = ctx.contract;
  const version = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  // Only a document that is ALLOWED to carry the mark may load it.
  if (!version || !currentVersionStamp(contract, version.documentHash)) {
    return notFound("مهر رسمی برای این قرارداد فعال نیست.");
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
