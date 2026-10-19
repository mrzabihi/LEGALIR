// ============================================================
// LEGALIR — /api/v1/judicial/requests/[id]/final-document
// ============================================================
// GET — stream the STORED issued artifact to its OWNER.
//
// What goes out is the exact bytes written at issuance time: the A4 PDF
// with the official seal and the hologram on every page. It is read from
// the private judicial-storage root — never a public URL, and never
// re-rendered on the fly, so what the owner downloads is byte-identical to
// what the operator saw and what the register's `pdfHash` records.
//
//   • owner-scoped: a foreign request is indistinguishable from a missing one;
//   • `?download=1` forces an attachment; the default is inline preview;
//   • the type is decided HERE (`application/pdf`), never taken from a row.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getOwnedFinalDocument } from "@/lib/judicial/review-db";
import { resolveJudicialFile } from "@/lib/judicial/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const doc = getOwnedFinalDocument(auth.ctx.userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_ISSUED", message: "نسخهٔ نهایی این درخواست هنوز صادر نشده است." },
      { status: 404 }
    );
  }

  // A stored key must point into THIS request's own directory. The resolver
  // already rejects traversal and missing files; this catches a row that
  // somehow names another request's artifact.
  if (!doc.storageKey.startsWith(`${doc.requestId}/`)) {
    return NextResponse.json(
      { code: "FILE_MISSING", message: "فایل نسخهٔ نهایی یافت نشد." },
      { status: 404 }
    );
  }

  const absolute = resolveJudicialFile(doc.storageKey);
  if (!absolute) {
    return NextResponse.json(
      { code: "FILE_MISSING", message: "فایل نسخهٔ نهایی یافت نشد." },
      { status: 404 }
    );
  }

  const fs = await import("node:fs");
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    return NextResponse.json(
      { code: "FILE_MISSING", message: "فایل نسخهٔ نهایی یافت نشد." },
      { status: 404 }
    );
  }

  const download = request.nextUrl.searchParams.get("download") === "1";

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
