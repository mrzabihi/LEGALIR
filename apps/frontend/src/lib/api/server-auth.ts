// ============================================================
// LEGALIR — Server-side auth helper (Route Handlers only)
// ============================================================
// Shared cookie-based session lookup for the v1 API routes that
// back the demo dataset (documents, contracts, memories).
// IMPORTANT: server-only — imports node-only db.ts, so never
// import this module from client components.
// ============================================================

import { findSessionById } from "@/lib/db";

/** The session id carried by the `legalir-session` cookie, if any. */
export function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  return match?.[1] ?? null;
}

/**
 * Resolve the authenticated user id from the `legalir-session` cookie.
 * Returns null when the cookie is missing or the session is invalid.
 */
export function getUserIdFromRequest(req: Request): string | null {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;
  return findSessionById(sessionId)?.userId ?? null;
}

/**
 * Resolve both the user id and the current session id. The session id is
 * needed to mark "this device" in the sessions list and to keep the current
 * session when revoking others.
 */
export function getAuthFromRequest(req: Request): { userId: string; sessionId: string } | null {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;
  const session = findSessionById(sessionId);
  if (!session) return null;
  return { userId: session.userId, sessionId };
}
