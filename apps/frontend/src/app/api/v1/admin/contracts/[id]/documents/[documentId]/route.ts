// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/documents/[documentId]
// ============================================================
// GET — stream a stored contract document to an operator.
//
// The owner-facing document route is owner-scoped, so an admin could not
// open the uploaded signature scans or the annex files that the final
// PDF is built from. This route closes that gap with the same permission
// the review drawer already requires (`admin:contracts:read`).
//
// The bytes come from the private contract-storage root, and the stored
// key must belong to THIS contract's own directory: a corrupted or
// tampered row can never point at another contract's file.
//
// The declared type is decided HERE from a small allowlist — never taken
// from the row. `nosniff` alone does not stop a browser rendering a
// declared `text/html`, so a tampered `mime` must not be able to serve
// markup on this origin.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError } from "@/lib/admin/http";
import { getContractById, getContractDocument, listContractDocuments } from "@/lib/contracts/db";
import { resolveContractFile } from "@/lib/contracts/storage";

interface Params {
  params: Promise<{ id: string; documentId: string }>;
}

/** Types an operator may preview inline. Everything else downloads. */
const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;
  const { id, documentId } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const doc = getContractDocument(contract.id, documentId);
  if (!doc) return adminError(404, "NOT_FOUND", "سند یافت نشد");

  // A stored key must belong to THIS contract's own directory.
  if (!doc.storageKey.startsWith(`${contract.id}/`)) {
    return adminError(404, "FILE_MISSING", "فایل سند یافت نشد");
  }

  const absolute = resolveContractFile(doc.storageKey);
  if (!absolute) return adminError(404, "FILE_MISSING", "فایل سند یافت نشد");

  const fs = await import("node:fs");
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    // Removed (or unreadable) between the resolve and the read: a missing
    // artifact, not a server fault.
    return adminError(404, "FILE_MISSING", "فایل سند یافت نشد");
  }

  // `doc.mime` is only trusted as a SELECTOR into the allowlist; an unknown
  // or tampered value falls back to an opaque download.
  const inline = INLINE_TYPES.has(doc.mime);
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = inline && !wantsDownload ? "inline" : "attachment";
  const contentType = inline ? doc.mime : "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(
        doc.fileName
      )}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // The drawer previews PDFs/images in an <iframe>; the app-wide
      // `DENY` / `frame-ancestors 'none'` would leave an empty box.
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "sandbox; frame-ancestors 'self'",
      // The stored hash lets the operator verify the bytes match the row
      // that feeds the PDF renderer.
      "X-Document-SHA256": doc.hash,
    },
  });
}

/**
 * A lightweight index of every stored document, so an operator can list
 * the evidence without walking the whole contract payload twice.
 */
export async function HEAD(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-Document-Count": String(listContractDocuments(contract.id).length),
      "Cache-Control": "private, no-store",
    },
  });
}
