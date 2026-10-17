// ============================================================
// LEGALIR — Admin discovery statistics
// ============================================================
// /admin/discovery reports how the «از کجا شروع کنم؟» intake behaved across
// the platform. These tests pin the two properties that make the panel
// trustworthy:
//
//   1. The numbers describe only the DISCOVERY cohort — a request that never
//      went through the flow never inflates a denominator or drags confidence
//      toward zero.
//   2. A recommendation is never counted as a selection, and a `rules`
//      degradation is never counted as a model answer.
// ============================================================

import { describe, it, expect } from "vitest";
import type { LegalRequestDiscovery } from "@legalir/types";
import { buildDiscoveryStats, hasDiscovery, type DiscoveryStatsRow } from "@/lib/admin/discovery-stats";

function record(over: Partial<LegalRequestDiscovery> = {}): LegalRequestDiscovery {
  return {
    description: "چک برگشتی دارم",
    explicitIntent: null,
    explicitCategory: null,
    inferredCategory: "checks",
    summaryFa: "کاربر یک چک برگشتی دارد",
    goalFa: "وصول مطالبات",
    ambiguitiesFa: [],
    confidence: null,
    needsLawyer: false,
    hasDocument: false,
    paths: [{ intent: "legal_question", titleFa: "گفت‌وگو", rationaleFa: "چون پرسشی است.", primary: true, selected: false }],
    source: "rules",
    version: 1,
    ...over,
  };
}

describe("hasDiscovery", () => {
  it("is true only when a record with at least one path is present", () => {
    expect(hasDiscovery({})).toBe(false);
    expect(hasDiscovery({ discovery: record() })).toBe(true);
    expect(hasDiscovery({ discovery: record({ paths: [] }) })).toBe(false);
  });
});

describe("buildDiscoveryStats", () => {
  it("counts only the rows that went through the discovery flow", () => {
    const rows: DiscoveryStatsRow[] = [
      { state: "DRAFT", discovery: record() },
      { state: "INTAKE" }, // no record — must not count
      { state: "MATCHING", discovery: record({ source: "ai", confidence: 80 }) },
    ];
    const stats = buildDiscoveryStats(rows);
    expect(stats.total).toBe(2);
    expect(stats.byState).toEqual([
      { key: "DRAFT", count: 1 },
      { key: "MATCHING", count: 1 },
    ]);
  });

  it("splits provenance honestly between ai and rules", () => {
    const stats = buildDiscoveryStats([
      { discovery: record({ source: "ai" }) },
      { discovery: record({ source: "rules" }) },
      { discovery: record({ source: "rules" }) },
    ]);
    expect(stats.bySource).toEqual({ ai: 1, rules: 2 });
  });

  it("averages confidence over only the analyses that estimated one", () => {
    const stats = buildDiscoveryStats([
      { discovery: record({ confidence: 60 }) },
      { discovery: record({ confidence: 80 }) },
      { discovery: record({ confidence: null }) }, // rules never estimate
    ]);
    expect(stats.avgConfidence).toBe(70);
  });

  it("returns a null average when no analysis estimated confidence", () => {
    expect(buildDiscoveryStats([{ discovery: record({ confidence: null }) }]).avgConfidence).toBeNull();
    expect(buildDiscoveryStats([]).avgConfidence).toBeNull();
  });

  it("counts a recommended path separately from the user's choice", () => {
    const rows: DiscoveryStatsRow[] = [
      {
        discovery: record({
          paths: [
            { intent: "calculation", titleFa: "محاسبه", rationaleFa: "چون حساب می‌خواهد.", primary: true, selected: false },
            { intent: "legal_question", titleFa: "گفت‌وگو", rationaleFa: "پرسش.", selected: true },
          ],
        }),
      },
    ];
    const stats = buildDiscoveryStats(rows);
    const calc = stats.byIntent.find((s) => s.intent === "calculation")!;
    const question = stats.byIntent.find((s) => s.intent === "legal_question")!;
    expect(calc).toMatchObject({ recommended: 1, primary: 1, chosen: 0 });
    expect(question).toMatchObject({ recommended: 1, primary: 0, chosen: 1 });
  });

  it("counts the first path as primary even without the explicit flag", () => {
    const stats = buildDiscoveryStats([
      {
        discovery: record({
          paths: [{ intent: "next_step", titleFa: "قدم بعدی", rationaleFa: "راهنما.", selected: false }],
        }),
      },
    ]);
    expect(stats.byIntent.find((s) => s.intent === "next_step")).toMatchObject({
      recommended: 1,
      primary: 1,
    });
  });

  it("exposes every engine intent, even the ones never recommended", () => {
    const stats = buildDiscoveryStats([{ discovery: record() }]);
    expect(stats.byIntent.map((s) => s.intent)).toEqual([
      "legal_question",
      "document_review",
      "draft_document",
      "calculation",
      "next_step",
      "lawyer",
    ]);
  });

  it("counts needsLawyer, documents, and explicit picks", () => {
    const stats = buildDiscoveryStats([
      { discovery: record({ needsLawyer: true, hasDocument: true, explicitIntent: "lawyer" }) },
      { discovery: record({ needsLawyer: false, hasDocument: false, explicitIntent: null }) },
    ]);
    expect(stats.needsLawyer).toBe(1);
    expect(stats.withDocument).toBe(1);
    expect(stats.explicitIntent).toBe(1);
  });

  it("distributes only the inferred category (never the explicit pick)", () => {
    const stats = buildDiscoveryStats([
      { discovery: record({ explicitCategory: "family", inferredCategory: "checks" }) },
      { discovery: record({ explicitCategory: "checks", inferredCategory: "checks" }) },
      { discovery: record({ inferredCategory: "real_estate" }) },
    ]);
    expect(stats.byCategory).toEqual([
      { key: "checks", count: 2 },
      { key: "real_estate", count: 1 },
    ]);
  });

  it("ignores a record with no inferred category without dropping the row", () => {
    const stats = buildDiscoveryStats([
      { discovery: record({ inferredCategory: null }) },
      { discovery: record({ inferredCategory: "checks" }) },
    ]);
    expect(stats.total).toBe(2);
    expect(stats.byCategory).toEqual([{ key: "checks", count: 1 }]);
  });

  it("returns a fully-zeroed shape for an empty cohort (never NaN)", () => {
    const stats = buildDiscoveryStats([]);
    expect(stats.total).toBe(0);
    expect(stats.bySource).toEqual({ ai: 0, rules: 0 });
    expect(stats.avgConfidence).toBeNull();
    expect(stats.byCategory).toEqual([]);
    expect(stats.byState).toEqual([]);
    expect(stats.byIntent.every((s) => s.recommended === 0 && s.primary === 0 && s.chosen === 0)).toBe(true);
  });
});
