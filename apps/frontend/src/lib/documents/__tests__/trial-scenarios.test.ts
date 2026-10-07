// ============================================================
// LEGALIR — Trial scenario honesty contract
// ============================================================
// These tests protect the anti-fabrication guarantees of the trial
// («نمونهٔ آزمایشی») data:
//   • every finding belongs to the scenario's SAMPLE document (a `trial:`
//     id), never to a user document;
//   • citations point ONLY at real, catalogued project sources — no
//     invented article numbers;
//   • at least one finding carries no citation, proving the data does not
//     force a source where none exists;
//   • the trial label and scenario catalogue stay stable.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  TRIAL_LABEL_FA,
  TRIAL_DISCLAIMER_FA,
  TRIAL_DOCUMENT_PREFIX,
  TRIAL_SCENARIO_IDS,
  TRIAL_SCENARIOS,
  getTrialScenario,
  isTrialDocumentId,
  isTrialScenarioId,
  trialDocumentId,
} from "../trial-scenarios";

/**
 * The only legal sources a trial report may cite — the subset of the real
 * project law catalog mirrored into `trial-scenarios.ts`. Any other source id
 * would signal a fabricated legal reference.
 */
const ALLOWED_SOURCE_IDS = new Set([
  "law-penalty-clause",
  "law-civil-procedure",
  "law-constitution",
]);

describe("trial scenario catalogue", () => {
  it("keeps the canonical trial label", () => {
    expect(TRIAL_LABEL_FA).toBe("نمونهٔ آزمایشی");
    expect(TRIAL_DISCLAIMER_FA.length).toBeGreaterThan(0);
  });

  it("exposes exactly the four required scenarios", () => {
    expect(TRIAL_SCENARIO_IDS).toEqual(["lease", "car", "contracting", "nda"]);
    expect(TRIAL_SCENARIOS.map((s) => s.id)).toEqual(TRIAL_SCENARIO_IDS);
  });

  it("gives every scenario its own sample document and a trial report", () => {
    for (const scenario of TRIAL_SCENARIOS) {
      expect(scenario.titleFa.length).toBeGreaterThan(0);
      expect(scenario.descriptionFa.length).toBeGreaterThan(0);
      expect(scenario.docLabelFa.length).toBeGreaterThan(0);
      expect(scenario.extractedText.length).toBeGreaterThan(0);

      expect(isTrialDocumentId(scenario.report.documentId)).toBe(true);
      expect(scenario.report.findings.length).toBeGreaterThan(0);
      expect(scenario.questions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("scopes every finding to the scenario's sample document", () => {
    for (const scenario of TRIAL_SCENARIOS) {
      for (const finding of scenario.report.findings) {
        expect(finding.documentId).toBe(scenario.report.documentId);
        expect(isTrialDocumentId(finding.documentId)).toBe(true);
      }
    }
  });

  it("gives every finding a title, a reason and a proposed action", () => {
    for (const scenario of TRIAL_SCENARIOS) {
      for (const finding of scenario.report.findings) {
        expect(finding.id.length).toBeGreaterThan(0);
        expect(finding.title.length).toBeGreaterThan(0);
        expect(finding.reason.length).toBeGreaterThan(0);
        expect(finding.recommendation.length).toBeGreaterThan(0);
        expect(["low", "medium", "high", "critical"]).toContain(finding.severity);
      }
    }
  });

  it("cites ONLY real project sources with a locator and a quote", () => {
    for (const scenario of TRIAL_SCENARIOS) {
      for (const finding of scenario.report.findings) {
        const citation = finding.citation;
        if (!citation) continue;

        expect(ALLOWED_SOURCE_IDS.has(citation.sourceId)).toBe(true);
        expect(citation.sourceId).toBe(citation.source.id);
        expect(citation.locator.trim().length).toBeGreaterThan(0);
        expect(citation.quote && citation.quote.trim().length).toBeGreaterThan(0);
        expect(citation.source.status).toBe("valid");
      }
    }
  });

  it("never forces a citation where none exists", () => {
    const uncited = TRIAL_SCENARIOS.flatMap((s) => s.report.findings).filter(
      (f) => f.citation === null
    );
    expect(uncited.length).toBeGreaterThan(0);
  });

  it("scopes every trial question to a non-empty canned answer", () => {
    for (const scenario of TRIAL_SCENARIOS) {
      for (const q of scenario.questions) {
        expect(q.questionFa.trim().length).toBeGreaterThan(0);
        expect(q.answerFa.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("trial id helpers", () => {
  it("builds and recognises a trial document id", () => {
    expect(trialDocumentId("lease")).toBe(`${TRIAL_DOCUMENT_PREFIX}lease`);
    expect(isTrialDocumentId(trialDocumentId("nda"))).toBe(true);
    expect(isTrialDocumentId("doc-real-123")).toBe(false);
    expect(isTrialDocumentId(null)).toBe(false);
    expect(isTrialDocumentId(undefined)).toBe(false);
    expect(isTrialDocumentId("")).toBe(false);
  });

  it("resolves known scenarios and rejects unknown ids", () => {
    expect(getTrialScenario("lease")?.id).toBe("lease");
    expect(getTrialScenario("nope")).toBeUndefined();
    expect(getTrialScenario(null)).toBeUndefined();

    expect(isTrialScenarioId("car")).toBe(true);
    expect(isTrialScenarioId("spaceship")).toBe(false);
  });
});
