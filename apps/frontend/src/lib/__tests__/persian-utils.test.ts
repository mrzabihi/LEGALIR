import { describe, it, expect } from "vitest";
import {
  toPersianDigits,
  fromPersianDigits,
  toPersianNumber,
  toPersianDate,
} from "@/lib/persian-utils";

describe("persian-utils", () => {
  describe("toPersianDigits", () => {
    it("converts numbers to Persian digits", () => {
      expect(toPersianDigits(123)).toBe("۱۲۳");
      expect(toPersianDigits("456")).toBe("۴۵۶");
    });

    it("keeps non-digit characters unchanged", () => {
      expect(toPersianDigits("ABC")).toBe("ABC");
    });

    it("handles mixed content", () => {
      expect(toPersianDigits("Phone: 09123456789")).toBe("Phone: ۰۹۱۲۳۴۵۶۷۸۹");
    });
  });

  describe("fromPersianDigits", () => {
    it("converts Persian digits to Western", () => {
      expect(fromPersianDigits("۱۲۳")).toBe("123");
    });

    it("handles Arabic-Indic digits", () => {
      expect(fromPersianDigits("١٢٣")).toBe("123");
    });
  });

  describe("toPersianNumber", () => {
    it("formats with Persian locale separators", () => {
      const result = toPersianNumber(1000000);
      expect(result).toContain("۱");
    });
  });

  describe("toPersianDate", () => {
    const date = new Date("2026-01-05T00:00:00Z");

    it("defaults to a long Jalali date", () => {
      const result = toPersianDate(date);
      expect(result).toContain("۱۴۰۴");
    });

    it("honours explicit component options without throwing", () => {
      // Regression: the default `dateStyle: "long"` used to be forced
      // alongside caller components, which Intl rejects with a TypeError
      // ("Can't set option month when dateStyle is used").
      expect(() => toPersianDate(date, { month: "2-digit", day: "2-digit" })).not.toThrow();
      expect(toPersianDate(date, { month: "2-digit", day: "2-digit" })).toContain("۱۵");
    });

    it("still allows an explicit dateStyle override", () => {
      const result = toPersianDate(date, { dateStyle: "short" });
      expect(result).toContain("۱۴۰۴");
    });
  });
});
