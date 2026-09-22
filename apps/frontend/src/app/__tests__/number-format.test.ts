// ============================================================
// LEGALIR — Persian number formatting contract
// ============================================================
// Pins the single source of truth for parsing, grouping and
// number-to-words. Every money/number field in the product depends
// on these, so a regression here is a regression everywhere.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  parseFormattedNumber,
  formatPersianAmount,
  groupDigits,
  numberToPersianWords,
  formatMoneyWords,
  normalizeDigits,
  digitsBefore,
  caretAfterDigit,
} from "@legalir/ui";

describe("parseFormattedNumber", () => {
  it("resolves every accepted spelling of 500,000,000 to the same number", () => {
    for (const input of [
      "500000000",
      "500,000,000",
      "500.000.000",
      "۵۰۰۰۰۰۰۰۰",
      "۵۰۰.۰۰۰.۰۰۰",
      "۵۰۰٬۰۰۰٬۰۰۰",
      "٥٠٠٠٠٠٠٠٠",
    ]) {
      expect(parseFormattedNumber(input), input).toBe(500_000_000);
    }
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseFormattedNumber("")).toBeNull();
    expect(parseFormattedNumber("   ")).toBeNull();
    expect(parseFormattedNumber("abc")).toBeNull();
    expect(parseFormattedNumber("۱۲۳abc")).toBeNull();
  });

  it("keeps decimals only when asked", () => {
    expect(parseFormattedNumber("1,234.5", { decimal: true })).toBe(1234.5);
    // Without the flag, `.` is a thousands separator.
    expect(parseFormattedNumber("1,234.5")).toBe(12345);
  });
});

describe("groupDigits / formatPersianAmount", () => {
  it("groups the integer part only", () => {
    expect(groupDigits(3000000)).toBe("3\u066C000\u066C000");
    expect(groupDigits("1234.56")).toBe("1\u066C234.56");
  });

  it("renders Persian digits with the Persian separator", () => {
    expect(formatPersianAmount(3_000_000)).toBe("۳٬۰۰۰٬۰۰۰");
    expect(formatPersianAmount(500)).toBe("۵۰۰");
  });
});

describe("numberToPersianWords", () => {
  it("spells the canonical amounts", () => {
    expect(numberToPersianWords(1)).toBe("یک");
    expect(numberToPersianWords(10)).toBe("ده");
    expect(numberToPersianWords(100)).toBe("صد");
    expect(numberToPersianWords(1_000)).toBe("یک هزار");
    expect(numberToPersianWords(10_000)).toBe("ده هزار");
    expect(numberToPersianWords(100_000)).toBe("صد هزار");
    expect(numberToPersianWords(1_000_000)).toBe("یک میلیون");
    expect(numberToPersianWords(3_000_000)).toBe("سه میلیون");
    expect(numberToPersianWords(12_500_000)).toBe("دوازده میلیون و پانصد هزار");
    expect(numberToPersianWords(100_000_000)).toBe("صد میلیون");
    expect(numberToPersianWords(1_000_000_000)).toBe("یک میلیارد");
  });

  it("handles teens and compound hundreds", () => {
    expect(numberToPersianWords(15)).toBe("پانزده");
    expect(numberToPersianWords(999)).toBe("نهصد و نود و نه");
    expect(numberToPersianWords(0)).toBe("صفر");
  });
});

describe("formatMoneyWords", () => {
  it("appends the unit label", () => {
    expect(formatMoneyWords(3_000_000, "تومان")).toBe("سه میلیون تومان");
    expect(formatMoneyWords(3_000_000, "ریال")).toBe("سه میلیون ریال");
  });

  it("suppresses the meaningless zero line", () => {
    expect(formatMoneyWords(0, "تومان")).toBe("");
    expect(formatMoneyWords(null, "تومان")).toBe("");
  });
});

describe("caret helpers", () => {
  it("counts digits before the caret, ignoring separators", () => {
    expect(digitsBefore("۳٬۰۰۰", 5)).toBe(4);
    expect(digitsBefore("۳٬۰۰۰", 2)).toBe(1);
  });

  it("maps a digit index back to a string index", () => {
    expect(caretAfterDigit("۳٬۰۰۰", 4)).toBe(5);
    expect(caretAfterDigit("۳٬۰۰۰", 1)).toBe(1);
    expect(caretAfterDigit("۳٬۰۰۰", 0)).toBe(0);
  });

  it("round-trips a caret position through a reformat", () => {
    const raw = "۳٬۰۰۰";
    const caret = 1; // immediately after the first digit
    const digits = digitsBefore(raw, caret);
    expect(caretAfterDigit(raw, digits)).toBe(caret);
  });
});

describe("normalizeDigits", () => {
  it("converts Persian and Arabic-Indic digits to ASCII", () => {
    expect(normalizeDigits("۱۲۳")).toBe("123");
    expect(normalizeDigits("١٢٣")).toBe("123");
  });
});
