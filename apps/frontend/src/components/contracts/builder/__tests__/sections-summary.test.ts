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
  { id: "signature", titleFa: "امضا", descriptionFa: "", sections: [] },
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
    expect(blocked[3]).toMatchObject({ state: "review", percent: null });
    expect(blocked[3]!.reasonFa).toBe("۱ بخش هنوز تکمیل نشده است");

    const ready = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 100),
    ]);
    expect(ready[3]!.reasonFa).toBeNull();
  });

  it("marks the signature stage as its own stage, not as a data step", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 100),
    ]);
    // It owns no fields, so it can never be reported as a missing-data
    // step — but it is told apart from the final review step.
    expect(items[2]).toMatchObject({ stepId: "signature", state: "stage", percent: null });
    expect(items[3]).toMatchObject({ stepId: "review", state: "review" });
  });
});
