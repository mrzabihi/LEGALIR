import { NextResponse } from "next/server";
import { listSessionsForUser, revokeOtherSessions } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/api/server-auth";
import { parseUserAgent } from "@/lib/user-agent";

/**
 * GET /api/v1/settings/sessions
 * The caller's own active sessions. Scoped to the authenticated user —
 * a user can never see another user's sessions.
 */
export async function GET(request: Request) {
  const auth = getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const items = listSessionsForUser(auth.userId).map((s) => {
    const { device, browser } = parseUserAgent(s.userAgent);
    return {
      id: s.id,
      device,
      browser,
      ip: s.ip ?? null,
      lastActiveAt: s.lastActiveAt ?? s.createdAt,
      createdAt: s.createdAt,
      current: s.id === auth.sessionId,
    };
  });

  return NextResponse.json({ data: { items } });
}

/**
 * DELETE /api/v1/settings/sessions
 * Revoke every session except the current one ("خروج از سایر دستگاهها").
 */
export async function DELETE(request: Request) {
  const auth = getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const revoked = revokeOtherSessions(auth.userId, auth.sessionId);
  return NextResponse.json({ data: { revoked } });
}
