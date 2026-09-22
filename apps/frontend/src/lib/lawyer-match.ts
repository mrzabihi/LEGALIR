// ============================================================
// LEGALIR — Lawyer Matching Engine (PART 4)
// ============================================================
// Two-stage ranking, exactly as specified:
//
//   1. HARD FILTERS — a lawyer who fails any of these is excluded
//      entirely (not merely down-ranked):
//        • must be VERIFIED
//        • must be accepting requests
//        • must practise the requested category
//        • must serve the requested province (when one is given)
//        • must be within the budget ceiling (when one is given)
//        • must support the requested language (when one is given)
//        • must offer remote service (when the client needs remote)
//
//   2. WEIGHTED RANKING — the survivors are scored 0–100 across six
//      factors using DEFAULT_MATCH_WEIGHTS. Every contribution is
//      returned in `breakdown` so the UI can explain the ranking.
//
// The engine NEVER picks a lawyer. It returns the top N candidates and
// the user chooses. There is no "best lawyer" verdict anywhere.
// ============================================================

import { queryLawyers } from "./lawyer-db";
import {
  DEFAULT_MATCH_WEIGHTS,
  type MatchCriteria,
  type MatchCandidate,
  type MatchResult,
  type MatchScoreBreakdown,
  type MatchWeights,
  type LawyerListItem,
} from "@legalir/types";

/** How many candidates the engine proposes by default. */
export const DEFAULT_MATCH_LIMIT = 3;

/** Hard-filter a single lawyer against the criteria. Returns a reason when excluded. */
function hardFilterReason(lawyer: LawyerListItem, criteria: MatchCriteria): string | null {
  if (lawyer.verificationStatus !== "VERIFIED") return "تأیید نشده";
  if (!lawyer.acceptingRequests) return "در حال حاضر درخواست نمی‌پذیرد";
  if (!lawyer.specializations.some((s) => s.category === criteria.category)) {
    return "تخصص مرتبط ندارد";
  }
  if (criteria.province && !lawyer.locations.some((l) => l.province === criteria.province)) {
    return "در استان انتخابی فعالیت نمی‌کند";
  }
  if (typeof criteria.maxFeeToman === "number" && criteria.maxFeeToman > 0) {
    if (lawyer.pricing.consultationFeeToman > criteria.maxFeeToman) return "خارج از بودجه";
  }
  if (criteria.language && !lawyer.languages.some((l) => l.code === criteria.language)) {
    return "زبان مورد نیاز را پوشش نمی‌دهد";
  }
  if (criteria.remote && !lawyer.locations.some((l) => l.remote)) {
    return "خدمات آنلاین ارائه نمی‌دهد";
  }
  return null;
}

/** Clamp a 0–1 ratio into a 0–100 score. */
function pct(ratio: number): number {
  return Math.max(0, Math.min(1, ratio)) * 100;
}

/**
 * Score one eligible lawyer. Each factor returns 0–100, then the weighted
 * sum is normalised by the total weight so the result is always 0–100.
 */
