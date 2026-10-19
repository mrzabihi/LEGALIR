// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/final-document
// ============================================================
// GET — stream the STORED final artifact (`final_pdf`) to an operator.
//
// The owner-facing document route is owner-scoped, so an admin could not
// open the very document they approved for issuance. This route closes
// that gap with the same permission the review drawer already requires
// (`admin:contracts:read`).
//
// What it returns is the artifact written at finalization time: the A4
// PDF with the official seal and the hologram drawn on EVERY page. The
// bytes are read from the private contract-storage root — never a public
// URL, never re-rendered on the fly, so what the operator sees is exactly
// what the owner downloaded.
//
// `?download=1` forces an attachment; the default is inline preview.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError } from "@/lib/admin/http";
import { getContractById, listContractDocuments } from "@/lib/contracts/db";
import { resolveContractFile } from "@/lib/contracts/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const doc = listContractDocuments(contract.id).find((d) => d.category === "final_pdf");
  if (!doc) {
    return adminError(
      404,
      "NOT_FINALIZED",
      "نسخهٔ نهایی این قرارداد هنوز تولید نشده است"
    );
  }

  // A stored key must belong to THIS contract's own directory. The
  // resolver already rejects traversal and missing files, but a corrupted
  // or tampered row could name another contract's artifact.
  if (!doc.storageKey.startsWith(`${contract.id}/`)) {
    return adminError(404, "FILE_MISSING", "فایل سند نهایی یافت نشد");
  }

  const absolute = resolveContractFile(doc.storageKey);
  if (!absolute) return adminError(404, "FILE_MISSING", "فایل سند نهایی یافت نشد");

  const fs = await import("node:fs");
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    // The file was removed (or became unreadable) between the resolve and
    // the read. That is a missing artifact, not a server fault.
    return adminError(404, "FILE_MISSING", "فایل سند نهایی یافت نشد");
  }
  const download = request.nextUrl.searchParams.get("download") === "1";

  // The type is decided HERE, never taken from the row: `nosniff` stops
  // sniffing but does not stop a browser rendering a declared `text/html`,
  // so a tampered `mime` value must not be able to serve script on this
  // origin. The final artifact is always a PDF.
  const contentType = "application/pdf";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // The drawer previews this artifact in an <iframe>, and the app-wide
      // `X-Frame-Options: DENY` / `frame-ancestors 'none'` made the browser
      // refuse it — the operator saw an empty box instead of the sealed
      // contract. `SAMEORIGIN` is the narrowest relaxation that lets the
      // admin shell embed its own artifact; no third-party origin can.
      "X-Frame-Options": "SAMEORIGIN",
      // Treat the response as an opaque document: no scripts, no same-origin
      // privileges, even if the bytes were ever something other than a PDF —
      // while still allowing this origin to frame it.
      "Content-Security-Policy": "sandbox; frame-ancestors 'self'",
      // The artifact hash lets an operator verify the bytes match what the
      // finalization record (and the public verification page) reports.
      "X-Document-SHA256": doc.hash,
    },
  });
}
