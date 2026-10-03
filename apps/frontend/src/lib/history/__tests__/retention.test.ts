// ============================================================
// LEGALIR — Retention rule tests (pure)
// ============================================================
// Locks the two INDEPENDENT limits: at most 100 active items, and items
// older than 31 days. Exactly 100 must delete nothing; the 101st triggers
// the count rule. Archived items never reach this function.
// ============================================================

import { describe, it, expect } from "vitest";
import { selectExpiredEntries, RETENTION_MAX_ITEMS } from "@/lib/history/retention";

const NOW = new Date("2026-08-01T00:00:00Z");

/** Build an entry whose retention window started `daysAgo` days before NOW. */
function entry(id: string, daysAgo: number, kind: "activity" | "conversation" = "activity") {
  const start = new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
  return { id, kind, retentionStart: start };
}

describe("selectExpiredEntries — age rule", () => {
  it("purges items older than 31 days", () => {
    const expired = selectExpiredEntries([entry("old", 32), entry("fresh", 5)], NOW);
    expect(expired.map((e) => e.id)).toEqual(["old"]);
  });

  it("keeps an item exactly at the 31-day boundary", () => {
    const expired = selectExpiredEntries([entry("edge", 31)], NOW);
    expect(expired).toEqual([]);
  });

  it("purges an item just past the boundary", () => {
    const expired = selectExpiredEntries([entry("past", 31.5)], NOW);
    expect(expired.map((e) => e.id)).toEqual(["past"]);
  });
});

describe("selectExpiredEntries — count rule", () => {
  it("deletes nothing when there are exactly 100 fresh items", () => {
    const entries = Array.from({ length: RETENTION_MAX_ITEMS }, (_, i) => entry(`e${i}`, 1));
    expect(selectExpiredEntries(entries, NOW)).toEqual([]);
  });

  it("deletes exactly one when the 101st item is added", () => {
    const entries = Array.from({ length: RETENTION_MAX_ITEMS + 1 }, (_, i) => entry(`e${i}`, 1));
    const expired = selectExpiredEntries(entries, NOW);
    expect(expired).toHaveLength(1);
  });

  it("removes the OLDEST items first (deterministic)", () => {
    // 100 fresh items, all 1 day old, plus one 2-day-old item → the
    // 2-day-old one is the oldest and must be the one removed.
    const entries = [
      entry("oldest", 2),
      ...Array.from({ length: RETENTION_MAX_ITEMS }, (_, i) => entry(`e${i}`, 1)),
    ];
    const expired = selectExpiredEntries(entries, NOW);
    expect(expired.map((e) => e.id)).toEqual(["oldest"]);
  });

  it("combines the age rule and the count rule independently", () => {
    // 1 aged-out item + 101 fresh items → 1 (age) + 1 (overflow) = 2.
    const entries = [
      entry("aged", 40),
      ...Array.from({ length: RETENTION_MAX_ITEMS + 1 }, (_, i) => entry(`e${i}`, 1)),
    ];
    const expired = selectExpiredEntries(entries, NOW);
    expect(expired).toHaveLength(2);
    expect(expired.map((e) => e.id)).toContain("aged");
  });

  it("is deterministic for ties (same start time → ordered by id)", () => {
    const entries = Array.from({ length: RETENTION_MAX_ITEMS + 2 }, (_, i) =>
      entry(`e${String(i).padStart(3, "0")}`, 1)
    );
    const first = selectExpiredEntries(entries, NOW).map((e) => e.id);
    const second = selectExpiredEntries(entries, NOW).map((e) => e.id);
    expect(first).toEqual(second);
    expect(first).toEqual(["e000", "e001"]);
  });
});
