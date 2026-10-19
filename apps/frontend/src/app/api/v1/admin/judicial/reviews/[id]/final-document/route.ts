// ============================================================
// LEGALIR — /api/v1/admin/judicial/reviews/[id]/final-document
// ============================================================
// GET — stream the STORED judicial artifact to an operator.
//
// The owner-facing route is owner-scoped, so the reviewer who approved an
// issuance could not reopen the very file they released. This route closes
// that gap behind `admin:judicial:read` — the same permission the review
// drawer already requires — and resolves the artifact THROUGH the review:
// an operator cannot name an arbitrary request id here, only a review they
// can already see.
//
// The bytes are the ones written at issuance time (read from the private
// judicial-storage root). Nothing is re-rendered, so what the operator sees
// is byte-identical to what the owner downloaded and what `pdfHash` records.
//
// `?download=1` forces an attachment; the default is inline preview.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError } from "@/lib/admin/http";
import {
  getFinalDocumentForRequest,
  getReviewById,
} from "@/lib/judicial/review-db";
import { resolveJudicialFile } from "@/lib/judicial/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:judicial:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const review = getReviewById(id);
  if (!review) return adminError(404, "NOT_FOUND", "درخواست بررسی یافت نشد");

  const doc = getFinalDocumentForRequest(review.requestId);
  if (!doc) {
    return adminError(
      404,
      "NOT_ISSUED",
      "نسخهٔ نهایی این درخواست هنوز صادر نشده است"
    );
  }
  // The artifact must belong to the review's own owner and review. The
  // resolver below rejects traversal and missing files; this catches a row
  // that somehow points at another applicant's artifact.
  if (doc.userId !== review.userId || doc.reviewId !== review.id) {
    return adminError(404, "FILE_MISSING", "فایل نسخهٔ نهایی یافت نشد");
  }
  if (!doc.storageKey.startsWith(`${doc.requestId}/`)) {
    return adminError(404, "FILE_MISSING", "فایل نسخهٔ نهایی یافت نشد");
  }

  const absolute = resolveJudicialFile(doc.storageKey);
  if (!absolute) return adminError(404, "FILE_MISSING", "فایل نسخهٔ نهایی یافت نشد");

  const fs = await import("node:fs");
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    // Removed (or unreadable) between resolve and read: a missing artifact,
    // not a server fault.
    return adminError(404, "FILE_MISSING", "فایل نسخهٔ نهایی یافت نشد");
  }

  const download = request.nextUrl.searchParams.get("download") === "1";

  // The type is decided HERE, never taken from a row. `nosniff` prevents
  // sniffing but not a declared type, and the artifact is always a PDF.
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "X-Document-SHA256": doc.pdfHash,
    },
  });
}
