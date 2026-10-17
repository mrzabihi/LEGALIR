// ============================================================
// LEGALIR — Contract-listing pagination tests
// ============================================================
// The listing's hard rules, asserted without a browser:
//   • a page never holds more than the page size (20 by default);
//   • the last page holds the remainder, not padding;
//   • an out-of-range / malformed page is clamped, never blank;
//   • an empty result still reports one page.
// ============================================================

import { describe, it, expect } from "vitest";
import { paginate, CONTRACTS_PAGE_SIZE } from "../pagination";

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("contract listing pagination", () => {
  it("caps one page at twenty items by default", () => {
    expect(CONTRACTS_PAGE_SIZE).toBe(20);
    const page = paginate(items(45), 1);
    expect(page.items).toHaveLength(20);
    expect(page.items[0]).toBe(1);
    expect(page.items[19]).toBe(20);
    expect(page.totalPages).toBe(3);
    expect(page.total).toBe(45);
  });

  it("holds the remainder on the last page", () => {
    const page = paginate(items(45), 3);
    expect(page.items).toHaveLength(5);
    expect(page.items[0]).toBe(41);
    expect(page.page).toBe(3);
  });

  it("clamps a page beyond the end to the last real page", () => {
    const page = paginate(items(45), 99);
    expect(page.page).toBe(3);
    expect(page.items).toHaveLength(5);
  });

  it("clamps an invalid or non-positive page to the first", () => {
    expect(paginate(items(9), 0).page).toBe(1);
    expect(paginate(items(9), -4).page).toBe(1);
    expect(paginate(items(9), Number.NaN).page).toBe(1);
  });

  it("reports a single empty page for an empty result", () => {
    const page = paginate([], 4);
    expect(page).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
  });

  it("never renders the whole catalog at once", () => {
    const all = items(100);
    const first = paginate(all, 1);
    expect(first.items.length).toBeLessThan(all.length);
  });
});
