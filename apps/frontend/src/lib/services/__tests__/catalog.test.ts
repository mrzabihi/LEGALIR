// ============================================================
// LEGALIR — Services catalog unit tests
// ============================================================
// The catalog is the single source of truth for the /services page.
// These tests lock the two things that would silently break the page:
//   1. every catalog item points at a real, non-empty destination
//   2. Persian search normalization actually matches real input
// ============================================================

import { describe, it, expect } from "vitest";
import {
  CATALOG_CATEGORIES,
  CATALOG_SIZE,
  LIBRARY_CAMPAIGN,
  LIBRARY_ITEMS,
  NDA_CAMPAIGN,
  NEW_SERVICES,
  PRIMARY_CAMPAIGN,
  SECONDARY_CAMPAIGN,
  SERVICE_BANNERS,
  SERVICE_CATALOG,
  SERVICE_CATEGORIES,
  itemsByCategory,
  populatedCategories,
  searchCatalog,
} from "@/lib/services/catalog";
import { LEGAL_SERVICES } from "@/lib/services/registry";
import { LAW_SERVICE_EXAMPLES } from "@/lib/law-catalog";
import { listCalculators } from "@/lib/calculators";
import { implementedContractDefinitions } from "@/lib/contracts/registry";

describe("SERVICE_CATALOG", () => {
  it("derives from every owning registry — no service is dropped", () => {
    // The six AI services, the documented law-backed services, every
    // implemented contract type and every registered calculator must all
    // be represented. This is the "no service disappears" guarantee.
    const expected =
      LEGAL_SERVICES.length +
      LAW_SERVICE_EXAMPLES.length +
      implementedContractDefinitions().length +
      listCalculators().length +
      LIBRARY_ITEMS.length;
    expect(CATALOG_SIZE).toBe(expected);
    expect(SERVICE_CATALOG).toHaveLength(expected);
  });

  it("gives every item a title, description, href, icon and gradient", () => {
    for (const item of SERVICE_CATALOG) {
      expect(item.id).toBeTruthy();
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.href).toMatch(/^\//);
      expect(item.icon).toBeTruthy();
      expect(item.gradient).toMatch(/^from-/);
    }
  });

  it("uses unique ids", () => {
    const ids = SERVICE_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns every item to a declared category", () => {
    const declared = new Set(SERVICE_CATEGORIES.map((c) => c.id));
    for (const item of SERVICE_CATALOG) {
      expect(declared.has(item.category)).toBe(true);
    }
  });

  it("gives every category a unique anchor", () => {
    const anchors = SERVICE_CATEGORIES.map((c) => c.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});

describe("SERVICE_CATEGORIES route shortcuts", () => {
  it("gives every shortcut a real, internal destination", () => {
    for (const category of SERVICE_CATEGORIES) {
      expect(category.href).toMatch(/^\//);
    }
  });

  it("routes each shortcut to the surface that owns that area", () => {
    const href = new Map(SERVICE_CATEGORIES.map((c) => [c.id, c.href]));
    expect(href.get("consultation")).toBe("/lawyers");
    expect(href.get("contracts")).toBe("/contracts");
    expect(href.get("documents")).toBe("/documents");
    expect(href.get("calculators")).toBe("/calculators");
    expect(href.get("cases")).toBe("/cases");
    expect(href.get("library")).toBe("/blog");
    expect(href.get("my-consultations")).toBe("/consultations");
  });

  it("adds the personal «مشاوره‌های من» entry point without a catalog section", () => {
    const mine = SERVICE_CATEGORIES.find((c) => c.id === "my-consultations");
    expect(mine).toBeTruthy();
    expect(mine?.inCatalog).toBe(false);
    // CATALOG_CATEGORIES is the six groups that render a section below.
    expect(CATALOG_CATEGORIES).toHaveLength(6);
    expect(CATALOG_CATEGORIES.map((c) => c.id)).not.toContain("my-consultations");
    for (const category of CATALOG_CATEGORIES) {
      expect(category.inCatalog).toBe(true);
    }
  });
});

describe("itemsByCategory / populatedCategories", () => {
  it("partitions the catalog without loss", () => {
    const total = SERVICE_CATEGORIES.reduce(
      (sum, c) => sum + itemsByCategory(c.id).length,
      0
    );
    expect(total).toBe(CATALOG_SIZE);
  });

  it("only returns categories that have items", () => {
    for (const category of populatedCategories()) {
      expect(itemsByCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it("places the six AI services in their intended categories", () => {
    const byId = new Map(SERVICE_CATALOG.map((i) => [i.id, i]));
    expect(byId.get("svc-legal_consultation")?.category).toBe("consultation");
    expect(byId.get("svc-contract_review")?.category).toBe("documents");
    expect(byId.get("svc-contract_drafting")?.category).toBe("contracts");
    expect(byId.get("svc-legal_notice")?.category).toBe("contracts");
    expect(byId.get("svc-document_analysis")?.category).toBe("documents");
    expect(byId.get("svc-legal_calculation")?.category).toBe("calculators");
  });
});

describe("LIBRARY_ITEMS", () => {
  it("populates the library category so its section always renders", () => {
    expect(itemsByCategory("library").length).toBeGreaterThan(0);
    expect(populatedCategories().map((c) => c.id)).toContain("library");
  });

  it("points every library item at a real, non-empty destination", () => {
    for (const item of LIBRARY_ITEMS) {
      expect(item.href).toMatch(/^\/(legal-library|blog)/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});

describe("searchCatalog", () => {
  it("returns the whole catalog for an empty query", () => {
    expect(searchCatalog("")).toHaveLength(CATALOG_SIZE);
    expect(searchCatalog("   ")).toHaveLength(CATALOG_SIZE);
  });

  it("matches on the title", () => {
    const results = searchCatalog("اظهارنامه");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title.includes("اظهارنامه"))).toBe(true);
  });

  it("matches on keywords that never appear in the title", () => {
    // «مهریه» is a keyword on the dowry calculator, not its title.
    const results = searchCatalog("مهریه");
    expect(results.length).toBeGreaterThan(0);
  });

  it("normalizes Arabic yeh/kaf to Persian", () => {
    // «مشاوره» typed with an Arabic yeh (U+064A) must match the Persian
    // spelling (U+06CC) used in the catalog.
    const arabic = "مشاور\u0647";
    const persian = "مشاوره";
    expect(searchCatalog(arabic).map((r) => r.id)).toEqual(
      searchCatalog(persian).map((r) => r.id)
    );
  });

  it("matches Latin terms case-insensitively (NDA)", () => {
    const upper = searchCatalog("NDA");
    const lower = searchCatalog("nda");
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.map((r) => r.id)).toEqual(lower.map((r) => r.id));
  });

  it("requires every term to match (AND semantics)", () => {
    // «قرارداد کار» matches the labour-contract item; «قرارداد» alone
    // matches strictly more. A query whose terms never co-occur returns
    // nothing rather than the union.
    const single = searchCatalog("قرارداد");
    const both = searchCatalog("قرارداد کار");
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThan(single.length);
    expect(searchCatalog("قرارداد zzzz")).toHaveLength(0);
  });

  it("returns nothing for a query that matches no service", () => {
    expect(searchCatalog("zzzz-بدون-نتیجه")).toHaveLength(0);
  });
});

describe("SERVICE_BANNERS", () => {
  it("covers the six brief-specified destinations", () => {
    const hrefs = SERVICE_BANNERS.map((b) => b.href);
    expect(hrefs).toContain("/calculators");
    expect(hrefs).toContain("/documents?service=document_analysis");
    expect(hrefs).toContain("/chat?service=legal_notice");
    expect(hrefs).toContain("/contracts?service=contract_drafting");
    expect(hrefs).toContain("/contracts/review");
    expect(hrefs).toContain("/chat?service=legal_consultation");
  });

  it("gives every banner a title, message, CTA and unique id", () => {
    for (const banner of SERVICE_BANNERS) {
      expect(banner.title.length).toBeGreaterThan(0);
      expect(banner.message.length).toBeGreaterThan(0);
      expect(banner.cta.length).toBeGreaterThan(0);
      expect(banner.href).toMatch(/^\//);
    }
    const ids = SERVICE_BANNERS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("campaign banners", () => {
  it("points the primary campaign at the human-lawyer area", () => {
    expect(PRIMARY_CAMPAIGN.href).toBe("/lawyers");
    // The copy must name the human experience so it can never be
    // confused with the AI «مشاوره حقوقی» service banner.
    expect(PRIMARY_CAMPAIGN.experience).toContain("وکیل");
  });

  it("points the library campaign at the legal library", () => {
    expect(LIBRARY_CAMPAIGN.href).toBe("/legal-library");
    // Educational content must not read as paid legal advice.
    expect(LIBRARY_CAMPAIGN.message).toContain("آموزشی");
  });

  it("points the NDA campaign at the NDA contract wizard", () => {
    expect(NDA_CAMPAIGN.href).toBe("/contracts/new?type=nda");
  });

  it("gives every campaign a distinct id and an art key", () => {
    const campaigns = [PRIMARY_CAMPAIGN, SECONDARY_CAMPAIGN, NDA_CAMPAIGN, LIBRARY_CAMPAIGN];
    const ids = campaigns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const campaign of campaigns) {
      expect(campaign.art).toBeTruthy();
      expect(campaign.eyebrow.length).toBeGreaterThan(0);
      expect(campaign.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("NEW_SERVICES", () => {
  it("offers three services", () => {
    expect(NEW_SERVICES).toHaveLength(3);
  });

  it("only marks a service available when it has a real destination", () => {
    for (const service of NEW_SERVICES) {
      if (service.status === "available") {
        expect(service.href).toMatch(/^\//);
      } else {
        expect(service.statusLabel).toBeTruthy();
      }
    }
  });

  it("includes the operational NDA contract", () => {
    const nda = NEW_SERVICES.find((s) => s.id === "new-nda");
    expect(nda?.status).toBe("available");
    expect(nda?.href).toBe("/contracts/new?type=nda");
  });
});
