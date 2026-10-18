// ============================================================
// LEGALIR — Judicial request analysis (server-only, deterministic)
// ============================================================
// Step 4 of the wizard frames the request BEFORE any prose is written. It is
// assembled from four separately-labelled sources, never blended:
//
//   1. what the user stated           → statementsFa / subjectFa / demandFa
//   2. what came from their documents → evidenceFa (names only — extraction is
//                                       not authenticated truth)
//   3. what the routing derived       → likelyType + confidence + reasonFa
//   4. what is still unconfirmed      → mustVerifyFa / ambiguitiesFa / missingFa
//
// There is no model call: a framing that would need one (e.g. naming a legal
// theory) is instead listed under `mustVerifyFa` for the user/lawyer.
// ============================================================

import type {
  JudicialAnalysis,
  JudicialAnalysisParty,
  JudicialAttachment,
  JudicialCompleteness,
  JudicialDocumentType,
  JudicialDraftReference,
  JudicialQuestionnaire,
  JudicialRequest,
} from "@legalir/types";
import { JUDICIAL_DOCUMENT_TYPE_FA } from "@legalir/types";
import { optionLabel } from "./schemas";

function v(answers: Record<string, string>, id: string): string {
  return answers[id]?.trim() ?? "";
}

/**
 * The parties each family actually asks for. The اظهارنامه and لایحه schemas
 * never collect the submitter's own name, so those surfaces report the ROLE
 * instead of inventing a party the user was never asked about.
 */
function partiesFrom(
  request: JudicialRequest,
  questionnaire: JudicialQuestionnaire
): JudicialAnalysisParty[] {
  const a = request.answers;
  const out: JudicialAnalysisParty[] = [];
  const label = (id: string) => {
    const raw = v(a, id);
    return raw ? optionLabel(questionnaire, id, raw) : "";
  };

  switch (request.documentType) {
    case "complaint": {
      if (v(a, "complainantName")) {
        out.push({ roleFa: "شاکی (شما)", nameFa: v(a, "complainantName"), source: "answer" });
      }
      if (v(a, "accusedName")) {
        out.push({ roleFa: "طرف شکایت", nameFa: v(a, "accusedName"), source: "answer" });
      } else if (v(a, "accusedKnown") === "false") {
        out.push({ roleFa: "طرف شکایت", nameFa: "نامشخص (به گفتهٔ شما)", source: "answer" });
      }
      return out;
    }
    case "statement": {
      if (v(a, "addresseeName")) {
        out.push({
          roleFa: "مخاطب اظهارنامه",
          nameFa: v(a, "addresseeName"),
          source: "answer",
        });
      }
      return out;
    }
    case "brief": {
      if (label("submitterRole")) {
        out.push({ roleFa: "نقش شما در پرونده", nameFa: label("submitterRole"), source: "answer" });
      }
      if (v(a, "courtName")) {
        out.push({ roleFa: "دادگاه (به گفتهٔ شما)", nameFa: v(a, "courtName"), source: "answer" });
      }
      return out;
    }
    default: {
      if (v(a, "claimantName")) {
        out.push({ roleFa: "خواهان (شما)", nameFa: v(a, "claimantName"), source: "answer" });
      }
      if (v(a, "respondentName")) {
        out.push({ roleFa: "خوانده", nameFa: v(a, "respondentName"), source: "answer" });
      }
      return out;
    }
  }
}

const MUST_VERIFY_COMMON = [
  "صلاحیت و مرجع صالح رسیدگی: باید پیش از اقدام از مرجع رسمی یا وکیل استعلام شود.",
  "مهلت‌های قانونی (در صورت وجود): از گفتهٔ شما آمده و تأیید نشده است.",
  "نتیجهٔ احتمالی رسیدگی: لیگالیر پیش‌بینی نمی‌کند.",
];

export interface AnalysisInput {
  request: JudicialRequest;
  questionnaire: JudicialQuestionnaire;
  attachments: JudicialAttachment[];
  completeness: JudicialCompleteness;
  references: JudicialDraftReference[];
}

/** Subject / demand field ids per family — the schema itself is the source. */
const SUBJECT_FIELD: Record<JudicialDocumentType, string | null> = {
  statement: "claimKind",
  brief: "caseSubject",
  petition: "claimBasis",
  complaint: "offenseTitle",
};

const DEMAND_FIELD: Record<JudicialDocumentType, string | null> = {
  statement: "demandText",
  brief: "briefPurpose",
  petition: "claimKind",
  complaint: null,
};

