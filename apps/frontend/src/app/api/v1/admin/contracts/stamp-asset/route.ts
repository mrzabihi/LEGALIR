// ============================================================
// LEGALIR — /api/v1/admin/contracts/stamp-asset
// ============================================================
// GET — the Super-Admin preview of the two OFFICIAL masters, so the
// stamp panel shows the real seal and hologram before the operator
// authorizes them. The bytes are PRIVATE: this route is the only
// network surface, and it requires the stamp-read permission.
//
//   ?kind=seal       the blue LEGALIR legal seal
//   ?kind=hologram   the print-only hologram
//
// The SHA-256 reported elsewhere is computed from exactly these bytes,
// so what the operator sees is what a stamp approval gets bound to.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError } from "@/lib/admin/http";
import { loadHologram, loadReviewStamp } from "@/lib/contracts/stamp-asset";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:contracts:stamp:read");
  if (!auth.ok) return auth.response;

  const kind = request.nextUrl.searchParams.get("kind");
  const asset = kind === "seal" ? loadReviewStamp() : kind === "hologram" ? loadHologram() : null;
  if (!asset) return adminError(404, "STAMP_ASSET_UNAVAILABLE", "فایل مهر رسمی در دسترس نیست.");

  return new NextResponse(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(asset.sizeBytes),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
