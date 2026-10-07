// ============================================================
// LEGALIR — Marketplace query engine (search · filters · facets)
// ============================================================
// Exercises `queryLawyers` against an isolated temp DB. The brief requires
// that search and filtering work over the 4-level taxonomy — picking a DOMAIN
// must match a lawyer tagged on a DESCENDANT node (e.g. «خانواده» matches a
// lawyer whose primary specialty is «طلاق توافقی»), and free-text search over
// name / specialty / sub-specialty / service / city must resolve the same way.
//
// `db.ts` resolves its store from the cwd at import time, so both modules are
// imported DYNAMICALLY after chdir into a throwaway directory (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LawyerProfile } from "@legalir/types";
import type * as LawyerDbModule from "../lawyer-db";

type LawyerDb = typeof LawyerDbModule;

let lawyerDb: LawyerDb;

let tmpDir: string;
let originalCwd: string;

/** Minimal but complete profile — only the fields under test differ. */
function profile(overrides: Partial<LawyerProfile> & { id: string }): LawyerProfile {
  const now = new Date().toISOString();
  return {
    userId: `user-${overrides.id}`,
    fullName: "وکیل نمونه",
    licenseNumber: "1000",
    licenseYear: 1395,
    bio: "توضیح کوتاه.",
    avatarUrl: null,
    avatarType: "real",
    professionalTitle: "وکیل پایه دو دادگستری",
    activityType: "INDEPENDENT",
    licenseAuthority: "کانون وکلای مرکز",
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    verificationNote: null,
    specializations: [{ category: "family", yearsExperience: 5, note: null }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 500_000,
      consultationDurationMinutes: 30,
      hourlyRateToman: null,
      contractReviewFeeToman: null,
      freeFirstConsultation: false,
    },
    availability: [{ weekday: 0, startTime: "09:00", endTime: "13:00" }],
    performance: {
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
      averageRating: null,
      reviewCount: 0,
    },
    availabilityStatus: "ACTIVE",
    consultationCapacity: 5,
    isDemo: true,
    acceptingRequests: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-query-"));
  process.chdir(tmpDir);

  lawyerDb = await import("../lawyer-db");

  // The family-specialist: expertise on the DEEP node «طلاق توافقی», an
  // online service, featured, 12 years in, a displayed rating override.
  lawyerDb.upsertLawyerProfile(
    profile({
      id: "law-family",
      fullName: "مریم رستمی",
      professionalRank: "BASE_ONE",
      organizationType: "BAR",
      gender: "FEMALE",
      featured: true,
      yearsExperience: 12,
      acceptingClients: true,
      locations: [{ province: "تهران", city: "کرج", remote: true }],
      specializations: [{ category: "family.divorce.mutual", yearsExperience: 12, note: null }],
      expertise: [
        { id: "e1", lawyerId: "law-family", taxonomyNodeId: "family.divorce.mutual", isPrimary: true, yearsExperience: 12, caseCount: 40, displayOrder: 0 },
        { id: "e2", lawyerId: "law-family", taxonomyNodeId: "family.custody", isPrimary: false, yearsExperience: 6, caseCount: 15, displayOrder: 1 },
      ],
      services: [
        { serviceId: "online_consult", enabled: true },
        { serviceId: "contract_review", enabled: true },
        { serviceId: "legal_translation", enabled: false },
      ],
      jurisdictions: ["family_court"],
      display: { ratingOverride: 4.7, reviewCountOverride: 88, consultationFeeOverrideToman: null },
      professionalTitle: "وکیل پایه یک دادگستری",
    })
  );

  // A criminal lawyer in Shiraz, base two, not accepting clients, no services.
  lawyerDb.upsertLawyerProfile(
    profile({
      id: "law-criminal",
      fullName: "حسین کریمی",
      professionalRank: "BASE_TWO",
      organizationType: "JUDICIARY_CENTER",
      gender: "MALE",
      yearsExperience: 4,
      acceptingClients: false,
      locations: [{ province: "فارس", city: "شیراز", remote: false }],
      specializations: [{ category: "criminal", yearsExperience: 4, note: null }],
      expertise: [
        { id: "e3", lawyerId: "law-criminal", taxonomyNodeId: "criminal", isPrimary: true, yearsExperience: 4, caseCount: 10, displayOrder: 0 },
      ],
      services: [],
    })
  );

  // A HIDDEN (unlisted from search) lawyer who must never surface.
  lawyerDb.upsertLawyerProfile(
    profile({
      id: "law-hidden",
      fullName: "وکیل پنهان",
      visibility: "HIDDEN",
      specializations: [{ category: "family", yearsExperience: 3, note: null }],
    })
  );

  // An unverified lawyer — must not appear in the public marketplace.
  lawyerDb.upsertLawyerProfile(
    profile({
      id: "law-pending",
      fullName: "وکیل در انتظار",
      verificationStatus: "UNDER_REVIEW",
      verifiedAt: null,
      specializations: [{ category: "family", yearsExperience: 3, note: null }],
    })
  );
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("queryLawyers — visibility", () => {
  it("excludes HIDDEN profiles and unverified profiles from the public list", () => {
    const res = lawyerDb.queryLawyers({});
    const ids = res.items.map((l) => l.id);
    expect(ids).toContain("law-family");
    expect(ids).toContain("law-criminal");
    expect(ids).not.toContain("law-hidden");
    expect(ids).not.toContain("law-pending");
  });
});

describe("queryLawyers — taxonomy filtering", () => {
  it("a DOMAIN filter matches a lawyer tagged on a descendant node", () => {
    const res = lawyerDb.queryLawyers({ specialtyIds: ["family"] });
    const ids = res.items.map((l) => l.id);
    expect(ids).toContain("law-family");
    expect(ids).not.toContain("law-criminal");
  });

  it("the deep descendant node itself matches too", () => {
    const res = lawyerDb.queryLawyers({ specialtyIds: ["family.divorce.mutual"] });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });
});

describe("queryLawyers — attribute filters", () => {
  it("professional rank", () => {
    const res = lawyerDb.queryLawyers({ professionalRanks: ["BASE_ONE"] });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("organisation type", () => {
    const res = lawyerDb.queryLawyers({ organizationTypes: ["JUDICIARY_CENTER"] });
    expect(res.items.map((l) => l.id)).toEqual(["law-criminal"]);
  });

  it("service offer (only enabled offers count)", () => {
    const online = lawyerDb.queryLawyers({ serviceIds: ["online_consult"] });
    expect(online.items.map((l) => l.id)).toEqual(["law-family"]);
    // A disabled service offer must not match.
    const disabled = lawyerDb.queryLawyers({ serviceIds: ["legal_translation"] });
    expect(disabled.items).toHaveLength(0);
  });

  it("jurisdiction", () => {
    const res = lawyerDb.queryLawyers({ jurisdictionIds: ["family_court"] });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("accepting clients only", () => {
    const res = lawyerDb.queryLawyers({ acceptingClientsOnly: true });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("online only (the lawyer offers an online/phone/written consult)", () => {
    const res = lawyerDb.queryLawyers({ onlineOnly: true });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("featured only", () => {
    const res = lawyerDb.queryLawyers({ featuredOnly: true });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("minimum rating honours the display override", () => {
    expect(lawyerDb.queryLawyers({ minRating: 4.5 }).items.map((l) => l.id)).toEqual(["law-family"]);
    expect(lawyerDb.queryLawyers({ minRating: 4.9 }).items).toHaveLength(0);
  });

  it("experience band", () => {
    // 12 years → the 8–12 band; 4 years is in 4–7.
    expect(lawyerDb.queryLawyers({ experienceBand: "8-12" }).items.map((l) => l.id)).toEqual([
      "law-family",
    ]);
    expect(lawyerDb.queryLawyers({ experienceBand: "4-7" }).items.map((l) => l.id)).toEqual([
      "law-criminal",
    ]);
  });

  it("city filter", () => {
    expect(lawyerDb.queryLawyers({ city: "شیراز" }).items.map((l) => l.id)).toEqual(["law-criminal"]);
  });

  it("province filter", () => {
    expect(lawyerDb.queryLawyers({ province: "تهران" }).items.map((l) => l.id)).toEqual(["law-family"]);
  });
});

describe("queryLawyers — free-text search", () => {
  it("finds a lawyer by a deep sub-specialty phrase («طلاق توافقی»)", () => {
    const res = lawyerDb.queryLawyers({ search: "طلاق توافقی" });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("finds a lawyer by a synonym of an ancestor node («خانوادگی» → خانواده)", () => {
    const res = lawyerDb.queryLawyers({ search: "خانوادگی" });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("finds a lawyer by service label", () => {
    const res = lawyerDb.queryLawyers({ search: "مشاوره آنلاین" });
    expect(res.items.map((l) => l.id)).toEqual(["law-family"]);
  });

  it("finds a lawyer by name", () => {
    expect(lawyerDb.queryLawyers({ search: "کریمی" }).items.map((l) => l.id)).toEqual([
      "law-criminal",
    ]);
  });

  it("finds a lawyer by city", () => {
    expect(lawyerDb.queryLawyers({ search: "شیراز" }).items.map((l) => l.id)).toEqual([
      "law-criminal",
    ]);
  });

  it("is insensitive to the Arabic/Persian yeh and kaf variants", () => {
    // «كریمی» with an Arabic yeh must still match «کریمی» (Persian yeh).
    expect(lawyerDb.queryLawyers({ search: "رستمى" }).items.map((l) => l.id)).toEqual([
      "law-family",
    ]);
  });

  it("returns nothing for an unmatched query", () => {
    expect(lawyerDb.queryLawyers({ search: "هیچ‌چیز۰" }).items).toHaveLength(0);
  });
});

describe("queryLawyers — projection & sort", () => {
  it("projects the extended list-item fields", () => {
    const { items } = lawyerDb.queryLawyers({ specialtyIds: ["family.divorce.mutual"] });
    const l = items[0]!;
    expect(l.displayRating).toBe(4.7);
    expect(l.displayReviewCount).toBe(88);
    expect(l.professionalRank).toBe("BASE_ONE");
    expect(l.featured).toBe(true);
    expect(l.yearsExperience).toBe(12);
    expect(l.primarySpecialtyId).toBe("family.divorce.mutual");
    // Only ENABLED services are projected.
    expect(l.serviceIds).toEqual(["online_consult", "contract_review"]);
  });

  it("relevance sort puts featured first", () => {
    const { items } = lawyerDb.queryLawyers({ sort: "relevance" });
    expect(items[0]!.id).toBe("law-family");
  });

  it("experience sort orders by years descending", () => {
    const { items } = lawyerDb.queryLawyers({ sort: "experience" });
    expect(items[0]!.id).toBe("law-family");
  });
});

describe("queryLawyers — facets", () => {
  it("counts results per specialty, province, rank and organisation", () => {
    const { facets } = lawyerDb.queryLawyers({});
    expect(facets!.total).toBe(2);
    expect(facets!.byRank!["BASE_ONE"]).toBe(1);
    expect(facets!.byRank!["BASE_TWO"]).toBe(1);
    expect(facets!.byProvince!["تهران"]).toBe(1);
    expect(facets!.byProvince!["فارس"]).toBe(1);
    expect(facets!.byOrganization!["BAR"]).toBe(1);
  });
});
