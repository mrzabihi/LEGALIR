// ============================================================
// LEGALIR — Follow-up questions: honesty, ordering & persistence
// ============================================================
// Pins the guarantees §8 depends on:
//   1. Only genuinely-missing information is asked — a collected fact is
//      never asked twice, and another domain's questions never leak in.
//   2. A turn asks a short, capped set, domain-specific before generic.
//   3. Every required question carries a reason for why it is needed.
//   4. A skipped answer is recorded honestly as «اطلاع ندارم», never as an
//      invented fact, and a malformed answer cannot fabricate one.
//   5. Applying answers retires the questions and keeps the text projection
//      in step with the structured one so prompt and UI never disagree.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import type { CaseCategory, FollowUpAnswer } from "@legalir/types";

// The workflow module reads/writes through `@/lib/db`; this spec is about the
// pure question/answer logic, so every call is a no-op against an empty store.
vi.mock("@/lib/db", () => ({
  readTable: () => [],
  writeTable: (_name: string, _data: unknown[]) => undefined,
}));

import {
  MAX_QUESTIONS_PER_TURN,
  REQUIRED_INFO,
  UNKNOWN_ANSWER_FA,
  generateStructuredQuestions,
  structuredQuestionsToText,
} from "../ai/workflow/questions";
import { applyFollowUpAnswers, createInitialWorkflowState } from "../ai/workflow/engine";

// ============================================================
// The table itself
// ============================================================

describe("REQUIRED_INFO", () => {
  it("gives every question a unique, stable fact id", () => {
    const ids = REQUIRED_INFO.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("parties");
    expect(ids).toContain("timeline");
  });

  it("explains why every required question is needed", () => {
    const required = REQUIRED_INFO.filter((d) => d.required);
    expect(required.length).toBeGreaterThan(0);
    for (const def of required) {
      expect(def.whyFa, `${def.id} must carry a reason`).toBeTruthy();
    }
  });

  it("keeps quick options as real label/value pairs", () => {
    const contractType = REQUIRED_INFO.find((d) => d.id === "contract_type")!;
    expect(contractType.quickOptionsFa.length).toBeGreaterThan(1);
    for (const option of contractType.quickOptionsFa) {
      expect(option.labelFa).toBeTruthy();
      expect(option.value).toBe(option.labelFa);
    }
  });
});

// ============================================================
// generateStructuredQuestions — ask only what is genuinely missing
// ============================================================

describe("generateStructuredQuestions", () => {
  it("asks the universal questions when the domain is unknown", () => {
    const questions = generateStructuredQuestions(null, {});
    expect(questions.map((q) => q.id)).toEqual(["parties", "timeline", "documents", "location"]);
  });

  it("puts domain-specific questions before the generic ones", () => {
    const ids = generateStructuredQuestions("contract", {}).map((q) => q.id);
    const amountAt = ids.indexOf("amount");
    const contractTypeAt = ids.indexOf("contract_type");
    const partiesAt = ids.indexOf("parties");
    expect(amountAt).toBe(0);
    expect(contractTypeAt).toBe(1);
    expect(partiesAt).toBeGreaterThan(contractTypeAt);
  });

  it("caps a single turn at MAX_QUESTIONS_PER_TURN", () => {
    const questions = generateStructuredQuestions("contract", {});
    expect(questions).toHaveLength(MAX_QUESTIONS_PER_TURN);
    expect(MAX_QUESTIONS_PER_TURN).toBe(4);
  });

  it("never asks a fact it already collected", () => {
    const ids = generateStructuredQuestions(null, { parties: "الف و ب" }).map((q) => q.id);
    expect(ids).not.toContain("parties");
    expect(ids).toEqual(["timeline", "documents", "location"]);
  });

  it("asks nothing when every fact is already known", () => {
    const known = Object.fromEntries(REQUIRED_INFO.map((d) => [d.id, "معلوم"]));
    expect(generateStructuredQuestions("contract", known)).toEqual([]);
  });

  it("does not leak another domain's questions", () => {
    const family = generateStructuredQuestions("family", {}).map((q) => q.id);
    const business = generateStructuredQuestions("business", {}).map((q) => q.id);
    expect(family).toContain("children");
    expect(family).not.toContain("company_type");
    expect(business).toContain("company_type");
    expect(business).not.toContain("children");
  });

  it("strips the reason from optional questions", () => {
    const documents = generateStructuredQuestions(null, {})
      .concat(generateStructuredQuestions("contract", {}))
      .find((q) => q.id === "documents")!;
    expect(documents.required).toBe(false);
    expect(documents.whyFa).toBeNull();
  });
});

