// ============================================================
// LEGALIR — review-insights derivation tests
// ============================================================
// These pin the HONESTY rules the review surface depends on:
//   • an unknown subject stays unknown;
//   • a suggestion only exists when real data backs it;
//   • a follow-up question exists only for a real gap, is retired once
//     answered, and is never duplicated;
//   • limitations state what the analysis could NOT establish.
// ============================================================

import { describe, expect, it } from "vitest";
import type { DocumentFinding, RiskReport } from "@legalir/types";
import { listCalculatorCards } from "@/lib/calculators/catalog";
import {
  buildAttentionList,
  buildFollowUpQuestions,
  composeFollowUpMessage,
  detectSections,
  detectSubject,
  deriveNextSteps,
  reviewLimitations,
} from "../review-insights";

function finding(overrides: Partial<DocumentFinding> = {}): DocumentFinding {
  return {
    id: "f-1",
    documentId: "doc-1",
    title: "شرط فسخ یک‌طرفه",
    severity: "high",
    locator: "بند ۴",
    reason: "حق فسخ فقط برای یک طرف پیش‌بینی شده است.",
    recommendation: "حق فسخ را برای هر دو طرف یکسان کنید.",
    citation: null,
    confidence: 70,
    ...overrides,
  };
}

function report(findings: DocumentFinding[], confidence = 80): RiskReport {
  return {
    documentId: "doc-1",
    summary: "این سند بررسی شد.",
    findings,
    generatedAt: "2026-10-18T00:00:00.000Z",
    confidence,
  };
}

const CITED = {
  id: "c-1",
  sourceId: "src-1",
  locator: "ماده ۴۶۶",
  quote: "…",
  source: {
    id: "src-1",
    type: "law" as const,
    title: "قانون مدنی",
    authority: "مجلس",
    validFrom: "1307-01-01",
    validTo: null,
    status: "valid" as const,
    jurisdiction: "IR",
    retrievedAt: "2026-10-01T00:00:00.000Z",
  },
};

describe("detectSubject", () => {
  it("returns null when no real template keyword matches", () => {
    expect(detectSubject("یک متن کاملاً نامرتبط دربارهٔ هواشناسی")).toBeNull();
  });

  it("matches a lease document to the real lease template", () => {
    const subject = detectSubject("قرارداد اجاره مسکونی بین موجر و مستاجر");
    expect(subject).not.toBeNull();
    expect(subject?.typeId).toBe("property_rent");
    expect(subject?.evidenceFa.length).toBeGreaterThan(0);
  });
});

describe("detectSections", () => {
  it("returns nothing when there is no extracted text", () => {
    expect(detectSections(null)).toEqual([]);
    expect(detectSections("   ")).toEqual([]);
  });

  it("reads headings from the real text, not from a guess", () => {
    const sections = detectSections("ماده ۱ — موضوع قرارداد\nمتن عادی\n۱. مدت قرارداد:");
    expect(sections.map((s) => s.labelFa)).toEqual([
      "ماده ۱ — موضوع قرارداد",
      "۱. مدت قرارداد",
    ]);
  });
});

describe("buildAttentionList", () => {
  it("orders by real severity and puts located findings first", () => {
    const items = buildAttentionList([
      finding({ id: "low", severity: "low", locator: "بند ۹" }),
      finding({ id: "critical", severity: "critical", locator: "" }),
      finding({ id: "critical-located", severity: "critical", locator: "بند ۲" }),
    ]);
    expect(items.map((i) => i.findingId)).toEqual([
      "critical-located",
      "critical",
      "low",
    ]);
  });

  it("labels an unlocated finding honestly", () => {
    const items = buildAttentionList([finding({ locator: "  " })]);
    expect(items[0]?.locatorFa).toBe("محل نامشخص");
  });
});

describe("reviewLimitations", () => {
  it("states every limitation the data actually has", () => {
    const limits = reviewLimitations({
      report: report([
        finding({ citation: null }),
        finding({ id: "f-2", kind: "incomplete_info", citation: null }),
      ], 40),
      extractedText: null,
    });
    expect(limits).toEqual({
      noSources: true,
      lowConfidence: true,
      noExtractedText: true,
      incompleteCount: 1,
      noReport: false,
    });
  });

  it("does not claim a limitation that is not there", () => {
    const limits = reviewLimitations({
      report: report([finding({ citation: CITED })], 90),
      extractedText: "متن سند",
    });
    expect(limits.noSources).toBe(false);
    expect(limits.lowConfidence).toBe(false);
    expect(limits.noExtractedText).toBe(false);
  });
});

