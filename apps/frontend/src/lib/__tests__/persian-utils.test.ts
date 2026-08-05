import { describe, it, expect } from "vitest";
import { toPersianDigits, fromPersianDigits, toPersianNumber } from "@/lib/persian-utils";

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
});
