// ============================================================
// LEGALIR — Jalali date tests
// ============================================================
// The data layer stores ISO (Gregorian) dates; the UI shows Jalali.
// These tests pin the conversion both ways and the month-length
// rules, including the leap-year case that a naive implementation
// gets wrong.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  jalaliMonthLength,
  isoToJalali,
  jalaliToIso,
  isoToJalaliString,
  jalaliStringToIso,
  formatIsoJalali,
  isValidIsoDate,
  monthsBetween,
  addMonthsIso,
} from "../dates";

describe("dates — Jalali month lengths", () => {
  it("gives the first six months 31 days", () => {
    for (let m = 1; m <= 6; m++) expect(jalaliMonthLength(1405, m)).toBe(31);
  });

  it("gives months 7–11 thirty days", () => {
    for (let m = 7; m <= 11; m++) expect(jalaliMonthLength(1405, m)).toBe(30);
  });

  it("gives Esfand 30 days in a leap year and 29 otherwise", () => {
    // 1403 is a leap year in the Jalali calendar.
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });
});

describe("dates — ISO ↔ Jalali", () => {
  it("converts a known ISO date to Jalali", () => {
    // 2026-03-21 is 1 Farvardin 1405.
    expect(isoToJalali("2026-03-21")).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it("converts a known Jalali date to ISO", () => {
    expect(jalaliToIso(1405, 1, 1)).toBe("2026-03-21");
  });

  it("round-trips ISO → Jalali → ISO", () => {
    for (const iso of ["2026-03-21", "2026-09-20", "2027-01-05", "2025-12-31"]) {
      const j = isoToJalali(iso)!;
      expect(jalaliToIso(j.jy, j.jm, j.jd)).toBe(iso);
    }
  });

  it("returns null for missing or invalid input", () => {
    expect(isoToJalali(null)).toBeNull();
    expect(isoToJalali("")).toBeNull();
    expect(isoToJalali("not-a-date")).toBeNull();
  });
});

describe("dates — Jalali string helpers", () => {
  it("formats an ISO date as a Jalali string", () => {
    const s = isoToJalaliString("2026-03-21");
    expect(s).toContain("1405");
  });

  it("parses a Jalali string back to ISO", () => {
    // The picker emits "YYYY-MM-DD" in Jalali, matching the profile
    // birthDate storage format.
    expect(jalaliStringToIso("1405-01-01")).toBe("2026-03-21");
  });

  it("formats with Persian digits for display", () => {
    const out = formatIsoJalali("2026-03-21");
    expect(out).toContain("۱۴۰۵");
  });
});

describe("dates — validation and arithmetic", () => {
  it("validates ISO date strings", () => {
    expect(isValidIsoDate("2026-03-21")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });

  it("counts whole months between two ISO dates", () => {
    expect(monthsBetween("2026-03-21", "2027-03-21")).toBe(12);
    expect(monthsBetween("2026-03-21", "2026-09-21")).toBe(6);
    expect(monthsBetween(null, "2026-09-21")).toBeNull();
  });

  it("adds months to an ISO date", () => {
    expect(addMonthsIso("2026-03-21", 12)).toBe("2027-03-21");
    expect(addMonthsIso("2026-03-21", 1)).toBe("2026-04-21");
  });
});
