import { describe, it, expect } from "vitest";
import { PROCESSING_STAGES } from "@legalir/types";
import { classifyMessage } from "../ai/pipeline/classify";
import { STAGE_CONFIG, STAGE_ORDER, TOTAL_STAGES, stageNumber, nextStage } from "../ai/pipeline/stages";

// ============================================================
// Legal Intelligence Pipeline — Unit Tests
// Pins the five-stage model, the Stage-1 classifier, and the
// stage configuration that drives both the backend and the UI.
// Run with: npx vitest run src/lib/__tests__/legal-pipeline.test.ts
// ============================================================

describe("pipeline stage configuration", () => {
  it("defines exactly five stages in execution order", () => {
    expect(TOTAL_STAGES).toBe(5);
    expect(PROCESSING_STAGES).toEqual([
      "IDENTIFY",
      "UNDERSTAND",
      "RESEARCH",
      "ANALYZE",
      "RESPOND",
    ]);
  });

  it("numbers stages 1..5 and keeps STAGE_ORDER aligned", () => {
    expect(STAGE_ORDER.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
    expect(stageNumber("IDENTIFY")).toBe(1);
    expect(stageNumber("RESPOND")).toBe(5);
  });

  it("gives every stage a Persian label and description", () => {
    for (const s of PROCESSING_STAGES) {
      expect(STAGE_CONFIG[s].label.length).toBeGreaterThan(0);
      expect(STAGE_CONFIG[s].description.length).toBeGreaterThan(0);
    }
    expect(STAGE_CONFIG.RESEARCH.label).toBe("بررسی منابع");
    expect(STAGE_CONFIG.RESPOND.label).toBe("آماده‌سازی پاسخ");
  });

  it("walks to the next stage and stops at the last", () => {
    expect(nextStage("IDENTIFY")).toBe("UNDERSTAND");
    expect(nextStage("ANALYZE")).toBe("RESPOND");
    expect(nextStage("RESPOND")).toBeNull();
  });
});

describe("classifyMessage (Stage 1 — IDENTIFY)", () => {
  it("classifies a rental dispute into the property category", () => {
    const c = classifyMessage("مستأجر من رهن و اجاره را پرداخت نمی‌کند و ملک را تخلیه نمی‌کند", false);
    expect(c.legalCategory).toBe("property");
    expect(c.requiresSources).toBe(true);
    expect(c.requiresCaseContext).toBe(true);
  });

  it("flags a criminal matter for lawyer review", () => {
    const c = classifyMessage("همسایه من مرا تهدید به ضرب و جرح کرده و می‌خواهم شکایت کیفری کنم", false);
    expect(c.initialRiskFlags).toContain("criminal_exposure");
  });

  it("treats a short informational question as needing no clarification", () => {
    const c = classifyMessage("سفته چیست؟", false);
    expect(c.requiresClarification).toBe(false);
  });

  it("extracts amounts, dates and cities as entities", () => {
    const c = classifyMessage("قرارداد ۵۰۰ میلیون تومان در تهران ۱۴۰۳/۰۵/۱۲ امضا شد", false);
    expect(c.detectedEntities.some((e) => e.startsWith("amount:"))).toBe(true);
    expect(c.detectedEntities.some((e) => e.startsWith("location:"))).toBe(true);
  });

  it("marks document context required when a document is attached", () => {
    const c = classifyMessage("این قرارداد را بررسی کن", true);
    expect(c.requiresDocumentContext).toBe(true);
  });

  it("always returns a classification, even for an unmatched message", () => {
    const c = classifyMessage("سلام", false);
    expect(c.legalCategory).toBe("other");
    expect(c.intent).toBe("general_legal_question");
    expect(typeof c.confidence).toBe("number");
  });
});