describe("buildFollowUpQuestions", () => {
  it("asks the gap question first, then the governing-law one", () => {
    const questions = buildFollowUpQuestions(
      report([finding({ id: "gap-1", kind: "incomplete_info" })])
    );
    expect(questions.map((q) => q.id)).toEqual([
      "finding:gap-1",
      "sources:governing-law",
    ]);
  });

  it("asks ONLY about a real gap when every finding already cites a source", () => {
    const questions = buildFollowUpQuestions(
      report([
        finding({ id: "gap-1", kind: "incomplete_info", citation: CITED }),
        finding({ id: "f-2", kind: "contractual_risk", citation: CITED }),
      ])
    );
    expect(questions.map((q) => q.id)).toEqual(["finding:gap-1"]);
  });

  it("never re-asks an answered question", () => {
    const data = report([finding({ id: "gap-1", kind: "incomplete_info" })]);
    const first = buildFollowUpQuestions(data);
    const again = buildFollowUpQuestions(data, new Set([first[0]!.id]));
    expect(again.map((q) => q.id)).toEqual(["sources:governing-law"]);
  });

  it("adds the governing-law question only when no finding cites a source", () => {
    const uncited = buildFollowUpQuestions(report([finding({ citation: null })]));
    expect(uncited.map((q) => q.id)).toContain("sources:governing-law");

    const cited = buildFollowUpQuestions(report([finding({ citation: CITED })]));
    expect(cited.map((q) => q.id)).not.toContain("sources:governing-law");
  });
});

describe("composeFollowUpMessage", () => {
  it("is empty when every question was skipped", () => {
    expect(composeFollowUpMessage([])).toBe("");
    expect(composeFollowUpMessage([{ promptFa: "پرسش", answerFa: "   " }])).toBe("");
  });

  it("carries only the user's answers and forbids repeats", () => {
    const message = composeFollowUpMessage([
      { promptFa: "مبلغ ودیعه چیست؟", answerFa: "پنجاه میلیون تومان" },
    ]);
    expect(message).toContain("پنجاه میلیون تومان");
    expect(message).toContain("پرسش‌هایی که پاسخ داده شده‌اند را دوباره تکرار نکن");
  });
});

describe("deriveNextSteps", () => {
  it("offers nothing when the document matches no real service", () => {
    const model = deriveNextSteps({
      documentName: "توضیحی دربارهٔ هوا",
      report: report([]),
      extractedText: "هوا امروز آفتابی است.",
    });
    expect(model.subject).toBeNull();
    expect(model.draft).toBeNull();
    expect(model.lawyerCategory).toBeNull();
    expect(model.calculator).toBeNull();
  });

  it("offers the lease draft and the real lease calculator", () => {
    const model = deriveNextSteps({
      documentName: "اجاره‌نامه",
      report: report([]),
      extractedText: "قرارداد اجاره مسکونی؛ موجر و مستاجر توافق کردند.",
    });
    expect(model.draft?.typeId).toBe("property_rent");
    expect(model.lawyerCategory).toBe("real_estate");

    const card = listCalculatorCards().find((c) => c.slug === "rent-converter");
    if (card?.available) {
      expect(model.calculator?.slug).toBe("rent-converter");
    }
  });

  it("prefers a penalty calculator only when the text really mentions it", () => {
    const model = deriveNextSteps({
      documentName: "قرارداد پیمانکاری",
      report: report([]),
      extractedText: "در صورت تأخیر، وجه التزام به‌صورت روزانه محاسبه می‌شود.",
    });
    const card = listCalculatorCards().find((c) => c.slug === "contract-penalty");
    if (card?.available) {
      expect(model.calculator?.slug).toBe("contract-penalty");
      expect(model.calculator?.reasonFa).toContain("وجه التزام");
    }
  });
});
