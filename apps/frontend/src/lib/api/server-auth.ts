// ============================================================
// LEGALIR — Server-side auth helper (Route Handlers only)
// ============================================================
// Shared cookie-based session lookup for the v1 API routes that
// back the demo dataset (documents, contracts, memories).
// IMPORTANT: server-only — imports node-only db.ts, so never
// import this module from client components.
// ============================================================

import { findSessionById } from "@/lib/db";

/**
 * Resolve the authenticated user id from the `legalir-session` cookie.
 * Returns null when the cookie is missing or the session is invalid.
 */
export function getUserIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}
