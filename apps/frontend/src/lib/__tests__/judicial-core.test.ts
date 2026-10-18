// ============================================================
// LEGALIR — Judicial drafting core tests
// ============================================================
// These pin the rules that would otherwise ship a WRONG document rather than
// merely a buggy screen:
//
//   • a draft is never offered while required, visible answers are missing;
//   • contradictory answers block generation instead of being silently picked;
//   • a derived path is never "high" confidence and never overrides the user;
//   • an ambiguous narrative asks instead of guessing;
//   • a hidden conditional question neither blocks nor is skipped;
//   • the wizard resumes where the server's state says it should.
// ============================================================

import { describe, expect, it } from "vitest";
import type {
  JudicialQuestionnaire,
  JudicialRequest,
  JudicialRequestStatus,
  JudicialRequestStep,
} from "@legalir/types";
import { computeCompleteness } from "../judicial/completeness";
import { deriveJudicialRouting } from "../judicial/routing";
import { isQuestionVisible, resumeStep } from "../judicial/schemas";
import { judicialEntryType } from "../judicial/entry";

const questionnaire: JudicialQuestionnaire = {
  id: "petition:v3",
  documentType: "petition",
  version: 3,
  status: "published",
  titleFa: "پرسش‌نامهٔ دادخواست",
  descriptionFa: "پرسش‌نامهٔ نمونه برای آزمون کامل‌بودگی.",
  disclaimerFa: "این پیش‌نویس بازبینی شما را لازم دارد.",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  publishedBy: null,
  steps: [
    {
      id: "parties",
      titleFa: "طرفین",
      fields: [
        { id: "claimantName", labelFa: "نام خواهان", type: "text", required: true },
        { id: "respondentName", labelFa: "نام خوانده", type: "text", required: true },
      ],
    },
    {
      id: "claim",
      titleFa: "خواسته",
      fields: [
        {
          id: "isFinancial",
          labelFa: "خواسته مالی است؟",
          type: "boolean",
          required: true,
        },
        {
          id: "claimAmount",
          labelFa: "مبلغ خواسته",
          type: "currency",
          required: false,
          showWhen: { field: "isFinancial", equals: "true" },
        },
      ],
    },
  ],
};

function makeRequest(over: Partial<JudicialRequest> = {}): JudicialRequest {
  return {
    id: "req_1",
    userId: "user_1",
    serviceId: "judicial_petition",
    serviceVersion: 1,
    documentType: "petition",
    status: "collecting_documents" as JudicialRequestStatus,
    currentStep: "narrative" as JudicialRequestStep,
    titleFa: "دادخواست",
    narrative: "مستأجر دو ماه است اجاره را پرداخت نکرده و قرارداد اجاره دارم.",
    answers: {
      claimantName: "علی",
      respondentName: "رضا",
      isFinancial: "true",
      claimAmount: "12000000",
    },
    questionnaireId: questionnaire.id,
    questionnaireVersion: questionnaire.version,
    startMode: "ai_draft",
    caseId: null,
    routing: null,
    readyDocument: null,
    approvedDraftId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...over,
  } as JudicialRequest;
}

describe("computeCompleteness", () => {
  it("accepts a fully answered request", () => {
    const result = computeCompleteness(makeRequest(), questionnaire);
    expect(result.complete).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.contradictions).toHaveLength(0);
    expect(result.routingUndetermined).toBe(false);
  });

  it("does not demand a hidden conditional answer", () => {
    const result = computeCompleteness(
      makeRequest({
        answers: { claimantName: "علی", respondentName: "رضا", isFinancial: "false" },
      }),
      questionnaire
    );
    expect(result.missing.map((m) => m.fieldId)).not.toContain("claimAmount");
    expect(result.complete).toBe(true);
  });

  it("lists every visible required answer that is still blank", () => {
    const result = computeCompleteness(makeRequest({ answers: {} }), questionnaire);
    expect(result.complete).toBe(false);
    expect(result.missing.map((m) => m.fieldId)).toEqual([
      "claimantName",
      "respondentName",
      "isFinancial",
    ]);
  });

  it("requires the narrative before anything else is counted", () => {
    const result = computeCompleteness(makeRequest({ narrative: "   " }), questionnaire);
    expect(result.complete).toBe(false);
    expect(result.missing[0]?.fieldId).toBe("narrative");
  });

  it("treats an undetermined family as incomplete even when every field is answered", () => {
    const result = computeCompleteness(makeRequest({ documentType: null }), questionnaire);
    expect(result.routingUndetermined).toBe(true);
    expect(result.complete).toBe(false);
  });

  it("blocks on contradictory answers instead of picking one", () => {
    const result = computeCompleteness(
      makeRequest({
        answers: {
          claimantName: "علی",
          respondentName: "رضا",
          isFinancial: "false",
          claimAmount: "12000000",
        },
      }),
      questionnaire
    );
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0]).toContain("خواسته مالی");
    expect(result.complete).toBe(false);
  });
});

