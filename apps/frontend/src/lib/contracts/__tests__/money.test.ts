// ============================================================
// LEGALIR — Money conversion tests
// ============================================================
// The canonical model is integer rial; toman is a display concern.
// These tests pin the 1 toman = 10 rial rule and the round-trip
// through the UI parser, so no other module can drift.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  RIAL_PER_TOMAN,
  rial,
  toman,
  toToman,
  toRial,
  isZeroMoney,
  formatToman,
  formatTomanCompact,
  parseTomanInput,
  sumMoney,
  moneyEquals,
} from "../money";

describe("money — canonical rial model", () => {
  it("uses 1 toman = 10 rial", () => {
    expect(RIAL_PER_TOMAN).toBe(10);
  });

  it("builds rial amounts without conversion", () => {
    expect(rial(1_000_000)).toEqual({ amount: 1_000_000, currency: "IRR" });
  });

  it("converts toman input to rial", () => {
    expect(toman(100_000)).toEqual({ amount: 1_000_000, currency: "IRR" });
  });

  it("rounds fractional rial to an integer", () => {
    expect(rial(10.6).amount).toBe(11);
    expect(toman(10.04).amount).toBe(100);
  });

  it("reads toman back out of a rial amount", () => {
    expect(toToman({ amount: 1_000_000, currency: "IRR" })).toBe(100_000);
  });

  it("treats null/undefined as zero", () => {
    expect(toToman(null)).toBe(0);
    expect(toRial(undefined)).toBe(0);
    expect(isZeroMoney(null)).toBe(true);
    expect(isZeroMoney({ amount: 0, currency: "IRR" })).toBe(true);
    expect(isZeroMoney({ amount: 1, currency: "IRR" })).toBe(false);
  });

  it("round-trips toman → rial → toman", () => {
    const m = toman(185_000_000);
    expect(toToman(m)).toBe(185_000_000);
  });
});

describe("money — formatting", () => {
  it("formats toman with Persian digits and grouping", () => {
    const out = formatToman(toman(1_000_000_000));
    expect(out).toContain("تومان");
    expect(out).toContain("۱");
    expect(out).not.toContain("1000000000");
  });

  it("formats a compact billion/million label", () => {
    expect(formatTomanCompact(toman(1_000_000_000))).toContain("میلیارد");
    expect(formatTomanCompact(toman(25_000_000))).toContain("میلیون");
    expect(formatTomanCompact(toman(5_000))).toContain("هزار");
  });

  it("renders an em dash for a missing amount", () => {
    expect(formatToman(null)).toBe("—");
    expect(formatTomanCompact(undefined)).toBe("—");
  });
});

describe("money — parsing user input", () => {
  it("parses Latin digits with separators", () => {
    expect(parseTomanInput("1,000,000")).toEqual({ amount: 10_000_000, currency: "IRR" });
  });

  it("parses Persian digits", () => {
    expect(parseTomanInput("۵۰۰۰۰۰")).toEqual({ amount: 5_000_000, currency: "IRR" });
  });

  it("parses Arabic-Indic digits", () => {
    expect(parseTomanInput("٥٠٠٠٠٠")).toEqual({ amount: 5_000_000, currency: "IRR" });
  });

  it("rejects empty and negative input", () => {
    expect(parseTomanInput("")).toBeNull();
    expect(parseTomanInput("   ")).toBeNull();
    expect(parseTomanInput("-5")).toBeNull();
    expect(parseTomanInput("abc")).toBeNull();
  });
});

describe("money — arithmetic", () => {
  it("sums a list of amounts in rial", () => {
    // 5M + 6.5M + 7M toman = 18.5M toman = 185M rial.
    const total = sumMoney([toman(5_000_000), toman(6_500_000), toman(7_000_000)]);
    expect(total).toEqual({ amount: 185_000_000, currency: "IRR" });
  });

  it("ignores null entries when summing", () => {
    expect(sumMoney([toman(1_000), null, undefined])).toEqual({
      amount: 10_000,
      currency: "IRR",
    });
  });

  it("compares amounts by rial value", () => {
    expect(moneyEquals(toman(100), rial(1_000))).toBe(true);
    expect(moneyEquals(toman(100), toman(101))).toBe(false);
    expect(moneyEquals(null, rial(0))).toBe(true);
  });
});
