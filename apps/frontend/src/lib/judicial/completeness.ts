// ============================================================
// LEGALIR — Judicial request completeness (pure)
// ============================================================
// Decides, from the request's OWN questionnaire version and answers, whether
// a draft may be produced. The wizard renders the same result, so the "why is
// the generate button disabled?" explanation is never a second, drifting rule.
//
// Three distinct reasons a draft is refused:
//   • a required, currently-visible question is unanswered (`missing`);
//   • two answers contradict each other (`contradictions`);
//   • the document family itself is still undetermined (`routingUndetermined`)
//     — the user must pick, or answer the clarifying question.
// ============================================================

import type {
  JudicialCompleteness,
  JudicialMissingField,
  JudicialQuestionnaire,
  JudicialQuestionnaireStep,
  JudicialRequest,
} from "@legalir/types";
import { isQuestionVisible } from "./schemas";

/**
 * Answer pairs that cannot both be true. Each message reads as a question,
 * not a validation code, because the user is the only one who can settle it.
 */
interface ContradictionRule {
  when: (answers: Record<string, string>) => boolean;
  messageFa: string;
}

const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    when: (a) => a["isFinancial"] === "false" && Boolean(a["claimAmount"]?.trim()),
    messageFa:
      "گفته‌اید خواسته مالی نیست اما مبلغی وارد کرده‌اید؛ مشخص کنید خواسته مالی است یا نه.",
  },
  {
    when: (a) => a["priorAction"] === "none" && Boolean(a["priorReference"]?.trim()),
    messageFa:
      "اقدام قبلی را «هیچ» انتخاب کرده‌اید اما شمارهٔ پیگیری وارد شده است؛ کدام درست است؟",
  },
  {
    when: (a) => a["hasDeadline"] === "false" && Boolean(a["deadlineNote"]?.trim()),
    messageFa:
      "گفته‌اید مهلتی در پیش نیست اما توضیح مهلت وارد شده است؛ یکی از این دو را اصلاح کنید.",
  },
  {
    when: (a) => a["accusedKnown"] === "false" && Boolean(a["accusedName"]?.trim()),
    messageFa:
      "گفته‌اید طرف شکایت را نمی‌شناسید اما نامی وارد شده است؛ مشخص کنید نام موجود است یا نه.",
  },
  {
    when: (a) => a["hasPriorComplaint"] === "false" && Boolean(a["priorComplaintRef"]?.trim()),
    messageFa:
      "گفته‌اید پیش‌تر اقدامی نکرده‌اید اما شماره یا تاریخ اقدام پیشین وارد شده است.",
  },
  {
    when: (a) => a["hasPriorNotice"] === "false" && Boolean(a["priorNoticeDate"]?.trim()),
    messageFa:
      "گفته‌اید پیش‌تر اخطاری نداده‌اید اما تاریخ اخطار پیشین وارد شده است؛ کدام درست است؟",
  },
  {
    when: (a) => a["hasPriorOrder"] === "false" && Boolean(a["priorOrderRef"]?.trim()),
    messageFa:
      "گفته‌اید تصمیمی در پرونده صادر نشده اما شماره یا تاریخ تصمیم وارد شده است؛ یکی را اصلاح کنید.",
  },
];

/** Build the missing-field list from the visible required questions. */
function collectMissing(
  questionnaire: JudicialQuestionnaire,
  answers: Record<string, string>
): JudicialMissingField[] {
  const out: JudicialMissingField[] = [];
  for (const step of questionnaire.steps) {
    for (const question of step.fields) {
      if (!question.required) continue;
      if (!isQuestionVisible(question, answers)) continue;
      if (answers[question.id]?.trim()) continue;
      out.push({
        fieldId: question.id,
        labelFa: question.labelFa,
        reasonFa: `برای تنظیم این سند، پاسخ «${question.labelFa}» لازم است.`,
      });
    }
  }
  return out;
}

/**
 * Compute completeness for a request. `questionnaire` MUST be the version the
 * request was created against — resolving it against the latest version would
 * demand answers to questions that did not exist when the user started.
 */
export function computeCompleteness(
  request: Pick<JudicialRequest, "documentType" | "answers" | "narrative">,
  questionnaire: JudicialQuestionnaire
): JudicialCompleteness {
  const answers = request.answers ?? {};
  const missing = collectMissing(questionnaire, answers);
  const contradictions = CONTRADICTION_RULES.filter((rule) => rule.when(answers)).map(
    (rule) => rule.messageFa
  );

  const routingUndetermined = request.documentType === null;
  const narrativeMissing = !request.narrative?.trim();

  return {
    complete:
      !routingUndetermined &&
      !narrativeMissing &&
      missing.length === 0 &&
      contradictions.length === 0,
    missing: narrativeMissing
      ? [
          {
            fieldId: "narrative",
            labelFa: "شرح موضوع",
            reasonFa: "پیش از تنظیم سند، توضیح خودتان از موضوع لازم است.",
          },
          ...missing,
        ]
      : missing,
    contradictions,
    routingUndetermined,
  };
}

/** The questionnaire step that answers the first missing field, if any. */
export function stepForCompleteness(
  questionnaire: JudicialQuestionnaire,
  completeness: JudicialCompleteness
): JudicialQuestionnaireStep | null {
  if (completeness.routingUndetermined) return null;
  const firstMissingId = completeness.missing[0]?.fieldId;
  if (!firstMissingId) return null;
  for (const step of questionnaire.steps) {
    if (step.fields.some((f) => f.id === firstMissingId)) return step;
  }
  return null;
}
