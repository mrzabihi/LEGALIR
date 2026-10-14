// ============================================================
// LEGALIR — Search normalization layer tests
// ============================================================
// Locks the behaviour that the admin global-search depends on: a user stored
// as the canonical E.164 `+989122842174` must be found by EVERY format an
// operator might paste, and Persian text must match across Arabic/Persian
// letter variants. These are the acceptance examples from the spec.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  searchTextKey,
  matchesText,
  phoneSearchKey,
  matchesPhone,
  matchesRow,
} from "@/lib/search/normalize";

const STORED_E164 = "+989122842174"; // canonical value the store holds
const STORED_RAW = "09122842174"; // same number, national form

describe("searchTextKey", () => {
  it("unifies Arabic yeh/kaf with Persian", () => {
    expect(searchTextKey("علي")).toBe(searchTextKey("علی"));
    expect(searchTextKey("كتاب")).toBe(searchTextKey("کتاب"));
    expect(searchTextKey("مدرسه")).toBe(searchTextKey("مدرسه"));
  });

  it("converts Persian and Arabic-Indic digits to ASCII", () => {
    expect(searchTextKey("۰۹۱۲")).toBe("0912");
    expect(searchTextKey("٠٩١٢")).toBe("0912");
  });

  it("collapses whitespace and lowercases Latin", () => {
    expect(searchTextKey("  Ali   Rezaei ")).toBe("ali rezaei");
  });
});

describe("phoneSearchKey — normalization of Iranian mobiles", () => {
  it("reduces every accepted format to the national significant number", () => {
    const expected = "9122842174";
    for (const raw of [
      "09122842174",
      "9122842174",
      "989122842174",
      "+989122842174",
      "00989122842174",
      "۰۹۱۲۲۸۴۲۱۷۴",
      "٠٩١٢٢٨٤٢١٧٤",
      "0912 284 2174",
      "0912-284-2174",
      "(0912) 284-2174",
    ]) {
      expect(phoneSearchKey(raw), raw).toBe(expected);
    }
  });

  it("returns null when there are no digits", () => {
    expect(phoneSearchKey("علی رضایی")).toBeNull();
    expect(phoneSearchKey("")).toBeNull();
    expect(phoneSearchKey(null)).toBeNull();
  });

  it("keeps partial queries intact for prefix matching", () => {
    expect(phoneSearchKey("0912")).toBe("912");
    expect(phoneSearchKey("9122")).toBe("9122");
  });
});

describe("matchesPhone — query vs stored, both sides normalized", () => {
  const cases = [
    "09122842174",
    "9122842174",
    "۰۹۱۲۲۸۴۲۱۷۴",
    "٠٩١٢٢٨٤٢١٧٤",
    "0912 284 2174",
    "0912-284-2174",
    "+989122842174",
    "00989122842174",
  ];

  it("finds the stored E.164 value from every query format", () => {
    for (const q of cases) {
      expect(matchesPhone(q, STORED_E164), q).toBe(true);
    }
  });

  it("finds the stored national value from every query format", () => {
    for (const q of cases) {
      expect(matchesPhone(q, STORED_RAW), q).toBe(true);
    }
  });

  it("supports partial prefix queries", () => {
    expect(matchesPhone("9122", STORED_E164)).toBe(true);
    expect(matchesPhone("09122", STORED_E164)).toBe(true);
  });

  it("does not match a different number", () => {
    expect(matchesPhone("09129999999", STORED_E164)).toBe(false);
  });

  it("does not phone-match a name query", () => {
    expect(matchesPhone("علی", STORED_E164)).toBe(false);
  });
});

describe("matchesText", () => {
  it("matches across Persian/Arabic letter variants", () => {
    expect(matchesText("علي", "علی رضایی")).toBe(true);
    expect(matchesText("كتاب", "کتاب قانون")).toBe(true);
  });

  it("matches partial substrings", () => {
    expect(matchesText("رضا", "علی رضایی")).toBe(true);
  });

  it("ignores an empty query", () => {
    expect(matchesText("", "anything")).toBe(false);
  });
});

describe("matchesRow — combined lanes", () => {
  it("matches a row by phone OR by text", () => {
    const row = { mobile: STORED_E164, name: "علی رضایی" };
    expect(matchesRow("09122842174", { phones: [row.mobile], texts: [row.name] })).toBe(true);
    expect(matchesRow("رضایی", { phones: [row.mobile], texts: [row.name] })).toBe(true);
    expect(matchesRow("ناموجود", { phones: [row.mobile], texts: [row.name] })).toBe(false);
  });
});
