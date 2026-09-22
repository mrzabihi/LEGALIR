// ============================================================
// LEGALIR — Server-side RBAC & Authorization
// ============================================================
// SERVER-ONLY. Every route handler that touches a protected resource
// must resolve the caller through `requireAuth` / `requirePermission`
// here. A frontend permission check is a UX affordance, never
// authorization.
//
// The role is stored on the user row (`role`). Legacy rows have no
// role and default to USER. Organization membership is resolved from
// the `org_members` table so a member's effective role follows their
// membership, not a stale copy on the user row.
// ============================================================

import { NextResponse } from "next/server";
import { findUserById, readTable, getAccountType, type DbUser } from "./db";
import { getUserIdFromRequest } from "./api/server-auth";
import {
  roleHasPermission,
  isOrgRole,
  normalizeAccountType,
  type Permission,
  type PlatformAccountType,
  type PlatformRole,
  type OrgMemberRole,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Effective identity
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  role: PlatformRole;
  accountType: PlatformAccountType;
  /** The organization the user belongs to, when org-scoped. */
  orgId: string | null;
  /** The user's role within that organization. */
  orgRole: OrgMemberRole | null;
}

/** The stored role, defaulting legacy rows to USER. */
export function getUserRole(user: DbUser): PlatformRole {
  return (user.role as PlatformRole | undefined) ?? "USER";
}

/**
 * Resolve the caller's full authorization context. Returns null when
 * unauthenticated. The org membership (when present) takes precedence
 * for org-scoped roles so a removed member loses access immediately.
 */
export function getAuthContext(req: Request): AuthContext | null {
  const userId = getUserIdFromRequest(req);
  if (!userId) return null;
  const user = findUserById(userId);
  if (!user) return null;

  const membership = findActiveMembership(userId);
  const baseRole = getUserRole(user);
  const role: PlatformRole = membership ? membership.role : baseRole;

  return {
    userId,
    role,
    accountType: getPlatformAccountType(user),
    orgId: membership?.orgId ?? user.orgId ?? null,
    orgRole: membership?.role ?? null,
  };
}

/** The platform account type, deriving it from the legacy field when absent. */
export function getPlatformAccountType(user: DbUser): PlatformAccountType {
  if (user.platformAccountType) return user.platformAccountType;
  return normalizeAccountType(getAccountType(user.id));
}

// ---------------------------------------------------------------------------
// Organization membership lookup
// ---------------------------------------------------------------------------

interface OrgMemberRow {
  id: string;
  orgId: string;
  userId: string;
  role: OrgMemberRole;
  status: string;
}

/** The user's active organization membership, if any. */
export function findActiveMembership(userId: string): OrgMemberRow | null {
  const rows = readTable<OrgMemberRow>("org_members");
  return rows.find((m) => m.userId === userId && m.status === "active") ?? null;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** A 401 response for an unauthenticated caller. */
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { code: "UNAUTHORIZED", message: "لطفاً وارد شوید" },
    { status: 401 }
  );
}

/** A 403 response for an authenticated caller lacking permission. */
export function forbidden(message = "شما به این بخش دسترسی ندارید"): NextResponse {
  return NextResponse.json({ code: "FORBIDDEN", message }, { status: 403 });
}

/** A 404 response — used to avoid leaking the existence of others' resources. */
export function notFound(message = "موردی یافت نشد"): NextResponse {
  return NextResponse.json({ code: "NOT_FOUND", message }, { status: 404 });
}

/**
 * Require an authenticated caller. Returns either the context or a
 * ready-to-return 401 response.
 */
export function requireAuth(
  req: Request
): { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse } {
  const ctx = getAuthContext(req);
  if (!ctx) return { ok: false, response: unauthorized() };
  return { ok: true, ctx };
}

/**
 * Require a specific permission. Returns the context or a 403.
 * Use this on every mutating route handler.
 */
export function requirePermission(
  req: Request,
  permission: Permission
): { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse } {
  const auth = requireAuth(req);
  if (!auth.ok) return auth;
  if (!roleHasPermission(auth.ctx.role, permission)) {
    return { ok: false, response: forbidden() };
  }
  return auth;
}

/** Require one of several permissions (any-of). */
export function requireAnyPermission(
  req: Request,
  permissions: Permission[]
): { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse } {
  const auth = requireAuth(req);
  if (!auth.ok) return auth;
  const allowed = permissions.some((p) => roleHasPermission(auth.ctx.role, p));
  if (!allowed) return { ok: false, response: forbidden() };
  return auth;
}

// ---------------------------------------------------------------------------
// Ownership checks (IDOR / BOLA prevention)
// ---------------------------------------------------------------------------

/**
 * True when the caller may read/write a resource owned by `ownerUserId`.
 * The owner always may; an org member with an org-wide permission may
 * when the resource belongs to their organization.
 */
export function canAccessOwnedResource(
  ctx: AuthContext,
  ownerUserId: string,
  orgId: string | null,
  orgPermission: Permission
): boolean {
  if (ctx.userId === ownerUserId) return true;
  if (orgId && ctx.orgId === orgId && roleHasPermission(ctx.role, orgPermission)) {
    return true;
  }
  return false;
}

/** True when the caller is platform staff with the given permission. */
export function isStaffWith(ctx: AuthContext, permission: Permission): boolean {
  return roleHasPermission(ctx.role, permission);
}

export { roleHasPermission, isOrgRole };