export function buildAnalysis(input: AnalysisInput): JudicialAnalysis {
  const { request, questionnaire, attachments, completeness, references } = input;
  const a = request.answers;
  const family: JudicialDocumentType = request.documentType ?? "petition";
  const isComplaint = family === "complaint";
  const label = (id: string) => {
    const raw = v(a, id);
    return raw ? optionLabel(questionnaire, id, raw) : "";
  };

  const statementsFa: string[] = [];
  if (request.narrative.trim()) {
    statementsFa.push(`روایت شما (به نقل از خودتان): ${request.narrative.trim()}`);
  }
  const facts = v(a, "facts");
  if (facts) statementsFa.push(`شرح واقعه به گفتهٔ شما: ${facts}`);
  const keyFacts = v(a, "keyFacts");
  if (keyFacts) statementsFa.push(`نکات اصلی به گفتهٔ شما: ${keyFacts}`);
  if (family === "statement" && v(a, "additionalNotes")) {
    statementsFa.push(`توضیح تکمیلی شما: ${v(a, "additionalNotes")}`);
  }

  const chronologyFa = [
    v(a, "incidentDate"),
    v(a, "dueDate"),
    v(a, "priorNoticeDate"),
    v(a, "facts"),
    v(a, "keyFacts"),
  ]
    .filter(Boolean)
    .flatMap((s) => s.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

  const evidenceFa = attachments.map(
    (att) =>
      `${att.name} (${att.role === "evidence" ? "دلیل و مستند" : "مدرک پیوست"}) — متن استخراج‌شدهٔ آن تأیید اصالت نیست.`
  );
  if (v(a, "evidenceList")) evidenceFa.push(`از زبان شما: ${v(a, "evidenceList")}`);

  const ambiguitiesFa = [
    ...completeness.contradictions,
    ...(request.narrative.trim().length > 0 && request.narrative.trim().length < 40
      ? ["شرح شما کوتاه است؛ جزئیات بیشتر معمولاً کیفیت پیش‌نویس را بالا می‌برد."]
      : []),
    ...(request.routing?.needsClarification && request.routing.clarificationFa
      ? [request.routing.clarificationFa]
      : []),
  ];

  const missingFa = completeness.missing.map((m) => `${m.labelFa} — ${m.reasonFa}`);

  const mustVerifyFa = [...MUST_VERIFY_COMMON];
  if (isComplaint) {
    mustVerifyFa.push(
      "عنوان مجرمانه: برداشت شما از رفتار طرف مقابل، تعیین عنوان مجرمانه نیست."
    );
  }
  if (family === "statement") {
    mustVerifyFa.push(
      "اثر ابلاغ اظهارنامه و مهلت‌های پس از آن: لیگالیر ابلاغ انجام نمی‌دهد و مهلتی را تعیین نمی‌کند."
    );
  }
  if (family === "brief") {
    mustVerifyFa.push(
      "شمارهٔ پرونده و مرجع: این مقادیر از گفتهٔ شما درج می‌شوند و استعلام نمی‌شوند."
    );
  }
  const amount = v(a, "claimAmount") || v(a, "claimValue");
  if (amount) {
    mustVerifyFa.push(
      `مبلغ مورد مطالبه (${amount} ریال): مبنای محاسبه و مستندات آن را خودتان تأیید کنید.`
    );
  }

  const subjectId = SUBJECT_FIELD[family];
  const demandId = DEMAND_FIELD[family];
  const likelyType = request.documentType ?? "undetermined";
  return {
    likelyType,
    confidence: request.routing?.confidence ?? (request.documentType ? "high" : "low"),
    reasonFa:
      request.routing?.reasonFa ??
      (request.documentType
        ? `نوع سند را خودتان «${JUDICIAL_DOCUMENT_TYPE_FA[request.documentType]}» انتخاب کرده‌اید.`
        : "نوع سند هنوز مشخص نشده است؛ ابتدا باید انتخاب شود."),
    statementsFa,
    parties: partiesFrom(request, questionnaire),
    subjectFa: subjectId ? label(subjectId) || null : null,
    demandFa: demandId ? label(demandId) || null : null,
    chronologyFa,
    evidenceFa,
    missingFa,
    ambiguitiesFa,
    mustVerifyFa,
    sources: references,
    generatedAt: new Date().toISOString(),
  };
}
