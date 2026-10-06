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
  LawyerListFilters,
  LawyerListResponse,
  LawyerVerificationStatus,
  LawyerPerformance,
  LawyerDetail,
  LawyerReview,
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
  createdAt: string;
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

export function listLawyerReviews(lawyerId: string): LawyerReviewRow[] {
  return readTable<LawyerReviewRow>("lawyer_reviews")
    .filter((r) => r.lawyerId === lawyerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

/** Project a full profile into the public list-item shape. */
export function toListItem(profile: LawyerProfile): LawyerListItem {
  const p = withStatusAvailability(profile);
  const bio = p.bio.trim();
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
    performance: computePerformance(p.id),
    // Legacy rows predate these fields — default to a requestable status
    // so an old profile is never silently hidden behind a disabled CTA.
    availabilityStatus: p.availabilityStatus ?? "ACTIVE",
    consultationCapacity: p.consultationCapacity ?? null,
    isDemo: p.isDemo,
    acceptingRequests: p.acceptingRequests,
    bioExcerpt: bio.length > 140 ? `${bio.slice(0, 140)}…` : bio,
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
  }));

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
    performance: computePerformance(p.id),
    availabilityStatus: p.availabilityStatus ?? "ACTIVE",
    consultationCapacity: p.consultationCapacity ?? null,
    isDemo: p.isDemo,
    acceptingRequests: p.acceptingRequests,
    reviews,
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
export function queryLawyers(filters: LawyerListFilters): LawyerListResponse {
  const verifiedOnly = filters.verifiedOnly ?? true;
  let rows = listLawyerProfiles();

  if (verifiedOnly) {
    rows = rows.filter(
      (l) => l.verificationStatus === "VERIFIED" || l.verificationStatus === "SUSPENDED"
    );
  }
  if (filters.category) {
    rows = rows.filter((l) => l.specializations.some((s) => s.category === filters.category));
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
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (l) => l.fullName.toLowerCase().includes(q) || l.bio.toLowerCase().includes(q)
    );
  }

  const items = rows.map(toListItem);

  const sort = filters.sort ?? "relevance";
  items.sort((a, b) => {
    switch (sort) {
      case "rating":
        return (b.performance.averageRating ?? 0) - (a.performance.averageRating ?? 0);
      case "experience": {
        const ea = a.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
        const eb = b.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
        return eb - ea;
      }
      case "price_asc":
        return a.pricing.consultationFeeToman - b.pricing.consultationFeeToman;
      case "price_desc":
        return b.pricing.consultationFeeToman - a.pricing.consultationFeeToman;
      default:
        // relevance: verified + accepting + rating
        return (
          Number(b.acceptingRequests) - Number(a.acceptingRequests) ||
          (b.performance.averageRating ?? 0) - (a.performance.averageRating ?? 0)
        );
    }
  });

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
