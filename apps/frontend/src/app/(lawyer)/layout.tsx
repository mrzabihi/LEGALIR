// ============================================================
// LEGALIR — Lawyer workbench layout (dedicated route group)
// ============================================================
// The workbench lives in its own route group so it gets its own chrome (the
// LawyerShell sidebar) instead of the consumer app shell — exactly the way
// the admin console is isolated.
//
// Authorization is enforced HERE, on the server, before the page renders:
// a signed-in non-lawyer is redirected to the consumer dashboard, and a
// guest goes to the login page. Hiding the menu is never the boundary; every
// `/api/v1/lawyer/**` route re-checks the permission and the lawyer profile
// from the session (lib/lawyer-portal/http.ts).
// ============================================================

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LawyerShell } from "@/components/lawyer/lawyer-shell";
import { findSessionById, findUserById } from "@/lib/db";
import { findActiveMembership, getUserRole } from "@/lib/rbac";
import { NOINDEX_ROBOTS } from "@/lib/site";

// The workbench is private and must never appear in search results.
export const metadata: Metadata = { ...NOINDEX_ROBOTS };

export default async function LawyerLayout({ children }: { children: React.ReactNode }) {
  const sessionId = (await cookies()).get("legalir-session")?.value;
  const session = sessionId ? findSessionById(sessionId) : undefined;
  const user = session ? findUserById(session.userId) : undefined;

  // No valid session: send the visitor through the normal login flow, and
  // preserve the workbench path as the post-login intent.
  if (!session || !user) redirect("/auth/mobile?intent=%2Flawyer");

  // Organization membership wins over the stored row, matching getAuthContext.
  const role = findActiveMembership(user.id)?.role ?? getUserRole(user);
  if (role !== "LAWYER") redirect("/dashboard");

  return <LawyerShell>{children}</LawyerShell>;
}
