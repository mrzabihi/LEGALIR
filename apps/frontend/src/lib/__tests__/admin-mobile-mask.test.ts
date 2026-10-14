// ============================================================
// LEGALIR — admin mobile masking tests
// ============================================================
// Locks the panel-wide rule: exactly four real middle digits are hidden, the
// `+98`/`0098`/`0` prefix is preserved, every stored shape (national, E.164,
// Persian/Arabic digits, spaced/dashed) masks to the same digits, and a short
// value never leaks or gets sliced into nonsense.
// ============================================================

import { describe, it, expect } from "vitest";
import { maskMobileMiddle } from "@/lib/admin/mobile";

describe("maskMobileMiddle", () => {
  it("hides exactly four middle digits for the canonical E.164 value", () => {
    const masked = maskMobileMiddle("+989122842174");
    expect(masked).toBe("+9891****2174");
    // Exactly four stars, and the hidden digits are the real middle four.
    expect((masked.match(/\*/g) ?? []).length).toBe(4);
  });

  it("preserves the international and trunk prefixes verbatim", () => {
    expect(maskMobileMiddle("00989122842174")).toBe("009891****2174");
    expect(maskMobileMiddle("09122842174")).toBe("0912****174");
    expect(maskMobileMiddle("9122842174")).toBe("912****174");
  });

  it("reduces every equivalent shape of the same number to the same mask", () => {
    // All forms of 0912 284 2174 → the same hidden middle four digits "2842".
    const hidden = "2842";
    for (const raw of [
      "09122842174",
      "9122842174",
      "+989122842174",
      "00989122842174",
      "۰۹۱۲۲۸۴۲۱۷۴",
      "٠٩١٢٢٨٤٢١٧٤",
      "0912 284 2174",
      "0912-284-2174",
      "(0912) 284-2174",
    ]) {
      const masked = maskMobileMiddle(raw);
      expect(masked, raw).toContain("****");
      // The masked result never contains the hidden four-digit run.
      expect(masked.includes(hidden), raw).toBe(false);
    }
  });

  it("converts Persian/Arabic digits to ASCII before masking", () => {
    expect(maskMobileMiddle("۰۹۱۲۲۸۴۲۱۷۴")).toBe("0912****174");
    expect(maskMobileMiddle("٠٩١٢٢٨٤٢١٧٤")).toBe("0912****174");
  });

  it("handles legacy national and spaced shapes", () => {
    expect(maskMobileMiddle("0912 284 2174")).toBe("0912****174");
    expect(maskMobileMiddle("0912-284-2174")).toBe("0912****174");
  });

  it("never leaks: the hidden middle digits are absent from the output", () => {
    expect(maskMobileMiddle("+989122842174")).not.toContain("2284");
  });

  it("protects short/invalid values without slicing nonsense", () => {
    expect(maskMobileMiddle("123")).toBe("*23");
    expect(maskMobileMiddle("12")).toBe("****");
    expect(maskMobileMiddle("")).toBe("—");
    expect(maskMobileMiddle(null)).toBe("—");
    expect(maskMobileMiddle(undefined)).toBe("—");
    expect(maskMobileMiddle("abc")).toBe("—");
  });
});
