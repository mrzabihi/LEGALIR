// ============================================================
// LEGALIR — Section summary status tests (§6)
// ============================================================
// The detail page's summary row must reflect the REAL completeness,
// never "did the user open this step". These tests pin the three states
// and the rule that only stages owning data are listed at all.
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

  it("never lists a stage that owns no fields", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 40, ["ودیعه"]),
    ]);
    // The review/signature stages are drawn by the lifecycle rail inside
    // their own steps. Listing them here too made one stage appear twice,
    // with two different statuses — the duplicated-stage defect.
    expect(items.map((i) => i.stepId)).toEqual(["parties", "financial"]);
  });

  it("reports a data step as complete only when every owned section is at 100%", () => {
    const items = buildSectionSummary(STEPS, [
      section("parties", 100),
      section("financial", 100),
    ]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.state === "complete" && i.percent === 100)).toBe(true);
    expect(items.every((i) => i.reasonFa === null)).toBe(true);
  });
});
