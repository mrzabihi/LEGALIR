// ============================================================
// LEGALIR — Admin · Organizations (server-only)
// ============================================================
// The operator's view of the legal entities registered on the platform.
//
// The user panel owns the registration flow (`lib/org-db.ts`); this module is
// the ADMIN projection over the same tables:
//
//   · `listAdminOrganizations` — a paginated, searchable list with the real
//     member/signatory counts and the owning representative's name, plus a
//     status summary computed over the WHOLE table so a filtered page still
//     reports the true shape of the register.
//   · `getAdminOrganization` — one dossier: the entity, its members (joined to
//     their real user identity) and its authorized signatories.
//   · `setAdminOrganizationStatus` — the ONLY mutation. Verification and
//     suspension are operator decisions, so they are recorded with the actor
//     and the before → after status by the caller's audit log.
//
// Nothing here invents a value: a missing trade name, national id or owner is
// reported as null and the UI renders «ثبت نشده».
// ============================================================

import { findUserById, getProfile } from "@/lib/db";
import {
  getOrganizationById,
  listOrgMembers,
  listOrganizations,
  listSignatories,
  updateOrganization,
} from "@/lib/org-db";
import {
  ORGANIZATION_LEGAL_TYPE_FA,
  ORGANIZATION_STATUS_FA,
  ORG_MEMBER_ROLE_FA,
  type Organization,
  type OrganizationLegalType,
  type OrganizationStatus,
} from "@legalir/types";
import { toE164Display } from "@legalir/validation";

