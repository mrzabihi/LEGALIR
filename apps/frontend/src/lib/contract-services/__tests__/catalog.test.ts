// ============================================================
// LEGALIR — Contract services catalog: data invariants + search
// ============================================================
// These tests pin the *content contract* the /contracts surface relies on:
// 28 services across 9 categories, all «به‌زودی», with complete SEO fields,
// unique Latin slugs, and a search/finder that actually resolves the
// examples the brief calls out. They fail loudly if a service is added
// without its metadata or a slug is duplicated.

import { describe, expect, it } from "vitest";
import {
  CONTRACT_CATEGORIES,
  CONTRACT_SERVICES,
  CONTRACT_SERVICE_COUNT,
  contractServiceHref,
  contractServicesByCategory,
  findContractServices,
  getContractCategory,
  getContractService,
  populatedContractCategories,
  popularContractServices,
  searchContractServices,
} from "@/lib/contract-services";

describe("catalog data invariants", () => {
  it("exposes exactly the 28 brief-specified services", () => {
    expect(CONTRACT_SERVICE_COUNT).toBe(28);
    expect(CONTRACT_SERVICES).toHaveLength(28);
  });

  it("has 9 categories, every one of them populated", () => {
    expect(CONTRACT_CATEGORIES).toHaveLength(9);
    const populated = populatedContractCategories();
    expect(populated).toHaveLength(9);
    for (const category of CONTRACT_CATEGORIES) {
      expect(contractServicesByCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it("keeps ids and slugs unique, and slugs Latin URL-safe", () => {
    const ids = new Set(CONTRACT_SERVICES.map((s) => s.id));
    const slugs = new Set(CONTRACT_SERVICES.map((s) => s.slug));
    expect(ids.size).toBe(CONTRACT_SERVICES.length);
    expect(slugs.size).toBe(CONTRACT_SERVICES.length);
    for (const service of CONTRACT_SERVICES) {
      expect(service.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("marks every service «به‌زودی» in this phase", () => {
    for (const service of CONTRACT_SERVICES) {
      expect(service.status).toBe("coming-soon");
    }
  });

  it("gives every service complete metadata for its card + detail page", () => {
    for (const service of CONTRACT_SERVICES) {
      expect(service.title.length).toBeGreaterThan(0);
      expect(service.shortDescription.length).toBeGreaterThan(0);
      expect(service.description.length).toBeGreaterThan(0);
      expect(service.keywords.length).toBeGreaterThan(0);
      expect(service.features.length).toBeGreaterThan(0);
      expect(service.recommendedLawyerSpecialties.length).toBeGreaterThan(0);
      expect(service.seoTitle.length).toBeGreaterThan(0);
      expect(service.metaDescription.length).toBeGreaterThan(0);
      // The category must resolve.
      expect(getContractCategory(service.category)).toBeTruthy();
    }
  });

  it("resolves each service by slug and builds its href", () => {
    for (const service of CONTRACT_SERVICES) {
      expect(getContractService(service.slug)?.id).toBe(service.id);
      expect(contractServiceHref(service)).toBe(`/contracts/service/${service.slug}`);
    }
    expect(getContractService("does-not-exist")).toBeUndefined();
  });

  it("surfaces a popular shortlist drawn from the real catalog", () => {
    const popular = popularContractServices();
    expect(popular.length).toBeGreaterThan(0);
    for (const service of popular) {
      expect(CONTRACT_SERVICES).toContain(service);
    }
  });
});

describe("searchContractServices", () => {
  const idsFor = (query: string, category: Parameters<typeof searchContractServices>[1] = "all") =>
    searchContractServices(query, category).map((s) => s.id);

  it("returns the whole catalog for an empty query", () => {
    expect(searchContractServices("")).toHaveLength(28);
  });

  it("resolves the brief's example intents", () => {
    expect(idsFor("استخدام")).toContain("employment-contract");
    expect(idsFor("برنامه‌نویس")).toContain("software-development-contract");
    expect(idsFor("سایت")).toContain("website-design-contract");
    expect(idsFor("مغازه")).toContain("commercial-lease-contract");
    expect(idsFor("سرمایه")).toContain("investment-agreement");
    expect(idsFor("سهام")).toContain("shareholders-agreement");
  });

  it("matches across keywords, not only titles", () => {
    // «اپلیکیشن» is a keyword of the software-development service.
    expect(idsFor("اپلیکیشن")).toContain("software-development-contract");
    // «پورسانت» is shared by the sales/marketing services.
    expect(idsFor("پورسانت")).toEqual(
      expect.arrayContaining(["sales-agency-contract", "marketing-commission-contract"])
    );
  });

  it("composes search with a category filter", () => {
    // «فروش» alone spans several categories…
    const acrossAll = idsFor("فروش");
    expect(acrossAll).toEqual(
      expect.arrayContaining(["vehicle-installment-sale-contract", "sales-agency-contract"])
    );
    // …but scoped to خودرو, only the vehicle service survives.
    const vehicleOnly = idsFor("فروش", "vehicle");
    expect(vehicleOnly).toContain("vehicle-installment-sale-contract");
    expect(vehicleOnly).not.toContain("sales-agency-contract");
  });

  it("returns nothing for an unmatched query", () => {
    expect(searchContractServices("zzzznonsense")).toHaveLength(0);
  });
});

describe("findContractServices (plain-language finder)", () => {
  it("resolves the brief's example prompt to software development", () => {
    const results = findContractServices(
      "می‌خواهم با یک برنامه‌نویس برای ساخت اپلیکیشن قرارداد ببندم"
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe("software-development-contract");
  });

  it("caps results at the requested limit", () => {
    expect(findContractServices("قرارداد", 2).length).toBeLessThanOrEqual(2);
  });

  it("returns nothing when the prompt carries no signal", () => {
    expect(findContractServices("")).toHaveLength(0);
    expect(findContractServices("می‌خواهم یک قرارداد ببندم")).toHaveLength(0);
  });
});
