// ============================================================
// LEGALIR — Unified contract model
// ============================================================
// Guards the DISPLAY fallbacks for legacy rows whose text was written
// through a charset-less path and persisted as «???» / «????? ???».
// The stored value is never rewritten; the card must still show a
// meaningful heading and must never print a question-mark subtitle.
// ============================================================

import { describe, expect, it } from "vitest";
import type { PropertyContractListItem, V1ContractListItem } from "@legalir/types";
import { toUnifiedPropertyContract, toUnifiedV1Contract } from "../unified";

function makeProperty(
  overrides: Partial<PropertyContractListItem> = {}
): PropertyContractListItem {
  return {
    id: "pc-1",
    type: "vehicle-sale",
    typeFa: "خرید و فروش خودرو",
    title: "خرید و فروش خودرو",
    referenceCode: "PC-0001",
    state: "DRAFT",
    stateFa: "پیش‌نویس",
    progress: 20,
    locationFa: "بدون نشانی",
    partySummaryFa: "",
    currentStepTitleFa: null,
    analysisStatus: "not_reviewed",
    archived: false,
    exportedAt: null,
    lastAnalyzedAt: null,
    updatedAt: "2026-10-01T10:00:00.000Z",
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  } as PropertyContractListItem;
}

function makeV1(overrides: Partial<V1ContractListItem> = {}): V1ContractListItem {
  return {
    id: "v1-1",
    type: "nda",
    typeFa: "توافق‌نامه محرمانگی",
    title: "توافق‌نامه محرمانگی",
    state: "DRAFT",
    currentVersionNumber: 0,
    updatedAt: "2026-10-01T10:00:00.000Z",
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  } as V1ContractListItem;
}

describe("unified contract display fallbacks", () => {
  it("replaces a stored title with no letters or digits with the type name", () => {
    const os = toUnifiedPropertyContract(makeProperty({ title: "??? ??? ???" }));
    expect(os.title).toBe("خرید و فروش خودرو");

    const v1 = toUnifiedV1Contract(makeV1({ title: "???? ? ???? ???????? ???" }));
    expect(v1.title).toBe("توافق‌نامه محرمانگی");
  });

  it("treats a mixed string with a surviving letter as unusable too", () => {
    // «و» survives the bad round-trip, so a "has a letter" test would
    // wrongly accept this as a real party summary.
    const contract = toUnifiedPropertyContract(
      makeProperty({ locationFa: "???? ????? و ??? ?????", partySummaryFa: "طرفین: آقای احمدی" })
    );
    expect(contract.subtitleFa).toBe("طرفین: آقای احمدی");
  });

  it("keeps a real title untouched", () => {
    const os = toUnifiedPropertyContract(makeProperty({ title: "خودروی پژو ۲۰۶" }));
    expect(os.title).toBe("خودروی پژو ۲۰۶");
  });

  it("never shows a location made only of punctuation", () => {
    const withGarbageLocation = toUnifiedPropertyContract(
      makeProperty({ locationFa: "????? ???", partySummaryFa: "طرفین: آقای احمدی" })
    );
    expect(withGarbageLocation.subtitleFa).toBe("طرفین: آقای احمدی");

    const withNoFallback = toUnifiedPropertyContract(
      makeProperty({ locationFa: "????? ???", partySummaryFa: "" })
    );
    expect(withNoFallback.subtitleFa).toBe("");
  });

  it("still prefers a real location over the party summary", () => {
    const contract = toUnifiedPropertyContract(
      makeProperty({ locationFa: "تهران", partySummaryFa: "طرفین: آقای احمدی" })
    );
    expect(contract.subtitleFa).toBe("تهران");
  });

  it("treats the platform sentinel «بدون نشانی» as no location", () => {
    const contract = toUnifiedPropertyContract(
      makeProperty({ locationFa: "بدون نشانی", partySummaryFa: "طرفین: آقای احمدی" })
    );
    expect(contract.subtitleFa).toBe("طرفین: آقای احمدی");
  });
});
