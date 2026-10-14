// ============================================================
// LEGALIR — Admin pagination contract tests
// ============================================================
// Locks the shared server-side pagination behaviour every admin list endpoint
// depends on:
//
//   • the page-size allow-list (10 | 20 | 100) with a 20 default
//   • 1-based, clamped page numbers (a stale `?page=9` after a narrowing
//     search returns the LAST page, never an empty window)
//   • `total` is the count of rows matching the query — NOT the page size —
//     which is what makes global search honest.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  resolvePageSize,
  resolvePage,
  paginate,
} from "@/lib/admin/pagination";

describe("resolvePageSize", () => {
  it("accepts only the allow-listed sizes", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 100]);
    expect(resolvePageSize("10")).toBe(10);
    expect(resolvePageSize("20")).toBe(20);
    expect(resolvePageSize("100")).toBe(100);
    expect(resolvePageSize(100)).toBe(100);
  });

  it("falls back to the default for anything else", () => {
    for (const bad of ["", null, undefined, "0", "5", "1000", "abc", -20]) {
      expect(resolvePageSize(bad as unknown as string), String(bad)).toBe(DEFAULT_PAGE_SIZE);
    }
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });
});

describe("resolvePage", () => {
  it("parses a 1-based integer", () => {
    expect(resolvePage("1")).toBe(1);
    expect(resolvePage("7")).toBe(7);
    expect(resolvePage(3)).toBe(3);
  });

  it("never returns below 1", () => {
    for (const bad of ["", null, undefined, "0", "-4", "abc"]) {
      expect(resolvePage(bad as unknown as string), String(bad)).toBe(1);
    }
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 45 }, (_, i) => i + 1); // 1..45

  it("slices the requested window and reports the FULL matched count", () => {
    const p = paginate(rows, 1, 20);
    expect(p.items).toEqual(rows.slice(0, 20));
    expect(p.total).toBe(45); // matches the query, not the page
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
    expect(p.totalPages).toBe(3);
  });

  it("returns the tail window on the last page", () => {
    const p = paginate(rows, 3, 20);
    expect(p.items).toEqual([41, 42, 43, 44, 45]);
    expect(p.totalPages).toBe(3);
  });

  it("clamps an out-of-range page to the LAST page (no empty window)", () => {
    const p = paginate(rows, 99, 20);
    expect(p.page).toBe(3);
    expect(p.items).toEqual([41, 42, 43, 44, 45]);
  });

  it("clamps a sub-1 page to the first page", () => {
    const p = paginate(rows, 0, 20);
    expect(p.page).toBe(1);
    expect(p.items[0]).toBe(1);
  });

  it("keeps totalPages >= 1 for an empty result set", () => {
    const p = paginate([], 1, 20);
    expect(p.total).toBe(0);
    expect(p.totalPages).toBe(1);
    expect(p.items).toEqual([]);
  });

  it("honours a 100-row page size", () => {
    const p = paginate(rows, 1, 100);
    expect(p.items).toHaveLength(45);
    expect(p.totalPages).toBe(1);
  });
});
