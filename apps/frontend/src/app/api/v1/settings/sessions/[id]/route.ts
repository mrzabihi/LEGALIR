import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/api/server-auth";

/**
 * DELETE /api/v1/settings/sessions/:id
 * Revoke one of the caller's own sessions. Ownership is enforced in the
 * DB layer — revoking another user's session returns 404, not 403, so the
 * endpoint never leaks whether a foreign session id exists.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const ok = revokeSession(auth.userId, id);
  if (!ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "نشست یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { revoked: true } });
}
