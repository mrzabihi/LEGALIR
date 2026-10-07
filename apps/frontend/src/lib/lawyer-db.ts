// ============================================================
// LEGALIR — Lawyer Domain (JSON tables + queries)
// ============================================================
// Tables:
//   lawyer_profiles  — one row per lawyer (LawyerProfile)
//   lawyer_reviews   — client reviews (feeds performance.averageRating)
//
// Performance metrics are DERIVED from real events, never fabricated:
//   acceptedRequests / completedCases  ← legal_requests + cases
//   medianResponseMinutes              ← request acceptance timestamps
//   averageRating / reviewCount        ← lawyer_reviews
// ============================================================

import { readTable, writeTable } from "./db";
import { listRequestsForLawyer, listRequestEvents } from "./legal-request-db";
import type {
  LawyerProfile,
  LawyerListItem,
  LawyerSearchFilters,
  LawyerListResponse,
  LawyerFacets,
  LawyerVerificationStatus,
  LawyerPerformance,
  LawyerDetail,
  LawyerReview,
  LawyerReviewRecord,
  LawyerDisplaySettings,
  LawyerMarketplaceVisibility,
  AdminLawyerStatus,
  LawyerDecisionBucket,
  AdminLawyerListItem,
} from "@legalir/types";
import {
  isTaxonomyDescendantOf,
  taxonomySearchText,
  normalizeFa,
  lawyerServiceLabel,
  LAWYER_EXPERIENCE_BANDS,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface LawyerReviewRow {
  id: string;
  lawyerId: string;
  authorUserId: string;
  /** 1–5. */
  rating: number;
  comment: string;
  /** Soft-hide flag set by a review moderator. Absent = visible. */
  hidden?: boolean;
  /** Review tied to a completed engagement. Absent = false. */
  verifiedEngagement?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * One append-only record of a verification decision. The stored profile only
 * carries the LATEST status; this table is the full history behind it, so
 * «who changed what, when, and why» can never be lost by an overwrite.
 */
export interface LawyerStatusDecisionRow {
  id: string;
  lawyerId: string;
  previousStatus: LawyerVerificationStatus;
  newStatus: LawyerVerificationStatus;
  /** Mandatory justification supplied by the deciding admin. */
  reason: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listLawyerProfiles(): LawyerProfile[] {
  return readTable<LawyerProfile>("lawyer_profiles");
}

export function getLawyerProfileById(id: string): LawyerProfile | undefined {
  return listLawyerProfiles().find((l) => l.id === id);
}

export function getLawyerProfileByUserId(userId: string): LawyerProfile | undefined {
  return listLawyerProfiles().find((l) => l.userId === userId);
}

/**
 * The PUBLIC reviews for a lawyer — hidden reviews are excluded, so a
 * moderation action immediately changes the visible list AND the derived
 * rating (both read through this function).
 */
export function listLawyerReviews(lawyerId: string): LawyerReviewRow[] {
  return readTable<LawyerReviewRow>("lawyer_reviews")
    .filter((r) => r.lawyerId === lawyerId && !r.hidden)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every review row for a lawyer, INCLUDING hidden ones (admin only). */
export function listLawyerReviewRows(lawyerId: string): LawyerReviewRow[] {
  return readTable<LawyerReviewRow>("lawyer_reviews")
    .filter((r) => r.lawyerId === lawyerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The admin-facing review records (with hide state) for a lawyer. */
export function listLawyerReviewRecords(lawyerId: string): LawyerReviewRecord[] {
  return listLawyerReviewRows(lawyerId).map((r) => ({
    id: r.id,
    lawyerId: r.lawyerId,
    authorName: "کاربر لگالیر",
    authorUserId: r.authorUserId || null,
    rating: r.rating,
    comment: r.comment,
    hidden: Boolean(r.hidden),
    verifiedEngagement: Boolean(r.verifiedEngagement),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? r.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function upsertLawyerProfile(profile: LawyerProfile): LawyerProfile {
  const rows = listLawyerProfiles();
  const idx = rows.findIndex((l) => l.id === profile.id);
  const next = { ...profile, updatedAt: new Date().toISOString() };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeTable("lawyer_profiles", rows);
  return next;
}

export function createLawyerReview(row: LawyerReviewRow): LawyerReviewRow {
  const rows = readTable<LawyerReviewRow>("lawyer_reviews");
  rows.push(row);
  writeTable("lawyer_reviews", rows);
  return row;
}

/** Apply a verification decision. Server-side only. */
export function setVerificationStatus(
  lawyerId: string,
  status: LawyerVerificationStatus,
  note: string | null
): LawyerProfile | undefined {
  const rows = listLawyerProfiles();
  const idx = rows.findIndex((l) => l.id === lawyerId);
  if (idx === -1) return undefined;
  const row = rows[idx]!;
  row.verificationStatus = status;
  row.verificationNote = note;
  row.verifiedAt = status === "VERIFIED" ? new Date().toISOString() : row.verifiedAt;
  row.updatedAt = new Date().toISOString();
  writeTable("lawyer_profiles", rows);
  return row;
}

/**
 * Force an admin suspension/rejection to win over the lawyer's self-declared
 * availability. VERIFIED and the submitted funnel keep whatever the lawyer
 * set; SUSPENDED/REJECTED are terminal and authoritative. Returns a profile
 * copy — never mutates the caller's object.
 */
function withStatusAvailability(profile: LawyerProfile): LawyerProfile {
  if (profile.verificationStatus === "SUSPENDED") {
    return { ...profile, availabilityStatus: "SUSPENDED", acceptingRequests: false };
  }
  if (profile.verificationStatus === "REJECTED") {
    return { ...profile, availabilityStatus: "REJECTED", acceptingRequests: false };
  }
  return profile;
}

// ---------------------------------------------------------------------------
// Status decision history (append-only)
// ---------------------------------------------------------------------------

/** Append one decision record. The caller must already hold a reason. */
export function recordStatusDecision(row: LawyerStatusDecisionRow): LawyerStatusDecisionRow {
  const rows = readTable<LawyerStatusDecisionRow>("lawyer_status_history");
  rows.push(row);
  writeTable("lawyer_status_history", rows);
  return row;
}

/** The full decision history for a lawyer, newest first. */
export function listStatusHistory(lawyerId: string): LawyerStatusDecisionRow[] {
  return readTable<LawyerStatusDecisionRow>("lawyer_status_history")
    .filter((d) => d.lawyerId === lawyerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The most recent decision for a lawyer, if any. */
export function latestStatusDecision(lawyerId: string): LawyerStatusDecisionRow | undefined {
  return listStatusHistory(lawyerId)[0];
}

// ---------------------------------------------------------------------------
// Derived performance
// ---------------------------------------------------------------------------

/**
 * Recompute a lawyer's performance from real platform events. The
 * stored `performance` is refreshed on read so it can never drift from
 * the underlying requests, cases and reviews.
 */
export function computePerformance(lawyerId: string): LawyerPerformance {
  const reviews = listLawyerReviews(lawyerId);
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
      : null;

  const requests = listRequestsForLawyer(lawyerId);
  const acceptedRequests = requests.filter((r) =>
    ["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_FOR_LAWYER", "COMPLETED", "CLOSED"].includes(r.state)
  ).length;
  const completedCases = requests.filter((r) => r.state === "COMPLETED" || r.state === "CLOSED").length;

  // Median first-response time: from request creation to the acceptance
  // event, for requests that were accepted.
  const responseMinutes: number[] = [];
  for (const req of requests) {
    const events = listRequestEvents(req.id);
    const accepted = events.find((e) => e.toState === "ACCEPTED");
    if (!accepted) continue;
    const delta = new Date(accepted.createdAt).getTime() - new Date(req.createdAt).getTime();
    if (delta >= 0) responseMinutes.push(Math.round(delta / 60_000));
  }
  const medianResponseMinutes = median(responseMinutes);

  return {
    acceptedRequests,
    completedCases,
    medianResponseMinutes,
    averageRating,
    reviewCount,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

// ---------------------------------------------------------------------------
// Projection & filtering
// ---------------------------------------------------------------------------

/**
 * Resolve the rating + review count a surface should DISPLAY. The admin
 * override wins when set; otherwise the derived performance values are used.
 * Kept in one place so the card, the profile and the admin table never
 * disagree on the number shown.
 */
export function resolveDisplay(
  profile: LawyerProfile,
  performance: LawyerPerformance
): { displayRating: number | null; displayReviewCount: number } {
  const display: LawyerDisplaySettings | null | undefined = profile.display;
  return {
    displayRating: display?.ratingOverride ?? performance.averageRating ?? null,
    displayReviewCount: display?.reviewCountOverride ?? performance.reviewCount,
  };
}

/** The lawyer's primary specialty node id (expertise first, else specializations). */
export function primarySpecialtyIdOf(profile: LawyerProfile): string | null {
  const primary = profile.expertise?.find((e) => e.isPrimary);
  if (primary) return primary.taxonomyNodeId;
  return profile.specializations[0]?.category ?? null;
}

/** Project a full profile into the public list-item shape. */
export function toListItem(profile: LawyerProfile): LawyerListItem {
  const p = withStatusAvailability(profile);
  const bio = p.bio.trim();
  const performance = computePerformance(p.id);
  const { displayRating, displayReviewCount } = resolveDisplay(p, performance);
  return {
    id: p.id,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
    avatarType: p.avatarType ?? "real",
    professionalTitle: p.professionalTitle ?? null,
    verificationStatus: p.verificationStatus,
    specializations: p.specializations,
    locations: p.locations,
    languages: p.languages,
    pricing: p.pricing,
    performance,
    // Legacy rows predate these fields — default to a requestable status
    // so an old profile is never silently hidden behind a disabled CTA.
    availabilityStatus: p.availabilityStatus ?? "ACTIVE",
    consultationCapacity: p.consultationCapacity ?? null,
    isDemo: p.isDemo,
    acceptingRequests: p.acceptingRequests,
    bioExcerpt: bio.length > 140 ? `${bio.slice(0, 140)}…` : bio,
    // --- Extended card fields ---
    professionalRank: p.professionalRank ?? null,
    organizationType: p.organizationType ?? null,
    gender: p.gender ?? null,
    featured: p.featured ?? false,
    acceptingClients: p.acceptingClients ?? p.acceptingRequests,
    yearsExperience: p.yearsExperience ?? yearsOfExperience(p),
    displayRating,
    displayReviewCount,
    primarySpecialtyId: primarySpecialtyIdOf(p),
    serviceIds: p.services?.filter((s) => s.enabled).map((s) => s.serviceId) ?? [],
  };
}

/**
 * Project a full profile into the public detail shape. Reviews carry a
 * display name only — the reviewer's user id is never exposed. Shared by
 * the public profile route and the consultation case room so both render
 * the same lawyer.
 */
export function toLawyerDetail(profile: LawyerProfile): LawyerDetail {
  const p = withStatusAvailability(profile);
  const reviews: LawyerReview[] = listLawyerReviews(p.id).map((r) => ({
    id: r.id,
    authorName: "کاربر لگالیر",
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    verifiedEngagement: Boolean(r.verifiedEngagement),
  }));
  const performance = computePerformance(p.id);
  const { displayRating, displayReviewCount } = resolveDisplay(p, performance);

  return {
    id: p.id,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
    avatarType: p.avatarType ?? "real",
    professionalTitle: p.professionalTitle ?? null,
    bio: p.bio,
    licenseNumber: p.licenseNumber,
    licenseYear: p.licenseYear,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt,
    specializations: p.specializations,
    locations: p.locations,
    languages: p.languages,
    pricing: p.pricing,
    availability: p.availability,
    performance,
    availabilityStatus: p.availabilityStatus ?? "ACTIVE",
    consultationCapacity: p.consultationCapacity ?? null,
    isDemo: p.isDemo,
    acceptingRequests: p.acceptingRequests,
    reviews,
    // --- Extended profile sections ---
    professionalRank: p.professionalRank ?? null,
    organizationType: p.organizationType ?? null,
    licenseStatus: p.licenseStatus ?? null,
    gender: p.gender ?? null,
    featured: p.featured ?? false,
    acceptingClients: p.acceptingClients ?? p.acceptingRequests,
    yearsExperience: p.yearsExperience ?? yearsOfExperience(p),
    expertise: p.expertise ?? [],
    services: p.services ?? [],
    education: p.education ?? [],
    experience: p.experience ?? [],
    jurisdictions: p.jurisdictions ?? [],
    displayRating,
    displayReviewCount,
  };
}

/** Total years of experience across all specialties (max, not sum). */
export function yearsOfExperience(profile: LawyerProfile): number {
  return profile.specializations.reduce((max, s) => Math.max(max, s.yearsExperience), 0);
}

/**
 * Filter + sort the marketplace. Only VERIFIED lawyers are shown in the
 * public marketplace unless `verifiedOnly` is explicitly false — an
 * unverified lawyer must never appear as a bookable option.
 *
 * A SUSPENDED lawyer is the one exception: their profile stays visible (for
 * transparency) but is flagged with an alert and can never take a request
 * (see `withStatusAvailability`). REJECTED and every pending state remain
 * hidden.
 */
export function queryLawyers(filters: LawyerSearchFilters): LawyerListResponse {
  const verifiedOnly = filters.verifiedOnly ?? true;
  let rows = listLawyerProfiles();

  if (verifiedOnly) {
    rows = rows.filter(
      (l) => l.verificationStatus === "VERIFIED" || l.verificationStatus === "SUSPENDED"
    );
  }
  // Marketplace visibility: HIDDEN profiles never appear in the listing. A
  // SUSPENDED lawyer stays visible (transparency) — see withStatusAvailability.
  rows = rows.filter((l) => (l.visibility ?? "PUBLIC") !== "HIDDEN");

  /** Every taxonomy node id a lawyer is tagged on. */
  const nodesOf = (l: LawyerProfile): string[] => {
    const fromExpertise = (l.expertise ?? []).map((e) => e.taxonomyNodeId);
    const fromSpecs = l.specializations.map((s) => s.category);
    return [...new Set([...fromExpertise, ...fromSpecs])];
  };

  // category OR any chosen specialty — a lawyer tagged on a DESCENDANT of a
  // selected node also matches (e.g. picking «خانواده» matches «طلاق توافقی»).
  const specialtyFilter = [
    ...(filters.category ? [filters.category] : []),
    ...(filters.specialtyIds ?? []),
  ];
  if (specialtyFilter.length > 0) {
    rows = rows.filter((l) => {
      const nodes = nodesOf(l);
      return specialtyFilter.some((sel) => nodes.some((n) => isTaxonomyDescendantOf(n, sel)));
    });
  }
  if (filters.province) {
    rows = rows.filter((l) => l.locations.some((loc) => loc.province === filters.province));
  }
  if (filters.city) {
    rows = rows.filter((l) => l.locations.some((loc) => loc.city === filters.city));
  }
  if (typeof filters.maxFeeToman === "number") {
    rows = rows.filter((l) => l.pricing.consultationFeeToman <= filters.maxFeeToman!);
  }
  if (filters.remoteOnly) {
    rows = rows.filter((l) => l.locations.some((loc) => loc.remote));
  }
  if (filters.professionalRanks && filters.professionalRanks.length > 0) {
    rows = rows.filter(
      (l) => l.professionalRank != null && filters.professionalRanks!.includes(l.professionalRank)
    );
  }
  if (filters.organizationTypes && filters.organizationTypes.length > 0) {
    rows = rows.filter(
      (l) => l.organizationType != null && filters.organizationTypes!.includes(l.organizationType)
    );
  }
  if (filters.serviceIds && filters.serviceIds.length > 0) {
    rows = rows.filter((l) => {
      const ids = (l.services ?? []).filter((s) => s.enabled).map((s) => s.serviceId);
      return filters.serviceIds!.some((s) => ids.includes(s));
    });
  }
  if (filters.jurisdictionIds && filters.jurisdictionIds.length > 0) {
    rows = rows.filter((l) => {
      const ids = l.jurisdictions ?? [];
      return filters.jurisdictionIds!.some((j) => ids.includes(j));
    });
  }
  if (filters.acceptingClientsOnly) {
    rows = rows.filter((l) => l.acceptingClients ?? l.acceptingRequests);
  }
  if (filters.onlineOnly) {
    rows = rows.filter((l) =>
      (l.services ?? []).some((s) => s.enabled && ["online_consult", "phone_consult", "written_consult"].includes(s.serviceId))
    );
  }
  if (filters.featuredOnly) {
    rows = rows.filter((l) => l.featured === true);
  }
  if (typeof filters.minRating === "number") {
    rows = rows.filter((l) => {
      const perf = computePerformance(l.id);
      const rating = l.display?.ratingOverride ?? perf.averageRating ?? 0;
      return rating >= filters.minRating!;
    });
  }
  if (filters.experienceBand) {
    const band = LAWYER_EXPERIENCE_BANDS.find((b) => b.id === filters.experienceBand);
    if (band) {
      rows = rows.filter((l) => {
        const years = l.yearsExperience ?? yearsOfExperience(l);
        return years >= band.min && (band.max === null || years < band.max);
      });
    }
  }
  if (filters.search) {
    const q = normalizeFa(filters.search.toLowerCase());
    rows = rows.filter((l) => {
      const specialtyLabels = nodesOf(l).map(taxonomySearchText).join(" ");
      const serviceLabels = (l.services ?? [])
        .map((s) => lawyerServiceLabel(s.serviceId))
        .join(" ");
      const haystack = normalizeFa(
        [
          l.fullName,
          l.bio,
          l.professionalTitle ?? "",
          specialtyLabels,
          serviceLabels,
          ...l.locations.map((loc) => `${loc.province} ${loc.city}`),
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }

  const items = rows.map(toListItem);

  const sort = filters.sort ?? "relevance";
  items.sort((a, b) => {
    switch (sort) {
      case "rating":
        return (b.displayRating ?? 0) - (a.displayRating ?? 0);
      case "experience": {
        const ea = a.yearsExperience ?? 0;
        const eb = b.yearsExperience ?? 0;
        return eb - ea;
      }
      case "price_asc":
        return a.pricing.consultationFeeToman - b.pricing.consultationFeeToman;
      case "price_desc":
        return b.pricing.consultationFeeToman - a.pricing.consultationFeeToman;
      default:
        // relevance: featured, then accepting, then rating
        return (
          Number(b.featured ?? false) - Number(a.featured ?? false) ||
          Number(b.acceptingRequests) - Number(a.acceptingRequests) ||
          (b.displayRating ?? 0) - (a.displayRating ?? 0)
        );
    }
  });

  // Facets are computed over the FILTERED set (pre-pagination) so the filter
  // UI can show how many lawyers each option would add.
  const facets = buildFacets(rows, items.length);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    facets,
  };
}

/** Count the filtered rows per specialty/province/rank/organisation. */
function buildFacets(rows: LawyerProfile[], total: number): LawyerFacets {
  const bySpecialty: Record<string, number> = {};
  const byProvince: Record<string, number> = {};
  const byRank: Record<string, number> = {};
  const byOrganization: Record<string, number> = {};
  for (const l of rows) {
    for (const s of l.specializations) bySpecialty[s.category] = (bySpecialty[s.category] ?? 0) + 1;
    for (const loc of l.locations) byProvince[loc.province] = (byProvince[loc.province] ?? 0) + 1;
    if (l.professionalRank) byRank[l.professionalRank] = (byRank[l.professionalRank] ?? 0) + 1;
    if (l.organizationType) byOrganization[l.organizationType] = (byOrganization[l.organizationType] ?? 0) + 1;
  }
  return { bySpecialty, byProvince, byRank, byOrganization, total };
}

// ---------------------------------------------------------------------------
// Admin mutations (lawyer management, reviews, rating, avatar, visibility)
// ---------------------------------------------------------------------------
// All writes go through upsertLawyerProfile (which stamps `updatedAt`) so the
// public marketplace picks a change up immediately — there is ONE profile
// row shared by both surfaces, never a parallel admin copy.

/** Apply a partial field update to a lawyer profile. Server-side only. */
export function updateLawyerProfile(
  id: string,
  patch: Partial<LawyerProfile>
): LawyerProfile | undefined {
  const rows = listLawyerProfiles();
  const idx = rows.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  const next: LawyerProfile = { ...rows[idx]!, ...patch, id: rows[idx]!.id };
  return upsertLawyerProfile(next);
}

/** Set the marketplace visibility (PUBLIC / UNLISTED / HIDDEN). */
export function setMarketplaceVisibility(
  id: string,
  visibility: LawyerMarketplaceVisibility
): LawyerProfile | undefined {
  return updateLawyerProfile(id, { visibility });
}

/** Toggle the marketplace "featured" flag. */
export function setFeatured(id: string, featured: boolean): LawyerProfile | undefined {
  return updateLawyerProfile(id, { featured });
}

/** Set (or clear) the admin display overrides (rating / count / fee / badge). */
export function setDisplaySettings(
  id: string,
  display: LawyerDisplaySettings | null
): LawyerProfile | undefined {
  return updateLawyerProfile(id, { display });
}

/**
 * The operator-facing lifecycle state, DERIVED from the stored fields so the
 * admin table never keeps a parallel status column that can drift:
 *   DELETED   → a soft-delete tombstone is present
 *   SUSPENDED → verificationStatus is SUSPENDED
 *   INACTIVE  → VERIFIED but hidden from the marketplace
 *   ACTIVE    → live and public
 */
export function resolveAdminLifecycle(profile: LawyerProfile): AdminLawyerStatus {
  if (profile.deletedAt) return "DELETED";
  if (profile.verificationStatus === "SUSPENDED") return "SUSPENDED";
  if ((profile.visibility ?? "PUBLIC") === "HIDDEN") return "INACTIVE";
  return "ACTIVE";
}

/**
 * Map an operator lifecycle status onto the profile fields it owns. Note
 * that the verification state is deliberately NOT touched here: verifying a
 * lawyer is a separate, reason-mandatory decision that stays behind
 * `admin:lawyer:verify`. Suspension DOES set `SUSPENDED` because that is the
 * public-transparency state the marketplace reads (see `withStatusAvailability`).
 */
export function adminStatusPatch(
  status: AdminLawyerStatus,
  now: string = new Date().toISOString()
): Partial<LawyerProfile> {
  switch (status) {
    case "ACTIVE":
      return {
        visibility: "PUBLIC",
        deletedAt: null,
        availabilityStatus: "ACTIVE",
        acceptingRequests: true,
        acceptingClients: true,
      };
    case "INACTIVE":
      return {
        visibility: "HIDDEN",
        availabilityStatus: "INACTIVE",
        acceptingRequests: false,
        acceptingClients: false,
      };
    case "SUSPENDED":
      return {
        verificationStatus: "SUSPENDED",
        availabilityStatus: "SUSPENDED",
        acceptingRequests: false,
        acceptingClients: false,
      };
    case "DELETED":
      return { visibility: "HIDDEN", deletedAt: now, acceptingRequests: false };
  }
}

/** Replace a lawyer's avatar URL + provenance. */
export function setAvatar(
  id: string,
  avatarUrl: string | null,
  avatarType: LawyerProfile["avatarType"]
): LawyerProfile | undefined {
  return updateLawyerProfile(id, { avatarUrl, avatarType });
}

/** Hide or restore a single review (soft moderation). */
export function setReviewHidden(
  lawyerId: string,
  reviewId: string,
  hidden: boolean
): boolean {
  const rows = readTable<LawyerReviewRow>("lawyer_reviews");
  const idx = rows.findIndex((r) => r.id === reviewId && r.lawyerId === lawyerId);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx]!, hidden, updatedAt: new Date().toISOString() };
  writeTable("lawyer_reviews", rows);
  return true;
}

/** Permanently remove a review row. */
export function deleteReviewRow(lawyerId: string, reviewId: string): boolean {
  const rows = readTable<LawyerReviewRow>("lawyer_reviews");
  const next = rows.filter((r) => !(r.id === reviewId && r.lawyerId === lawyerId));
  if (next.length === rows.length) return false;
  writeTable("lawyer_reviews", next);
  return true;
}

/**
 * The admin table row for a profile — the public card plus the fields an
 * operator needs (masked mobile, bucket, verification, featured, visibility).
 */
export function toAdminLawyerListItem(
  profile: LawyerProfile,
  mobileMasked: string,
  lastDecision: {
    newStatus: LawyerVerificationStatus;
    actorName: string;
    reason: string;
    createdAt: string;
  } | null,
  bucket: LawyerDecisionBucket
): AdminLawyerListItem {
  const list = toListItem(profile);
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    avatarType: profile.avatarType ?? "real",
    professionalRank: profile.professionalRank ?? null,
    organizationType: profile.organizationType ?? null,
    licenseNumber: profile.licenseNumber,
    licenseYear: profile.licenseYear,
    licenseAuthority: profile.licenseAuthority ?? null,
    activityType: profile.activityType ?? null,
    verificationStatus: profile.verificationStatus,
    verificationNote: profile.verificationNote,
    verifiedAt: profile.verifiedAt,
    isDemo: profile.isDemo,
    featured: profile.featured ?? false,
    visibility: profile.visibility ?? "PUBLIC",
    lifecycle: resolveAdminLifecycle(profile),
    specializations: profile.specializations,
    primarySpecialtyId: primarySpecialtyIdOf(profile),
    locations: profile.locations,
    cities: profile.locations.map((l) => l.city).join("، "),
    yearsExperience: profile.yearsExperience ?? yearsOfExperience(profile),
    displayRating: list.displayRating ?? null,
    displayReviewCount: list.displayReviewCount ?? 0,
    deletedAt: profile.deletedAt ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    mobileMasked,
    bucket,
    lastDecision,
  };
}
