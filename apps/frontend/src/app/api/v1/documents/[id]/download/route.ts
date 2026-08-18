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

  const previewUrl = doc.previewUrl;
  if (!previewUrl) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "فایل پیش‌نمایش برای این سند موجود نیست" },
      { status: 404 }
    );
  }

  // previewUrl is rooted at "/demo-documents/<file>"; resolve against public/.
  const relative = previewUrl.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relative);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "فایل یافت نشد" },
      { status: 404 }
    );
  }

  const buf = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
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
