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
  const bio = profile.bio.trim();
  return {
    id: profile.id,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    avatarType: profile.avatarType ?? "real",
    professionalTitle: profile.professionalTitle ?? null,
    verificationStatus: profile.verificationStatus,
    specializations: profile.specializations,
    locations: profile.locations,
    languages: profile.languages,
    pricing: profile.pricing,
    performance: computePerformance(profile.id),
    // Legacy rows predate these fields — default to a requestable status
    // so an old profile is never silently hidden behind a disabled CTA.
    availabilityStatus: profile.availabilityStatus ?? "ACTIVE",
    consultationCapacity: profile.consultationCapacity ?? null,
    isDemo: profile.isDemo,
    acceptingRequests: profile.acceptingRequests,
    bioExcerpt: bio.length > 140 ? `${bio.slice(0, 140)}…` : bio,
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
 */
export function queryLawyers(filters: LawyerListFilters): LawyerListResponse {
  const verifiedOnly = filters.verifiedOnly ?? true;
  let rows = listLawyerProfiles();

  if (verifiedOnly) {
    rows = rows.filter((l) => l.verificationStatus === "VERIFIED");
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