export interface AdminOrganizationListItem {
  id: string;
  name: string;
  tradeName: string | null;
  legalType: OrganizationLegalType | null;
  legalTypeFa: string | null;
  nationalId: string | null;
  status: OrganizationStatus;
  statusFa: string;
  industry: string | null;
  province: string | null;
  city: string | null;
  ownerUserId: string;
  ownerNameFa: string | null;
  memberCount: number;
  signatoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganizationMember {
  id: string;
  userId: string;
  /** The readable system id (LG-…) when the user row has been backfilled. */
  publicId: string | null;
  displayNameFa: string | null;
  /** Full E.164 — the admin panel shows unmasked numbers by design. */
  mobile: string | null;
  role: string;
  roleFa: string;
  title: string | null;
  status: string;
  joinedAt: string | null;
  createdAt: string;
}

export interface AdminOrganizationSignatory {
  id: string;
  fullName: string;
  nationalCode: string | null;
  position: string | null;
  authorityType: string | null;
  phone: string | null;
  createdAt: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  tradeName: string | null;
  legalType: OrganizationLegalType | null;
  legalTypeFa: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  economicCode: string | null;
  registrationDate: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: OrganizationStatus;
  statusFa: string;
  ownerUserId: string;
  ownerNameFa: string | null;
  ownerMobile: string | null;
  members: AdminOrganizationMember[];
  signatories: AdminOrganizationSignatory[];
  createdAt: string;
  updatedAt: string;
}

/** The statuses an operator may set, in lifecycle order. */
export const ADMIN_ORG_STATUSES: OrganizationStatus[] = [
  "DRAFT",
  "PROFILE_INCOMPLETE",
  "PROFILE_COMPLETE",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
];

function legalTypeFa(t: OrganizationLegalType | null): string | null {
  return t ? (ORGANIZATION_LEGAL_TYPE_FA[t] ?? t) : null;
}

function statusFa(s: OrganizationStatus): string {
  return ORGANIZATION_STATUS_FA[s] ?? s;
}

function ownerName(org: Organization): string | null {
  const user = findUserById(org.ownerUserId);
  const profile = user ? getProfile(user.id) : null;
  return profile?.displayName?.trim() || user?.displayName?.trim() || null;
}

function countBy(orgId: string): { members: number; signatories: number } {
  return {
    members: listOrgMembers(orgId).filter((m) => m.status !== "suspended").length,
    signatories: listSignatories(orgId).length,
  };
}

function toListItem(org: Organization): AdminOrganizationListItem {
  const counts = countBy(org.id);
  return {
    id: org.id,
    name: org.name,
    tradeName: org.tradeName,
    legalType: org.legalType,
    legalTypeFa: legalTypeFa(org.legalType),
    nationalId: org.nationalId,
    status: org.status,
    statusFa: statusFa(org.status),
    industry: org.industry,
    province: org.province,
    city: org.city,
    ownerUserId: org.ownerUserId,
    ownerNameFa: ownerName(org),
    memberCount: counts.members,
    signatoryCount: counts.signatories,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

export interface AdminOrganizationQuery {
  search?: string;
  status?: OrganizationStatus;
  page?: number;
  pageSize?: number;
}

export type AdminOrganizationSummary = Record<OrganizationStatus, number> & { total: number };

export interface AdminOrganizationListResponse {
  items: AdminOrganizationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Counts over the WHOLE register, never just the current page. */
  summary: AdminOrganizationSummary;
}

function matchesSearch(org: Organization, needle: string): boolean {
  const haystack = [
    org.name,
    org.tradeName,
    org.nationalId,
    org.registrationNumber,
    org.industry,
    org.province,
    org.city,
    org.email,
    org.phone,
  ]
    .filter((v): v is string => Boolean(v))
    .concat(ownerName(org) ?? [])
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Every registered organization, filtered and paginated for the operator. */
export function listAdminOrganizations(
  query: AdminOrganizationQuery = {}
): AdminOrganizationListResponse {
  const pageSize = Math.max(1, Math.min(200, query.pageSize ?? 25));
  const all = listOrganizations().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const summary = {} as AdminOrganizationSummary;
  for (const s of ADMIN_ORG_STATUSES) summary[s] = 0;
  for (const o of all) summary[o.status] += 1;
  summary.total = all.length;

  let rows = all;
  if (query.status) rows = rows.filter((o) => o.status === query.status);
  const needle = query.search?.trim().toLowerCase();
  if (needle) rows = rows.filter((o) => matchesSearch(o, needle));

  const page = Math.max(1, query.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize).map(toListItem),
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
    summary,
  };
}

/** One organization dossier, or null when it does not exist. */
export function getAdminOrganization(id: string): AdminOrganization | null {
  const org = getOrganizationById(id);
  if (!org) return null;

  const members: AdminOrganizationMember[] = listOrgMembers(org.id).map((m) => {
    const user = findUserById(m.userId);
    const profile = user ? getProfile(user.id) : null;
    return {
      id: m.id,
      userId: m.userId,
      publicId: user?.publicId ?? null,
      displayNameFa: profile?.displayName?.trim() || user?.displayName?.trim() || null,
      mobile: user?.mobile ? toE164Display(user.mobile) : null,
      role: m.role,
      roleFa: ORG_MEMBER_ROLE_FA[m.role] ?? m.role,
      title: m.title,
      status: m.status,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
    };
  });

  const signatories: AdminOrganizationSignatory[] = listSignatories(org.id).map((s) => ({
    id: s.id,
    fullName: s.fullName,
    nationalCode: s.nationalCode,
    position: s.position,
    authorityType: s.authorityType,
    phone: s.phone,
    createdAt: s.createdAt,
  }));

  const owner = findUserById(org.ownerUserId);

  return {
    id: org.id,
    name: org.name,
    tradeName: org.tradeName,
    legalType: org.legalType,
    legalTypeFa: legalTypeFa(org.legalType),
    nationalId: org.nationalId,
    registrationNumber: org.registrationNumber,
    economicCode: org.economicCode,
    registrationDate: org.registrationDate,
    industry: org.industry,
    province: org.province,
    city: org.city,
    address: org.address,
    postalCode: org.postalCode,
    phone: org.phone,
    email: org.email,
    website: org.website,
    status: org.status,
    statusFa: statusFa(org.status),
    ownerUserId: org.ownerUserId,
    ownerNameFa: ownerName(org),
    ownerMobile: owner?.mobile ? toE164Display(owner.mobile) : null,
    members,
    signatories,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

export type SetOrgStatusResult =
  | { ok: true; before: OrganizationStatus; organization: AdminOrganization }
  | { ok: false; reason: "not_found" | "invalid_status" };

/**
 * Move an organization to a new lifecycle status.
 *
 * The transition table is deliberately permissive — an operator may suspend,
 * re-activate or reject any entity — but the STATUS ITSELF must be one of the
 * seven the product defines, so a typo can never write a value the rest of the
 * platform cannot interpret. A no-op change is still recorded, because "who
 * re-affirmed this state and when" is part of the verification trail.
 */
export function setAdminOrganizationStatus(id: string, status: string): SetOrgStatusResult {
  const org = getOrganizationById(id);
  if (!org) return { ok: false, reason: "not_found" };
  if (!(ADMIN_ORG_STATUSES as string[]).includes(status)) {
    return { ok: false, reason: "invalid_status" };
  }

  const before = org.status;
  const updated = updateOrganization(org.id, { status: status as OrganizationStatus });
  if (!updated) return { ok: false, reason: "not_found" };

  const dossier = getAdminOrganization(org.id);
  if (!dossier) return { ok: false, reason: "not_found" };
  return { ok: true, before, organization: dossier };
}
