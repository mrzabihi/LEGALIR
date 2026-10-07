// ============================================================
// LEGALIR — Demo lawyer generator (determinism + coverage)
// ============================================================
// The roster must be REPRODUCIBLE (same seed → same specs) so the seed stays
// idempotent, and it must COVER the taxonomy (every domain represented) and
// the product states (rank, organisation, availability, rating band).
// ============================================================

import { describe, it, expect } from "vitest";
import { LAWYER_TAXONOMY, LAWYER_SERVICES, taxonomyDomainOf } from "@legalir/types";
import {
  generateDemoLawyerSpecs,
  demoAvatarDataUri,
  ratingsForTarget,
  GENERATED_LAWYER_COUNT,
} from "../demo-generator";

describe("generateDemoLawyerSpecs", () => {
  const specs = generateDemoLawyerSpecs();

  it("produces the requested roster size with unique ids", () => {
    expect(specs).toHaveLength(GENERATED_LAWYER_COUNT);
    const ids = new Set(specs.map((s) => s.id));
    expect(ids.size).toBe(GENERATED_LAWYER_COUNT);
  });

  it("starts at demo-lawyer-021 so curated ids keep their numbers", () => {
    expect(specs[0]!.id).toBe("demo-lawyer-021");
  });

  it("is deterministic — a second run yields identical ids and names", () => {
    const again = generateDemoLawyerSpecs();
    expect(again.map((s) => s.id)).toEqual(specs.map((s) => s.id));
    expect(again.map((s) => s.fullName)).toEqual(specs.map((s) => s.fullName));
  });

  it("every primary specialty id is a real taxonomy node", () => {
    const ids = new Set(LAWYER_TAXONOMY.map((n) => n.id));
    for (const spec of specs) {
      expect(ids.has(spec.primarySpecialtyId)).toBe(true);
      for (const id of spec.specialtyIds) expect(ids.has(id)).toBe(true);
    }
  });

  it("covers every taxonomy domain with at least one lawyer", () => {
    const domains = new Set(
      specs.map((s) => taxonomyDomainOf(s.primarySpecialtyId)?.id).filter(Boolean)
    );
    expect(domains.size).toBeGreaterThanOrEqual(18);
  });

  it("every service id is a real catalog service", () => {
    const serviceIds = new Set(LAWYER_SERVICES.map((s) => s.id));
    for (const spec of specs) {
      expect(spec.serviceIds.length).toBeGreaterThan(0);
      for (const id of spec.serviceIds) expect(serviceIds.has(id)).toBe(true);
    }
  });

  it("spans cities beyond the capital and multiple ranks/organisations", () => {
    const cities = new Set(specs.map((s) => s.city));
    const ranks = new Set(specs.map((s) => s.professionalRank));
    const orgs = new Set(specs.map((s) => s.organizationType));
    expect(cities.size).toBeGreaterThan(20);
    expect(ranks.size).toBeGreaterThanOrEqual(2);
    expect(orgs.size).toBeGreaterThanOrEqual(2);
  });

  it("includes verified, unverified, featured and suspended profiles", () => {
    expect(specs.some((s) => s.unverified)).toBe(true);
    expect(specs.some((s) => s.featured)).toBe(true);
    expect(specs.some((s) => s.availabilityStatus === "SUSPENDED")).toBe(true);
    expect(specs.some((s) => !s.unverified)).toBe(true);
  });

  it("keeps ratings inside the 3.0–5.0 display window", () => {
    for (const spec of specs) {
      expect(spec.targetRating).toBeGreaterThanOrEqual(3);
      expect(spec.targetRating).toBeLessThanOrEqual(5);
    }
  });
});

describe("demoAvatarDataUri", () => {
  it("returns a deterministic inline SVG data-URI per seed", () => {
    const a = demoAvatarDataUri(42, "MALE");
    const b = demoAvatarDataUri(42, "MALE");
    expect(a).toBe(b);
    expect(a.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("differs across seeds (distinct avatars, never a shared placeholder)", () => {
    expect(demoAvatarDataUri(1, "MALE")).not.toBe(demoAvatarDataUri(2, "MALE"));
  });

  it("gives female and male avatars different geometry", () => {
    expect(demoAvatarDataUri(10, "FEMALE")).not.toBe(demoAvatarDataUri(10, "MALE"));
  });
});

describe("ratingsForTarget", () => {
  it("produces the requested number of 1–5 ratings", () => {
    const ratings = ratingsForTarget(4.5, 20, () => 0.5);
    expect(ratings).toHaveLength(20);
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    }
  });

  it("returns an empty array when the count is zero", () => {
    expect(ratingsForTarget(5, 0, () => 0.1)).toEqual([]);
  });
});
