// ============================================================
// LEGALIR — GET /api/v1/lawyers/[id]/avatar
// ============================================================
// Serves an admin-uploaded lawyer portrait from the private
// `.data/lawyer-avatars/` root. Public and unauthenticated on purpose — the
// same portrait is already shown on the public marketplace card, and the
// stored name is the profile id (never a user-supplied path), so nothing
// private is exposed.
//
// Returns 404 when no upload exists, so the UI's `<img onError>` falls back
// to the generated silhouette.
// ============================================================

import fs from "node:fs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveLawyerAvatar } from "@/lib/lawyer-avatar-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const found = resolveLawyerAvatar(id);
  if (!found) {
    return new NextResponse("not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(found.absolutePath);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(bytes.length),
      // The URL is stable per lawyer and replaced (not versioned) on change,
      // so a short TTL is safe and keeps the public card fast.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
