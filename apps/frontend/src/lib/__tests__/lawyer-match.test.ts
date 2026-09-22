// ============================================================
// LEGALIR — Lawyer matching engine tests (PART 4)
// ============================================================
// The engine must hard-filter first, then rank, and must NEVER return a
// single auto-selected lawyer. `queryLawyers` is mocked so the tests are
// deterministic and independent of the on-disk seed.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LawyerListItem, MatchCriteria } from "@legalir/types";

const pool: LawyerListItem[] = [];

vi.mock("../lawyer-db", () => ({
  queryLawyers: () => ({
    items: pool,
    pagination: { page: 1, pageSize: 1000, total: pool.length, totalPages: 1 },
  }),
}));

import { matchLawyers, DEFAULT_MATCH_LIMIT } from "../lawyer-match";

function lawyer(overrides: Partial<LawyerListItem> & { id: string }): LawyerListItem {
  return {
    fullName: "وکیل نمونه",
    avatarUrl: null,
    avatarType: "demo",
    professionalTitle: null,
    verificationStatus: "VERIFIED",
    specializations: [{ category: "family", yearsExperience: 8 }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 500_000,
      hourlyRateToman: null,
      contractReviewFeeToman: null,
      freeFirstConsultation: false,
    },
    performance: {
      averageRating: null,
      reviewCount: 0,
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
    },
    availabilityStatus: "ACTIVE",
    consultationCapacity: null,
    isDemo: true,
    acceptingRequests: true,
    bioExcerpt: "",
    ...overrides,
  };
}

const baseCriteria: MatchCriteria = { category: "family" };

beforeEach(() => {
  pool.length = 0;
});

describe("lawyer matching engine", () => {
  it("excludes unverified lawyers", () => {
    pool.push(lawyer({ id: "a", verificationStatus: "UNVERIFIED" }));
    const result = matchLawyers(baseCriteria);
    expect(result.candidates).toHaveLength(0);
    expect(result.excludedCount).toBe(1);
  });

  it("excludes lawyers not accepting requests", () => {
    pool.push(lawyer({ id: "a", acceptingRequests: false }));
    expect(matchLawyers(baseCriteria).candidates).toHaveLength(0);
  });

  it("excludes lawyers without the requested specialty", () => {
    pool.push(lawyer({ id: "a", specializations: [{ category: "labor", yearsExperience: 5 }] }));
    expect(matchLawyers(baseCriteria).candidates).toHaveLength(0);
  });

  it("excludes lawyers over the budget ceiling", () => {
    pool.push(lawyer({ id: "a", pricing: { consultationFeeToman: 9_000_000, hourlyRateToman: null, contractReviewFeeToman: null, freeFirstConsultation: false } }));
    expect(matchLawyers({ ...baseCriteria, maxFeeToman: 1_000_000 }).candidates).toHaveLength(0);
  });

  it("excludes lawyers outside the requested province", () => {
    pool.push(lawyer({ id: "a", locations: [{ province: "اصفهان", city: "اصفهان", remote: false }] }));
    expect(matchLawyers({ ...baseCriteria, province: "تهران" }).candidates).toHaveLength(0);
  });

  it("caps the proposal at DEFAULT_MATCH_LIMIT", () => {
    for (let i = 0; i < 10; i++) pool.push(lawyer({ id: `l${i}` }));
    const result = matchLawyers(baseCriteria);
    expect(result.candidates).toHaveLength(DEFAULT_MATCH_LIMIT);
    expect(result.eligibleCount).toBe(10);
  });

  it("returns scores within 0–100, sorted descending", () => {
    pool.push(lawyer({ id: "a", specializations: [{ category: "family", yearsExperience: 2 }] }));
    pool.push(lawyer({ id: "b", specializations: [{ category: "family", yearsExperience: 20 }] }));
    const { candidates } = matchLawyers(baseCriteria);
    for (const c of candidates) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1]!.score).toBeGreaterThanOrEqual(candidates[i]!.score);
    }
  });

  it("never returns a single auto-selected lawyer when several are eligible", () => {
    pool.push(lawyer({ id: "a" }));
    pool.push(lawyer({ id: "b" }));
    const result = matchLawyers(baseCriteria);
    expect(result.candidates.length).toBeGreaterThan(1);
  });
});
