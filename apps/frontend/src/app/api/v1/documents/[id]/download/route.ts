// ============================================================
// LEGALIR — GET /api/v1/documents/[id]/download (demo dataset)
// ============================================================
// Streams the seeded PDF from public/demo-documents back to the
// client with Content-Disposition: attachment, so the browser
// downloads the file rather than navigating.
// ============================================================

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument } from "@/lib/demo-seed";
import { documentFileReference, resolveDocumentFile } from "@/lib/document-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const doc = getDemoDocument(userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  // Uploaded documents live in the private root; seeded demo fixtures
  // live under public/. Resolve through the shared storage layer so both
  // are found, then fall back to the public path for legacy rows that
  // only carry a previewUrl.
  const resolved = resolveDocumentFile(documentFileReference(doc));
  let filePath: string;
  let fileName: string;

  if (resolved) {
    filePath = resolved.absolutePath;
    fileName = doc.name || resolved.fileName;
  } else if (doc.previewUrl) {
    // previewUrl is rooted at "/demo-documents/<file>"; resolve against public/.
    const relative = doc.previewUrl.replace(/^\/+/, "");
    filePath = path.join(process.cwd(), "public", relative);
    fileName = path.basename(filePath);
  } else {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "فایل پیش‌نمایش برای این سند موجود نیست" },
      { status: 404 }
    );
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "فایل یافت نشد" },
      { status: 404 }
    );
  }

  const buf = fs.readFileSync(filePath);
  const encodedName = encodeURIComponent(fileName);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": doc.mime || "application/pdf",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    },
  });
}