function scoreCandidate(
  lawyer: LawyerListItem,
  criteria: MatchCriteria,
  weights: MatchWeights
): { score: number; breakdown: MatchScoreBreakdown; reasonsFa: string[] } {
  const reasonsFa: string[] = [];

  // --- Specialty: exact category match + depth of experience in it. ---
  const spec = lawyer.specializations.find((s) => s.category === criteria.category);
  const specYears = spec?.yearsExperience ?? 0;
  const specialty = pct(0.6 + 0.4 * Math.min(specYears / 15, 1));
  if (spec) reasonsFa.push(`تخصص ${specYears} ساله در این حوزه`);

  // --- Location: same city > same province > remote fallback. ---
  let location = 0;
  if (criteria.city && lawyer.locations.some((l) => l.city === criteria.city)) {
    location = 100;
    reasonsFa.push("در شهر شما");
  } else if (criteria.province && lawyer.locations.some((l) => l.province === criteria.province)) {
    location = 70;
    reasonsFa.push("در استان شما");
  } else if (lawyer.locations.some((l) => l.remote)) {
    location = 40;
    reasonsFa.push("امکان مشاوره آنلاین");
  } else {
    location = 20;
  }

  // --- Price: cheaper is better, but only relative to the ceiling. ---
  let price = 60;
  if (typeof criteria.maxFeeToman === "number" && criteria.maxFeeToman > 0) {
    const ratio = lawyer.pricing.consultationFeeToman / criteria.maxFeeToman;
    price = pct(1 - ratio * 0.5); // half the budget → 75, at the ceiling → 50
  } else {
    // No budget given: reward a free first consultation, else neutral.
    price = lawyer.pricing.freeFirstConsultation ? 80 : 60;
  }
  if (lawyer.pricing.freeFirstConsultation) reasonsFa.push("اولین مشاوره رایگان");

  // --- Rating: 0 reviews is neutral (never penalised for being new). ---
  const rating = lawyer.performance.averageRating;
  const ratingScore = rating === null ? 55 : pct(rating / 5);
  if (rating !== null && rating >= 4) reasonsFa.push(`امتیاز ${rating} از ۵`);

  // --- Experience: max years across specialties, saturating at 20. ---
  const maxYears = lawyer.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
  const experience = pct(Math.min(maxYears / 20, 1));
  if (maxYears >= 10) reasonsFa.push(`${maxYears} سال سابقه`);

  // --- Availability: accepting + fast median response. ---
  let availability = lawyer.acceptingRequests ? 70 : 0;
  const median = lawyer.performance.medianResponseMinutes;
  if (median !== null) {
    // ≤30 min → full marks, decaying to 0 at 24h.
    availability = Math.max(availability, pct(1 - median / (24 * 60)));
    if (median <= 120) reasonsFa.push("پاسخ‌دهی سریع");
  }

  const breakdown: MatchScoreBreakdown = {
    specialty: Math.round(specialty),
    location: Math.round(location),
    price: Math.round(price),
    rating: Math.round(ratingScore),
    experience: Math.round(experience),
    availability: Math.round(availability),
  };

  const totalWeight =
    weights.specialty + weights.location + weights.price + weights.rating + weights.experience + weights.availability;
  const weighted =
    breakdown.specialty * weights.specialty +
    breakdown.location * weights.location +
    breakdown.price * weights.price +
    breakdown.rating * weights.rating +
    breakdown.experience * weights.experience +
    breakdown.availability * weights.availability;

  return {
    score: totalWeight > 0 ? Math.round(weighted / totalWeight) : 0,
    breakdown,
    reasonsFa,
  };
}

/**
 * Run the matching engine. Returns the top `limit` candidates (default 3)
 * plus counts of how many lawyers were eligible vs. excluded by the hard
 * filters — the UI shows both so the user understands the pool.
 */
export function matchLawyers(
  criteria: MatchCriteria,
  options?: { limit?: number; weights?: Partial<MatchWeights> }
): MatchResult {
  const weights: MatchWeights = { ...DEFAULT_MATCH_WEIGHTS, ...(options?.weights ?? {}) };
  const limit = options?.limit ?? DEFAULT_MATCH_LIMIT;

  // Pull the full verified pool for the category, then apply the remaining
  // hard filters in-process so we can count exclusions precisely.
  const pool = queryLawyers({
    category: criteria.category,
    verifiedOnly: true,
    page: 1,
    pageSize: 1000,
  }).items;

  const eligible: LawyerListItem[] = [];
  let excludedCount = 0;
  for (const lawyer of pool) {
    if (hardFilterReason(lawyer, criteria)) {
      excludedCount += 1;
    } else {
      eligible.push(lawyer);
    }
  }

  const candidates: MatchCandidate[] = eligible
    .map((lawyer) => {
      const { score, breakdown, reasonsFa } = scoreCandidate(lawyer, criteria, weights);
      return { lawyer, score, breakdown, reasonsFa };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    criteria,
    candidates,
    eligibleCount: eligible.length,
    excludedCount,
  };
}
