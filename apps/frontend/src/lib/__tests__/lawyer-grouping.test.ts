// ============================================================
// LEGALIR — Lawyer marketplace grouping tests
// ============================================================
// The grouped marketplace must file each lawyer under their FIRST declared
// specialization, order sections by size, and never invent a category for
// a lawyer that declares none.
// ============================================================

import { describe, it, expect } from "vitest";
import type { LawyerListItem } from "@legalir/types";
import {
  primarySpecialty,
  groupByPrimarySpecialty,
  featuredLawyers,
  yearsOfExperience,
} from "../lawyers/grouping";

function lawyer(
  overrides: Partial<LawyerListItem> & { id: string }
): LawyerListItem {
  return {
    fullName: "وکیل نمونه",
    avatarUrl: null,
    avatarType: "demo",
    professionalTitle: null,
    verificationStatus: "VERIFIED",
    specializations: [{ category: "family", yearsExperience: 8 }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [],
    pricing: {
      consultationFeeToman: 1_000_000,
      consultationDurationMinutes: 60,
      freeFirstConsultation: false,
    },
    performance: {
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
      averageRating: null,
      reviewCount: 0,
    },
    availabilityStatus: "ACTIVE",
    consultationCapacity: null,
    isDemo: true,
    acceptingRequests: true,
    bioExcerpt: "",
    ...overrides,
  };
}

describe("primarySpecialty", () => {
  it("returns the first declared specialization", () => {
    const l = lawyer({
      id: "a",
      specializations: [
        { category: "contract", yearsExperience: 5 },
        { category: "companies", yearsExperience: 3 },
      ],
    });
    expect(primarySpecialty(l)).toBe("contract");
  });

  it("returns null when no specialization is declared", () => {
    expect(primarySpecialty(lawyer({ id: "b", specializations: [] }))).toBeNull();
  });
});

describe("yearsOfExperience", () => {
  it("takes the max across specialties, not the sum", () => {
    const l = lawyer({
      id: "c",
      specializations: [
        { category: "family", yearsExperience: 4 },
        { category: "labor", yearsExperience: 11 },
      ],
    });
    expect(yearsOfExperience(l)).toBe(11);
  });
});

describe("groupByPrimarySpecialty", () => {
  it("files each lawyer under their primary specialty", () => {
    const groups = groupByPrimarySpecialty([
      lawyer({ id: "1", specializations: [{ category: "family", yearsExperience: 2 }] }),
      lawyer({ id: "2", specializations: [{ category: "criminal", yearsExperience: 2 }] }),
      lawyer({ id: "3", specializations: [{ category: "family", yearsExperience: 2 }] }),
    ]);
    const family = groups.find((g) => g.category === "family");
    expect(family?.lawyers.map((l) => l.id)).toEqual(["1", "3"]);
    expect(family?.label).toBe("خانواده");
  });

  it("orders sections by size, fullest first", () => {
    const groups = groupByPrimarySpecialty([
      lawyer({ id: "1", specializations: [{ category: "family", yearsExperience: 1 }] }),
      lawyer({ id: "2", specializations: [{ category: "criminal", yearsExperience: 1 }] }),
      lawyer({ id: "3", specializations: [{ category: "criminal", yearsExperience: 1 }] }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["criminal", "family"]);
  });

  it("drops lawyers with no specialization instead of inventing a category", () => {
    const groups = groupByPrimarySpecialty([
      lawyer({ id: "1", specializations: [] }),
      lawyer({ id: "2", specializations: [{ category: "labor", yearsExperience: 1 }] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("labor");
  });
});

describe("featuredLawyers", () => {
  it("puts requestable lawyers first, then by rating", () => {
    const featured = featuredLawyers([
      lawyer({
        id: "busy",
        acceptingRequests: false,
        availabilityStatus: "INACTIVE",
        performance: {
          acceptedRequests: 0,
          completedCases: 0,
          medianResponseMinutes: null,
          averageRating: 5,
          reviewCount: 10,
        },
      }),
      lawyer({
        id: "open",
        acceptingRequests: true,
        performance: {
          acceptedRequests: 0,
          completedCases: 0,
          medianResponseMinutes: null,
          averageRating: 4,
          reviewCount: 3,
        },
      }),
    ]);
    expect(featured[0]!.id).toBe("open");
  });

  it("never features a rejected lawyer", () => {
    const featured = featuredLawyers([
      lawyer({ id: "rejected", availabilityStatus: "REJECTED", acceptingRequests: false }),
      lawyer({ id: "ok" }),
    ]);
    expect(featured.map((l) => l.id)).toEqual(["ok"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => lawyer({ id: `l${i}` }));
    expect(featuredLawyers(many, 5)).toHaveLength(5);
  });
});
