// ============================================================
// LEGALIR — Role home route
// ============================================================
// The single mapping from an authenticated role to the workspace it opens
// after sign-in. It is used on the SERVER (login routes return it as
// `redirectTo`) and, for the already-signed-in case, by the client auth
// guard — never as an authorization decision. Resource access is still
// enforced per API by `lib/rbac.ts`.
//
// A lawyer account belongs in the lawyer workbench (پنل وکیل), not the
// consumer dashboard and not the operator console. Staff keep the consumer
// home: the admin console has its own host/entry point and no login route
// here should silently move an operator between consoles.
// ============================================================

import type { PlatformRole } from "@legalir/types";

/** The default workspace for a role when no explicit intent exists. */
export function homeRouteForRole(role: PlatformRole | null | undefined): string {
  return role === "LAWYER" ? "/lawyer" : "/dashboard";
}
