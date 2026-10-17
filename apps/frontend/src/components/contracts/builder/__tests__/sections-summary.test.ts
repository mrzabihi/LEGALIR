// ============================================================
// LEGALIR — Section summary status tests (§6)
// ============================================================
// The detail page's summary row must reflect the REAL completeness,
// never "did the user open this step". These tests pin the three
// states and the review step's derived status.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractCompletenessSection,
  WizardStepDescriptor,
} from "@legalir/types";
import { buildSectionSummary } from "../sections-summary";

const STEPS: WizardStepDescriptor[] = [
  { id: "parties", titleFa: "طرفین قرارداد", descriptionFa: "", sections: ["parties"] },
  { id: "financial", titleFa: "شرایط مالی", descriptionFa: "", sections: ["financial"] },
  { id: "review", titleFa: "بازبینی و پیش‌نمایش", descriptionFa: "", sections: [] },
];

function section(
  key: string,
  percent: number,
  missing: string[] = []
): ContractCompletenessSection {
  return { key, labelFa: key, percent, missing };
}

describe("buildSectionSummary", () => {
  it("marks a fully-scored step complete and a zero-scored step incomplete", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 0, ["ودیعه", "اجاره‌بها"]),
    ]);

    expect(items[0]).toMatchObject({ stepId: "parties", state: "complete", percent: 100 });
    expect(items[1]).toMatchObject({ stepId: "financial", state: "incomplete", percent: 0 });
    // The reason is the real missing labels, not a generic message.
    expect(items[1]!.reasonFa).toBe("ودیعه، اجاره‌بها");
  });

  it("reports a partially filled step as in-progress with its percentage", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 60, ["ودیعه"]),
    ]);
    expect(items[1]).toMatchObject({ state: "in-progress", percent: 60, reasonFa: "ودیعه" });
  });

  it("caps a long reason instead of wrapping the card", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 0, ["الف", "ب", "ج", "د"]),
      section("financial", 100),
    ]);
    expect(items[0]!.reasonFa).toBe("الف، ب و ۲ مورد دیگر");
  });

  it("derives the review step from the other sections", () => {
    const blocked = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 40, ["ودیعه"]),
    ]);
    expect(blocked[2]).toMatchObject({ state: "review", percent: null });
    expect(blocked[2]!.reasonFa).toBe("۱ بخش هنوز تکمیل نشده است");

    const ready = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 100),
    ]);
    expect(ready[2]!.reasonFa).toBeNull();
  });
});
