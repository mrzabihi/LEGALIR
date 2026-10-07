// ============================================================
// LEGALIR — Calculators catalog unit tests
// ============================================================
// The catalog module is the single source of truth for the discovery
// page. These tests lock the things that would silently break it:
//   1. every card points at a real, non-empty destination
//   2. the curated slug lists resolve (never a dangling reference)
//   3. search actually narrows (title / subtitle / category, AND,
//      Persian normalization, empty = everything)
//   4. search and filters compose
// ============================================================

import { describe, it, expect } from "vitest";
import {
  CATEGORY_ORDER,
  CATEGORY_PRESENTATION,
  QUICK_ACCESS_SLUGS,
  SUGGESTED_SLUGS,
  applyCalculatorQuery,
  cardsBySlugs,
  categoryOptions,
  groupCalculatorsByCategory,
  listCalculatorCards,
  populatedCategories,
  searchCalculators,
  statusOptions,
} from "@/lib/calculators/catalog";
import { listCalculators } from "@/lib/calculators";

describe("listCalculatorCards", () => {
  it("has exactly one card per registered calculator", () => {
    expect(listCalculatorCards()).toHaveLength(listCalculators().length);
  });

  it("gives every card a real, non-empty destination and copy", () => {
    for (const card of listCalculatorCards()) {
      expect(card.slug).toBeTruthy();
      expect(card.href).toBe(`/calculators/${card.slug}`);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.subtitle.length).toBeGreaterThan(0);
      expect(card.icon.length).toBeGreaterThan(0);
      expect(card.categoryGradient).toMatch(/^from-/);
    }
  });

  it("uses unique slugs and hrefs", () => {
    const slugs = listCalculatorCards().map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("orders cards by the declared category order", () => {
    const order = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
    const indices = listCalculatorCards().map((c) => order.get(c.category) ?? 999);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("assigns every card a category that has presentation metadata", () => {
    for (const card of listCalculatorCards()) {
      expect(CATEGORY_PRESENTATION[card.category]).toBeTruthy();
    }
  });
});

describe("curated slug lists", () => {
  it("resolves every quick-access slug to a real calculator", () => {
    expect(cardsBySlugs(QUICK_ACCESS_SLUGS)).toHaveLength(QUICK_ACCESS_SLUGS.length);
  });

  it("resolves every suggested slug to a real calculator", () => {
    expect(cardsBySlugs(SUGGESTED_SLUGS)).toHaveLength(SUGGESTED_SLUGS.length);
  });

  it("drops unknown slugs instead of fabricating cards", () => {
    expect(cardsBySlugs(["not-a-real-calculator"])).toHaveLength(0);
  });

  it("keeps the requested order", () => {
    const ordered = cardsBySlugs(["lawyer-fee", "court-fee"]);
    expect(ordered.map((c) => c.slug)).toEqual(["lawyer-fee", "court-fee"]);
  });
});

describe("searchCalculators", () => {
  const cards = listCalculatorCards();

  it("returns everything for an empty or whitespace query", () => {
    expect(searchCalculators(cards, "")).toHaveLength(cards.length);
    expect(searchCalculators(cards, "   ")).toHaveLength(cards.length);
  });

  it("matches on the title", () => {
    const results = searchCalculators(cards, "دیه");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.title.includes("دیه"))).toBe(true);
  });

  it("matches on the subtitle", () => {
    // «تأخیر تأدیه» appears in the delayed-payment subtitle.
    const results = searchCalculators(cards, "تأدیه");
    expect(results.length).toBeGreaterThan(0);
  });

  it("matches on the category label", () => {
    const results = searchCalculators(cards, "کار و استخدام");
    expect(results.length).toBeGreaterThan(0);
    for (const card of results) expect(card.category).toBe("employment");
  });

  it("normalizes Arabic yeh/kaf to Persian", () => {
    const arabic = "حقالو\u0643اله"; // Arabic kaf
    const persian = "حقالوکاله"; // Persian kaf
    expect(searchCalculators(cards, arabic).map((c) => c.slug)).toEqual(
      searchCalculators(cards, persian).map((c) => c.slug)
    );
  });

  it("requires every term to match (AND semantics)", () => {
    const single = searchCalculators(cards, "خسارت");
    const both = searchCalculators(cards, "خسارت تأخیر");
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThanOrEqual(single.length);
    expect(searchCalculators(cards, "خسارت zzzz")).toHaveLength(0);
  });

  it("returns nothing for a query that matches no calculator", () => {
    expect(searchCalculators(cards, "zzzz-بدون-نتیجه")).toHaveLength(0);
  });
});

describe("filterCalculators / applyCalculatorQuery", () => {
  const cards = listCalculatorCards();

  it("filters by category", () => {
    const employment = applyCalculatorQuery(cards, "", { category: "employment" });
    expect(employment.length).toBeGreaterThan(0);
    for (const card of employment) expect(card.category).toBe("employment");
  });

  it("treats «all» as no filter", () => {
    expect(applyCalculatorQuery(cards, "", { category: "all", status: "all" })).toHaveLength(
      cards.length
    );
  });

  it("composes search and filter — the result satisfies both", () => {
    const results = applyCalculatorQuery(cards, "دیه", { category: "judicial" });
    for (const card of results) {
      expect(card.category).toBe("judicial");
      expect(card.searchText).toContain("دیه");
    }
  });

  it("ignores an unknown category id", () => {
    expect(applyCalculatorQuery(cards, "", { category: "nope" })).toHaveLength(0);
  });
});

describe("grouping + options", () => {
  const cards = listCalculatorCards();

  it("only returns populated categories", () => {
    for (const meta of populatedCategories(cards)) {
      expect(cards.some((c) => c.category === meta.id)).toBe(true);
    }
  });

  it("groups without losing any card", () => {
    const groups = groupCalculatorsByCategory(cards);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(cards.length);
  });

  it("offers a category option for every populated category", () => {
    const options = categoryOptions(cards);
    expect(options.length).toBe(populatedCategories(cards).length);
    for (const option of options) expect(option.count).toBeGreaterThan(0);
  });

  it("only offers status options that have at least one calculator", () => {
    for (const option of statusOptions(cards)) {
      expect(option.count).toBeGreaterThan(0);
    }
  });
});
