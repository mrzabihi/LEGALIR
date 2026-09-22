// ============================================================
// LEGALIR — Organization Foundation (JSON tables)
// ============================================================
// Tables:
//   organizations — one row per legal entity
//   org_members   — membership + role within an organization
//
// A user belongs to at most one organization in this phase. The
// membership row is the source of truth for the user's effective
// org-scoped role (see lib/rbac.ts).
// ============================================================

import { readTable, writeTable } from "./db";
import type {
  Organization,
  OrgMember,
  OrgMemberRole,
  OrgMembership,
  OrganizationAuthorizedSignatory,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listOrganizations(): Organization[] {
  return readTable<Organization>("organizations");
}

export function getOrganizationById(id: string): Organization | undefined {
  return listOrganizations().find((o) => o.id === id);
}

export function listOrgMembers(orgId: string): OrgMember[] {
  return readTable<OrgMember>("org_members")
    .filter((m) => m.orgId === orgId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getMembership(userId: string): OrgMembership | null {
  const member = readTable<OrgMember>("org_members").find(
    (m) => m.userId === userId && m.status === "active"
  );
  if (!member) return null;
  const org = getOrganizationById(member.orgId);
  if (!org) return null;
  return { org, member };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function createOrganization(org: Organization): Organization {
  const rows = listOrganizations();
  rows.push(org);
  writeTable("organizations", rows);
  return org;
}

export function updateOrganization(
  id: string,
  patch: Partial<Omit<Organization, "id" | "ownerUserId" | "createdAt">>
): Organization | undefined {
  const rows = listOrganizations();
  const idx = rows.findIndex((o) => o.id === id);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, ...patch, updatedAt: new Date().toISOString() };
  writeTable("organizations", rows);
  return rows[idx];
}

export function addOrgMember(member: OrgMember): OrgMember {
  const rows = readTable<OrgMember>("org_members");
  rows.push(member);
  writeTable("org_members", rows);
  return member;
}

export function updateOrgMember(
  memberId: string,
  patch: Partial<Omit<OrgMember, "id" | "orgId" | "userId" | "createdAt">>
): OrgMember | undefined {
  const rows = readTable<OrgMember>("org_members");
  const idx = rows.findIndex((m) => m.id === memberId);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, ...patch };
  writeTable("org_members", rows);
  return rows[idx];
}

export function removeOrgMember(orgId: string, memberId: string): boolean {
  const rows = readTable<OrgMember>("org_members");
  const next = rows.filter((m) => !(m.id === memberId && m.orgId === orgId));
  if (next.length === rows.length) return false;
  writeTable("org_members", next);
  return true;
}

/** True when the user already belongs to an organization. */
export function userHasOrg(userId: string): boolean {
  return readTable<OrgMember>("org_members").some(
    (m) => m.userId === userId && m.status === "active"
  );
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Find an organization by its national ID (شناسه ملی). Used to prevent a
 * silent duplicate: the same legal entity must not be registered twice.
 */
export function findOrganizationByNationalId(
  nationalId: string
): Organization | undefined {
  const normalized = nationalId.trim();
  if (!normalized) return undefined;
  return listOrganizations().find((o) => o.nationalId?.trim() === normalized);
}

// ---------------------------------------------------------------------------
// Atomic create + owner membership
// ---------------------------------------------------------------------------

export interface CreateOrganizationWithOwnerInput {
  org: Organization;
  /** The user who becomes the OWNER / representative. */
  ownerUserId: string;
  /** The representative's job title within the organization. */
  representativeTitle?: string | null;
}

/**
 * Create an organization AND its owner membership in one step. The creator
 * becomes a COMPANY_OWNER member — the representative relationship is real
 * (a membership row), not a flag on the user. The user's own identity is
 * untouched: they remain a person who happens to represent this entity.
 */
export function createOrganizationWithOwner(
  input: CreateOrganizationWithOwnerInput
): { org: Organization; member: OrgMember } {
  const org = createOrganization(input.org);
  const now = new Date().toISOString();
  const member: OrgMember = {
    id: crypto.randomUUID(),
    orgId: org.id,
    userId: input.ownerUserId,
    role: "COMPANY_OWNER",
    title: input.representativeTitle ?? null,
    status: "active",
    invitedByUserId: null,
    joinedAt: now,
    createdAt: now,
  };
  addOrgMember(member);
  return { org, member };
}

// ---------------------------------------------------------------------------
// Authorized signatories
// ---------------------------------------------------------------------------
// A signatory is an official record, NOT a platform user. Kept in its own
// table so it never implies login access.

export function listSignatories(orgId: string): OrganizationAuthorizedSignatory[] {
  return readTable<OrganizationAuthorizedSignatory>("org_signatories")
    .filter((s) => s.orgId === orgId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function addSignatory(
  signatory: OrganizationAuthorizedSignatory
): OrganizationAuthorizedSignatory {
  const rows = readTable<OrganizationAuthorizedSignatory>("org_signatories");
  rows.push(signatory);
  writeTable("org_signatories", rows);
  return signatory;
}

export function removeSignatory(orgId: string, signatoryId: string): boolean {
  const rows = readTable<OrganizationAuthorizedSignatory>("org_signatories");
  const next = rows.filter((s) => !(s.id === signatoryId && s.orgId === orgId));
  if (next.length === rows.length) return false;
  writeTable("org_signatories", next);
  return true;
}

export type { OrgMemberRole };
