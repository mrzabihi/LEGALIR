// ============================================================
// LEGALIR — Admin staff & roles (server-only)
// ============================================================
// Lists the platform's staff (every user holding a staff role) and lets a
// super-admin change a user's role. A role change is a sensitive action:
// the caller must hold `admin:staff:manage`, and the LAST remaining user who
// can manage roles can never be stripped of that power (a lockout guard).
//
// No secrets are read or returned here — only identity + role metadata.
// ============================================================

import { readTable, findUserById, setUserRole, normalizeStoredMobile } from "@/lib/db";
import {
  STAFF_ROLES,
  PLATFORM_SUPERADMIN_ROLES,
  roleHasPermission,
  ROLE_FA,
  ROLE_PERMISSIONS,
  type Permission,
  type PlatformRole,
  type StaffMember,
  type RoleDescriptor,
} from "@legalir/types";

export type { StaffMember, RoleDescriptor };

interface UserRow {
  id: string;
  mobile: string;
  displayName: string | null;
  role?: PlatformRole;
  orgId?: string | null;
  createdAt: string;
}

/** Mask a mobile for a staff listing (first 4 + last 4). */
function mask(mobile: string): string {
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

/** Every user holding a platform-staff role. */
export function listStaff(): StaffMember[] {
  return readTable<UserRow>("users")
    .filter((u) => u.role && STAFF_ROLES.includes(u.role))
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      mobileMasked: mask(u.mobile),
      role: u.role as PlatformRole,
      roleFa: ROLE_FA[u.role as PlatformRole] ?? String(u.role),
      orgId: u.orgId ?? null,
      createdAt: u.createdAt,
    }))
    .sort((a, b) => a.roleFa.localeCompare(b.roleFa, "fa"));
}

/**
 * The number of users who can actually restore roles — i.e. hold
 * `admin:staff:manage`. This is the set the lockout guard must anchor on:
 * only these users can re-grant any role, so the platform must always keep at
 * least one. `PLATFORM_SUPERADMIN_ROLES` is deliberately NOT used here — it is
 * broader (it also contains ADMIN, a full operator that is NOT permitted to
 * manage staff), so counting it would let the last role-manager be demoted
 * while an ADMIN remains, locking the platform out of all role management.
 */
function roleManagerCount(): number {
  return readTable<UserRow>("users").filter(
    (u) => u.role && roleHasPermission(u.role, "admin:staff:manage")
  ).length;
}

export interface ChangeRoleInput {
  userId: string;
  role: PlatformRole;
  actorUserId: string;
}

/**
 * Change a user's platform role. Refuses to strip role-management from the
 * last user who holds it, so the platform can never be locked out of
 * administration.
 */
export function changeUserRole(input: ChangeRoleInput): StaffMember | { error: string } {
  const user = findUserById(input.userId);
  if (!user) return { error: "USER_NOT_FOUND" };

  const currentRole = (user.role ?? "USER") as PlatformRole;
  const losingRoleManagement =
    roleHasPermission(currentRole, "admin:staff:manage") &&
    !roleHasPermission(input.role, "admin:staff:manage");

  if (losingRoleManagement && roleManagerCount() <= 1) {
    return { error: "LAST_SUPERADMIN" };
  }

  const updated = setUserRole(input.userId, input.role);
  if (!updated) return { error: "USER_NOT_FOUND" };
  return {
    id: updated.id,
    displayName: updated.displayName,
    mobileMasked: mask(updated.mobile),
    role: input.role,
    roleFa: ROLE_FA[input.role] ?? input.role,
    orgId: updated.orgId ?? null,
    createdAt: updated.createdAt,
  };
}

/** The full role → permission matrix for the roles/security admin page. */
export function listRoles(): RoleDescriptor[] {
  return (Object.keys(ROLE_PERMISSIONS) as PlatformRole[]).map((role) => ({
    role,
    roleFa: ROLE_FA[role] ?? role,
    isStaff: STAFF_ROLES.includes(role),
    isSuperAdmin: PLATFORM_SUPERADMIN_ROLES.includes(role),
    permissions: [...ROLE_PERMISSIONS[role]],
  }));
}
