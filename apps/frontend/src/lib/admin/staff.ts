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

import {
  readTable,
  findUserById,
  setUserRole,
  normalizeStoredMobile,
  listSessionsForUser,
} from "@/lib/db";
import { getOrganizationById } from "@/lib/org-db";
import {
  STAFF_ROLES,
  PLATFORM_SUPERADMIN_ROLES,
  roleHasPermission,
  ROLE_FA,
  ROLE_PERMISSIONS,
  type Permission,
  type PlatformRole,
  type StaffMember,
  type StaffDetail,
  type RoleDescriptor,
} from "@legalir/types";

export type { StaffMember, StaffDetail, RoleDescriptor };

interface UserRow {
  id: string;
  mobile: string;
  email: string | null;
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

/**
 * The most recent activity across the user's sessions — the truthful "last
 * login / last activity" signal (there is no dedicated column, so this reads
 * the same session table the auth layer already maintains). Returns null when
 * the user has no recorded session.
 */
function lastActiveAt(userId: string): string | null {
  const sessions = listSessionsForUser(userId);
  if (sessions.length === 0) return null;
  // listSessionsForUser is already sorted newest-first by lastActiveAt.
  const top = sessions[0]!;
  return top.lastActiveAt ?? top.createdAt;
}

/** The shared, client-safe projection of one user row into a staff listing. */
function toStaffMember(u: UserRow): StaffMember {
  const role = u.role as PlatformRole;
  return {
    id: u.id,
    displayName: u.displayName,
    mobileMasked: mask(u.mobile),
    email: u.email ?? null,
    role,
    roleFa: ROLE_FA[role] ?? String(role),
    orgId: u.orgId ?? null,
    createdAt: u.createdAt,
    lastActiveAt: lastActiveAt(u.id),
  };
}

/** Every user holding a platform-staff role, optionally filtered. */
export function listStaff(filter: { search?: string; role?: string } = {}): StaffMember[] {
  const search = filter.search?.trim().toLowerCase();
  return readTable<UserRow>("users")
    .filter((u) => u.role && STAFF_ROLES.includes(u.role))
    .filter((u) => (filter.role ? u.role === filter.role : true))
    .map(toStaffMember)
    .filter((m) =>
      search
        ? (m.displayName ?? "").toLowerCase().includes(search) ||
          (m.email ?? "").toLowerCase().includes(search) ||
          m.id.toLowerCase().includes(search)
        : true
    )
    .sort((a, b) => a.roleFa.localeCompare(b.roleFa, "fa"));
}

/** The full dossier for one staff member, or undefined when not staff/found. */
export function getStaffMember(id: string): StaffDetail | undefined {
  const u = readTable<UserRow>("users").find((row) => row.id === id);
  if (!u || !u.role || !STAFF_ROLES.includes(u.role)) return undefined;
  const role = u.role as PlatformRole;
  const org = u.orgId ? getOrganizationById(u.orgId) : undefined;
  return {
    ...toStaffMember(u),
    permissions: [...(ROLE_PERMISSIONS[role] ?? [])] as Permission[],
    isStaff: STAFF_ROLES.includes(role),
    isSuperAdmin: PLATFORM_SUPERADMIN_ROLES.includes(role),
    orgName: org?.name ?? null,
  };
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
  return toStaffMember(updated);
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