// ============================================================
// structuredQuestionsToText — one projection, no invention
// ============================================================

describe("structuredQuestionsToText", () => {
  it("mirrors the question text exactly", () => {
    const questions = generateStructuredQuestions("family", {});
    expect(structuredQuestionsToText(questions)).toEqual(questions.map((q) => q.questionFa));
  });

  it("returns an empty list for an empty input", () => {
    expect(structuredQuestionsToText([])).toEqual([]);
  });
});

// ============================================================
// applyFollowUpAnswers — record, retire, stay honest
// ============================================================

function stateWithContractTurn() {
  const state = createInitialWorkflowState();
  state.domain = "contract";
  state.pendingFollowUps = generateStructuredQuestions("contract", {});
  state.pendingQuestions = structuredQuestionsToText(state.pendingFollowUps);
  return state;
}

describe("applyFollowUpAnswers", () => {
  it("records answers as facts and retires the questions", () => {
    const state = stateWithContractTurn();
    applyFollowUpAnswers(state, [
      { id: "amount", value: "۵۰۰ میلیون تومان" },
      { id: "parties", value: "کارفرما و پیمانکار" },
    ]);

    expect(state.collectedFacts['amount']).toBe("۵۰۰ میلیون تومان");
    expect(state.collectedFacts['parties']).toBe("کارفرما و پیمانکار");
    expect(state.answeredQuestions).toEqual(["amount", "parties"]);
    expect(state.pendingFollowUps!.map((q) => q.id)).not.toContain("amount");
    expect(state.pendingFollowUps!.map((q) => q.id)).not.toContain("parties");
    // The text projection follows the structured one.
    expect(state.pendingQuestions).toEqual(structuredQuestionsToText(state.pendingFollowUps!));
  });

  it("records an explicitly skipped answer as «اطلاع ندارم»", () => {
    const state = stateWithContractTurn();
    applyFollowUpAnswers(state, [{ id: "amount", value: "" }]);
    expect(state.collectedFacts['amount']).toBe(UNKNOWN_ANSWER_FA);
    expect(state.answeredQuestions).toContain("amount");
  });

  it("treats a non-string value as unknown rather than inventing one", () => {
    const state = stateWithContractTurn();
    applyFollowUpAnswers(state, [
      { id: "timeline", value: 42 } as unknown as FollowUpAnswer,
    ]);
    expect(state.collectedFacts['timeline']).toBe(UNKNOWN_ANSWER_FA);
    expect(state.collectedFacts['timeline']).not.toBe("42");
  });

  it("ignores an answer with no id", () => {
    const state = stateWithContractTurn();
    applyFollowUpAnswers(state, [{ id: "   ", value: "چیزی" }]);
    expect(Object.keys(state.collectedFacts)).toEqual([]);
    expect(state.answeredQuestions).toEqual([]);
  });

  it("never overwrites a fact the user already provided", () => {
    const state = stateWithContractTurn();
    state.collectedFacts['parties'] = "متن اصلی";
    applyFollowUpAnswers(state, [{ id: "parties", value: "متن تازه" }]);
    expect(state.collectedFacts['parties']).toBe("متن اصلی");
  });

  it("is a strict no-op for an empty answer list", () => {
    const state = stateWithContractTurn();
    const before = JSON.stringify(state);
    applyFollowUpAnswers(state, []);
    expect(JSON.stringify(state)).toBe(before);
  });
});

// ============================================================
// Types — the UI relies on these fields being present
// ============================================================

describe("question shape handed to the client", () => {
  it("carries id, text, required and options for every question", () => {
    const [marriage, children] = generateStructuredQuestions("family", {});
    expect(marriage!.id).toBe("marriage_date");
    expect(marriage!.quickOptionsFa.map((o) => o.labelFa)).toEqual(["دائم", "موقت"]);
    expect(children!.id).toBe("children");
    expect(children!.questionFa).toContain("فرزند");
    expect(children!.required).toBe(false);
    expect(children!.quickOptionsFa.map((o) => o.labelFa)).toEqual(["بله", "خیر"]);
  });

  it("keeps domain matching total (no question is orphaned)", () => {
    const domains: CaseCategory[] = [
      "contract",
      "employment",
      "property",
      "family",
      "criminal",
      "financial",
      "business",
      "tax",
    ];
    for (const domain of domains) {
      const questions = generateStructuredQuestions(domain, {});
      expect(questions.length, domain).toBeGreaterThan(0);
      expect(questions.length, domain).toBeLessThanOrEqual(MAX_QUESTIONS_PER_TURN);
    }
  });
});