describe("deriveJudicialRouting", () => {
  it("never contradicts an explicit user choice", () => {
    const routing = deriveJudicialRouting("می‌خواهم از همسایه شکایت کنم", "brief");
    expect(routing.suggested).toBe("brief");
    expect(routing.basis).toBe("user_choice");
    expect(routing.needsClarification).toBe(false);
  });

  it("asks rather than guesses when the narrative carries no signal", () => {
    const routing = deriveJudicialRouting("یک مشکل دارم و نمی‌دانم چه کار کنم.", null);
    expect(routing.suggested).toBe("undetermined");
    expect(routing.needsClarification).toBe(true);
    expect(routing.clarificationFa).toBeTruthy();
    expect(routing.confidence).toBe("low");
  });

  it("never reports high confidence for a derived suggestion", () => {
    const routing = deriveJudicialRouting(
      "می‌خواهم شکواییه کلاهبرداری در دادسرا ثبت کنم",
      null
    );
    expect(routing.basis).toBe("derived");
    expect(routing.confidence).not.toBe("high");
  });

  it("flags the civil/criminal boundary when both sides are mentioned", () => {
    const routing = deriveJudicialRouting(
      "چک برگشتی دارم و می‌خواهم شکایت کیفری هم بکنم",
      null
    );
    expect(routing.needsClarification).toBe(true);
  });
});

describe("isQuestionVisible", () => {
  const conditional = {
    id: "claimAmount",
    labelFa: "مبلغ",
    type: "currency" as const,
    required: true,
    showWhen: { field: "isFinancial", equals: ["true"] },
  };

  it("stays hidden until its controller has one of the accepted values", () => {
    expect(isQuestionVisible(conditional, {})).toBe(false);
    expect(isQuestionVisible(conditional, { isFinancial: "false" })).toBe(false);
    expect(isQuestionVisible(conditional, { isFinancial: "true" })).toBe(true);
  });
});

describe("resumeStep", () => {
  const base = makeRequest();

  it("sends a request that already produced a draft to review", () => {
    for (const status of [
      "draft_ready",
      "ready_to_review",
      "approved",
      "archived",
    ] as const) {
      expect(resumeStep({ ...base, status })).toBe("review");
    }
  });

  it("starts an undetermined request at the family step", () => {
    expect(resumeStep({ ...base, documentType: null })).toBe("kind");
  });

  it("asks for the narrative before the questionnaire", () => {
    expect(resumeStep({ ...base, narrative: "" })).toBe("narrative");
  });

  it("does not leave the user on the family step once a family is stored", () => {
    expect(resumeStep({ ...base, currentStep: "kind" })).toBe("narrative");
  });

  it("otherwise honours the stored step", () => {
    expect(resumeStep({ ...base, currentStep: "documents" })).toBe("documents");
  });
});

describe("judicialEntryType", () => {
  it("maps the four drafting families to a real wizard entry", () => {
    expect(judicialEntryType("judicial_petition")).toBe("petition");
    expect(judicialEntryType("judicial_complaint")).toBe("complaint");
    expect(judicialEntryType("judicial_statement")).toBe("statement");
    expect(judicialEntryType("judicial_brief")).toBe("brief");
  });

  it("refuses an entry for services that need an external integration", () => {
    expect(judicialEntryType("judicial_criminal_record")).toBeNull();
    expect(judicialEntryType("judicial_credit_check")).toBeNull();
  });
});
