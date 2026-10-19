// ============================================================
// LEGALIR — Judicial questionnaire helpers (pure / client-safe)
// ============================================================
// The QUESTION DATA lives in the server store (`lib/judicial/questionnaires`),
// because versions are published and audited. What lives here is only the
// rendering arithmetic the wizard needs on the client: flattening the steps,
// deciding which step is next, and reporting progress.
//
// Keeping these pure means the form renderer and the server-side completeness
// check can share one definition of "visible" without the client importing a
// DB-backed module.
// ============================================================

import type {
  JudicialQuestion,
  JudicialQuestionnaire,
  JudicialQuestionnaireStep,
  JudicialRequest,
  JudicialRequestStep,
} from "@legalir/types";

export interface FlatQuestion {
  step: JudicialQuestionnaireStep;
  question: JudicialQuestion;
}

/** Every question of a schema, step by step, in document order. */
export function flattenQuestions(questionnaire: JudicialQuestionnaire): FlatQuestion[] {
  return questionnaire.steps.flatMap((step) =>
    step.fields.map((question) => ({ step, question }))
  );
}

/**
 * Whether a conditional question renders for the given answers.
 *
 * Mirrors the server rule exactly: a `showWhen` question stays hidden until
 * its controller has a value, so a hidden required question can never block
 * submission and a visible one can never be skipped.
 */
export function isQuestionVisible(
  question: JudicialQuestion,
  answers: Record<string, string>
): boolean {
  const cond = question.showWhen;
  if (!cond) return true;
  const value = answers[cond.field];
  if (value === undefined || value === "") return false;
  return Array.isArray(cond.equals) ? cond.equals.includes(value) : value === cond.equals;
}

/**
 * The Persian label of a stored select answer, read from the schema itself.
 * Falling back to the raw value keeps an answer visible even if the option was
 * removed in a later version — the draft must never silently drop what the
 * user chose.
 */
export function optionLabel(
  questionnaire: JudicialQuestionnaire,
  fieldId: string,
  raw: string
): string {
  const question = flattenQuestions(questionnaire).find(
    (entry) => entry.question.id === fieldId
  )?.question;
  return question?.options?.find((o) => o.value === raw)?.labelFa ?? raw;
}

/** True when every visible question of the step has a non-empty answer. */
export function isStepAnswered(
  step: JudicialQuestionnaireStep,
  answers: Record<string, string>
): boolean {
  return step.fields.every(
    (q) => !q.required || !isQuestionVisible(q, answers) || Boolean(answers[q.id]?.trim())
  );
}

/** The first step that still has an unanswered required question. */
export function firstIncompleteStep(
  questionnaire: JudicialQuestionnaire,
  answers: Record<string, string>
): JudicialQuestionnaireStep | null {
  return questionnaire.steps.find((step) => !isStepAnswered(step, answers)) ?? null;
}

/**
 * Where the wizard should resume. The stored `currentStep` is authoritative,
 * but a request that has moved past collection resumes on the right surface
 * even if the step field lags.
 *
 * Client-safe on purpose: the wizard must land on the same step the server
 * would report, without importing the DB-backed workflow module.
 */
export function resumeStep(request: JudicialRequest): JudicialRequestStep {
  if (request.status === "approved" || request.status === "archived") return "review";
  if (request.status === "draft_ready" || request.status === "ready_to_review") return "review";
  if (request.documentType === null) return "kind";
  if (!request.narrative.trim()) return "narrative";
  return request.currentStep === "kind" ? "narrative" : request.currentStep;
}

/** `{ answered, total }` over the visible required questions of the schema. */
export function answerProgress(
  questionnaire: JudicialQuestionnaire,
  answers: Record<string, string>
): { answered: number; total: number } {
  let answered = 0;
  let total = 0;
  for (const { question } of flattenQuestions(questionnaire)) {
    if (!question.required || !isQuestionVisible(question, answers)) continue;
    total += 1;
    if (answers[question.id]?.trim()) answered += 1;
  }
  return { answered, total };
}
