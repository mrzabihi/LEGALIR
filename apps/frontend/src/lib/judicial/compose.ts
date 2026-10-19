// ============================================================
// LEGALIR — Judicial draft composition (server-only)
// ============================================================
// Two producers, deliberately kept apart:
//
//   structured_composer — deterministic. It arranges ONLY the user's own
//     confirmed facts into the document skeleton. Every unknown stays a
//     visible «[تکمیل شود: …]» marker. It never invents a party, an amount,
//     an article, a charge title, a court or a deadline.
//
//   model_refined — the SAME skeleton reworded by a CONFIGURED provider.
//     Only reachable when a real API key exists; the mock is never presented
//     as a drafting model. The model receives the composed facts and the
//     retrieved sources and is told (a) not to add facts, (b) not to cite
//     anything that is not in the supplied source list.
//
// A draft is a draft either way: no path here produces a filed document.
// ============================================================

import { createHash } from "node:crypto";
import type {
  JudicialAttachment,
  JudicialDocumentType,
  JudicialDraftInputSnapshot,
  JudicialDraftReference,
  JudicialQuestionnaire,
  JudicialRequest,
} from "@legalir/types";
import type { AiProvider, AiUsage } from "@/lib/ai/provider";
import { flattenQuestions, isQuestionVisible, optionLabel } from "./schemas";

/** The marker a reader (and the UI) can search for incomplete spots. */
export const INCOMPLETE_MARKER = "تکمیل شود";

function missing(label: string): string {
  return `[${INCOMPLETE_MARKER}: ${label}]`;
}

function value(answers: Record<string, string>, id: string): string {
  return answers[id]?.trim() ?? "";
}

function orMissing(answers: Record<string, string>, id: string, label: string): string {
  const v = value(answers, id);
  return v || missing(label);
}

/** A bulleted block, or a single "none stated" line. */
function bullets(lines: string[], emptyFa: string): string {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return emptyFa;
  return clean.map((l) => `- ${l}`).join("\n");
}

/** Chronology from the free-text field, preserving the user's own wording. */
function chronologyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function evidenceLines(
  answers: Record<string, string>,
  attachments: JudicialAttachment[],
  attachmentLabel: (role: JudicialAttachment["role"]) => string
): string[] {
  const lines: string[] = [];
  const declared = value(answers, "evidenceTypes");
  if (declared) lines.push(declared);
  for (const a of attachments) {
    lines.push(`${a.name} (${attachmentLabel(a.role)})`);
  }
  const freeText = value(answers, "evidenceList");
  if (freeText) lines.push(freeText);
  return lines;
}

export interface ComposeInput {
  request: JudicialRequest;
  questionnaire: JudicialQuestionnaire;
  attachments: JudicialAttachment[];
  attachmentLabel: (role: JudicialAttachment["role"]) => string;
  references: JudicialDraftReference[];
}

/**
 * Exactly the inputs that produced a version. Stored on the draft so the
 * same inputs can be recognised again (no duplicate charge) and the version
 * can be explained after the request has moved on.
 */
export function buildInputSnapshot(
  request: JudicialRequest,
  questionnaire: JudicialQuestionnaire,
  attachments: JudicialAttachment[]
): JudicialDraftInputSnapshot {
  return {
    narrative: request.narrative,
    answers: { ...request.answers },
    attachmentIds: attachments.map((a) => a.documentId),
    attachmentNames: attachments.map((a) => a.name),
    questionnaireVersion: questionnaire.version,
    serviceId: request.serviceId,
    documentType: request.documentType ?? "petition",
    startMode: request.startMode,
    readyDocumentName: request.readyDocument?.name ?? null,
  };
}

export function hashInputSnapshot(snapshot: JudicialDraftInputSnapshot): string {
  const canonical = JSON.stringify({
    narrative: snapshot.narrative.trim(),
    answers: Object.keys(snapshot.answers)
      .sort()
      .map((k) => [k, snapshot.answers[k]?.trim() ?? ""]),
    attachmentIds: [...snapshot.attachmentIds].sort(),
    questionnaireVersion: snapshot.questionnaireVersion,
    documentType: snapshot.documentType,
    serviceId: snapshot.serviceId,
    readyDocumentName: snapshot.readyDocumentName,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ------------------------------------------------------------
// The deterministic composer
// ------------------------------------------------------------

const HEADER_FA = "بسمه تعالی";

function referencesBlock(references: JudicialDraftReference[]): string {
  if (references.length === 0) {
    // Explicitly state the absence — never leave a blank where a citation
    // could be imagined.
    return "منبع قانونی مستندی برای ارجاع خودکار در این پیش‌نویس یافت نشد. هیچ ماده یا مستندی از خود اضافه نشده است.";
  }
  return references
    .map((r) => `- ${r.title}${r.locator ? ` — ${r.locator}` : ""} (${r.tierFa})`)
    .join("\n");
}

function petitionText(input: ComposeInput): { text: string; warnings: string[] } {
  const { request, attachments, attachmentLabel, references } = input;
  const a = request.answers;
  const warnings: string[] = [];

  const claimAmount = value(a, "claimAmount");
  const isFinancial = value(a, "isFinancial") === "true";

  const parts: string[] = [];
  parts.push(HEADER_FA);
  parts.push("");
  parts.push("دادخواست");
  parts.push("");
  parts.push(`خواهان: ${orMissing(a, "claimantName", "نام خواهان")}`);
  parts.push(`خوانده: ${orMissing(a, "respondentName", "نام خوانده")}`);
  parts.push("");
  parts.push("خواسته:");
  parts.push(orMissing(a, "claimSubject", "موضوع خواسته"));
  if (isFinancial) {
    parts.push(
      claimAmount
        ? `بهای خواسته: ${claimAmount} ریال`
        : `بهای خواسته: ${missing("مبلغ خواسته به ریال")}`
    );
    const basis = value(a, "amountBasis");
    if (basis) parts.push(`مبنای محاسبهٔ مبلغ: ${basis}`);
  } else if (!value(a, "isFinancial")) {
    parts.push(`نوع خواسته (مالی / غیرمالی): ${missing("مالی بودن خواسته")}`);
  }
  parts.push("");
  parts.push("شرح وقایع:");
  parts.push(
    bullets(
      [
        request.narrative,
        ...chronologyLines(value(a, "chronology")),
        value(a, "startDate") ? `زمان شروع: ${value(a, "startDate")}` : "",
      ],
      missing("شرح وقایع")
    )
  );
  parts.push("");
  parts.push("دلایل و مستندات:");
  parts.push(
    bullets(
      evidenceLines(a, attachments, attachmentLabel),
      "در زمان تنظیم این پیش‌نویس، مستندی پیوست نشده است."
    )
  );
  parts.push("");
  parts.push("اقدام‌های پیشین:");
  parts.push(
    bullets(
      [
        value(a, "priorAction") === "none"
          ? "اقدام پیشینی انجام نشده است (به گفتهٔ خواهان)."
          : value(a, "priorAction")
            ? `اقدام پیشین: ${value(a, "priorAction")}`
            : "",
        value(a, "priorReference"),
      ],
      missing("اقدام‌های پیشین")
    )
  );
  if (value(a, "hasDeadline") === "true") {
    parts.push("");
    parts.push(
      `مهلت (به گفتهٔ خواهان): ${value(a, "deadlineNote") || missing("توضیح مهلت")}`
    );
    warnings.push(
      "مهلتی که ذکر شده از گفتهٔ خود شماست؛ لیگالیر مهلت قانونی را تعیین یا تأیید نمی‌کند."
    );
  }
  parts.push("");
  parts.push("تاریخ: " + missing("تاریخ تنظیم"));
  parts.push("");
  parts.push("منابع حقوقی بررسی‌شده (از پایگاه لیگالیر):");
  parts.push(referencesBlock(references));
  if (references.length > 0) {
    warnings.push(
      "منابع فهرست‌شده به‌صورت خودکار بازیابی شده‌اند؛ انطباق آن‌ها با موضوع را خودتان یا وکیل بررسی کنید."
    );
  }

  parts.push("");
  parts.push("امضا: " + missing("نام و امضای خواهان"));

  return { text: parts.join("\n"), warnings };
}

function complaintText(input: ComposeInput): { text: string; warnings: string[] } {
  const { request, attachments, attachmentLabel, references } = input;
  const a = request.answers;
  const warnings: string[] = [];
  const accusedKnown = value(a, "accusedKnown") !== "false";

  const parts: string[] = [];
  parts.push(HEADER_FA);
  parts.push("");
  parts.push("شکواییه");
  parts.push("");
  parts.push(`شاکی: ${orMissing(a, "complainantName", "نام شاکی")}`);
  parts.push(
    `طرف شکایت: ${
      accusedKnown ? orMissing(a, "accusedName", "نام طرف شکایت") : "نامشخص (به گفتهٔ شاکی)"
    }`
  );
  parts.push("");
  parts.push("موضوع شکایت (به بیان شاکی):");
  parts.push(orMissing(a, "offenseTitle", "موضوع شکایت"));
  parts.push("");
  parts.push("شرح واقعه:");
  parts.push(
    bullets(
      [
        request.narrative,
        ...chronologyLines(value(a, "facts")),
        value(a, "incidentDate") ? `زمان واقعه: ${value(a, "incidentDate")}` : "",
        value(a, "incidentPlace") ? `محل واقعه: ${value(a, "incidentPlace")}` : "",
      ],
      missing("شرح واقعه")
    )
  );
  parts.push("");
  parts.push("زیان و نتیجه برای شاکی:");
  parts.push(value(a, "harm") ? value(a, "harm") : missing("زیان یا نتیجه"));
  parts.push("");
  parts.push("دلایل و مستندات:");
  parts.push(
    bullets(
      evidenceLines(a, attachments, attachmentLabel),
      "در زمان تنظیم این پیش‌نویس، مستندی پیوست نشده است."
    )
  );
  if (value(a, "witnessNames")) {
    parts.push("");
    parts.push(`شهود (به گفتهٔ شاکی): ${value(a, "witnessNames")}`);
  }
  parts.push("");
  parts.push("اقدام‌های پیشین:");
  parts.push(
    bullets(
      [
        value(a, "hasPriorComplaint") === "true" || value(a, "priorAction") !== "none"
          ? `اقدام پیشین ثبت‌شده به گفتهٔ شاکی: ${
              value(a, "priorComplaintRef") || value(a, "priorReference") || "بدون شماره"
            }`
          : "اقدام کیفری پیشینی عنوان نشده است.",
      ],
      "اقدام پیشینی عنوان نشده است."
    )
  );
  if (value(a, "hasDeadline") === "true") {
    parts.push("");
    parts.push(
      `مهلت (به گفتهٔ شاکی): ${value(a, "deadlineNote") || missing("توضیح مهلت")}`
    );
    warnings.push(
      "مهلتی که ذکر شده از گفتهٔ خود شماست؛ لیگالیر مهلت قانونی را تعیین یا تأیید نمی‌کند."
    );
  }
  parts.push("");
  parts.push("منابع حقوقی بررسی‌شده (از پایگاه لیگالیر):");
  parts.push(referencesBlock(references));
  if (references.length > 0) {
    warnings.push(
      "منابع فهرست‌شده به‌صورت خودکار بازیابی شده‌اند؛ انطباق آن‌ها با موضوع را خودتان یا وکیل بررسی کنید."
    );
  }
  parts.push("");
  parts.push("تاریخ: " + missing("تاریخ تنظیم"));
  parts.push("");
  parts.push("امضا: " + missing("نام و امضای شاکی"));

  warnings.unshift(
    "این متن ادعای شما را بازتاب می‌دهد؛ عنوان مجرمانه، صلاحیت مرجع و نتیجهٔ رسیدگی در اختیار مرجع قضایی است."
  );
  return { text: parts.join("\n"), warnings };
}

function statementText(input: ComposeInput): { text: string; warnings: string[] } {
  const { request, attachments, attachmentLabel, references, questionnaire } = input;
  const a = request.answers;
  const warnings: string[] = [];
  const claim = (id: string) =>
    value(a, id) ? optionLabel(questionnaire, id, value(a, id)) : "";

  const parts: string[] = [];
  parts.push(HEADER_FA);
  parts.push("");
  parts.push("اظهارنامه");
  parts.push("");
  parts.push(`مخاطب: ${orMissing(a, "addresseeName", "نام مخاطب")}`);
  parts.push(
    value(a, "addresseeAddress")
      ? `نشانی مخاطب: ${value(a, "addresseeAddress")}`
      : `نشانی مخاطب: ${missing("نشانی مخاطب (اختیاری)")}`
  );
  parts.push(
    claim("relationship")
      ? `رابطهٔ طرفین (به گفتهٔ اظهارکننده): ${claim("relationship")}`
      : "رابطهٔ طرفین: عنوان نشده است."
  );
  parts.push("");
  parts.push("موضوع مطالبه:");
  parts.push(`نوع مطالبه: ${claim("claimKind") || missing("نوع مطالبه")}`);
  const amount = value(a, "claimAmount");
  parts.push(
    amount
      ? `مبلغ مورد مطالبه: ${amount} ریال`
      : `مبلغ مورد مطالبه: ${missing("مبلغ مورد مطالبه (در صورت مالی بودن)")}`
  );
  if (value(a, "dueDate")) parts.push(`سررسید / مهلت: ${value(a, "dueDate")}`);
  parts.push("");
  parts.push("شرح موضوع:");
  parts.push(
    bullets(
      [request.narrative],
      missing("شرح موضوع")
    )
  );
  parts.push("");
  parts.push("خواستهٔ اظهارکننده:");
  parts.push(orMissing(a, "demandText", "متن مطالبه"));
  parts.push("");
  parts.push("اقدام‌های پیشین:");
  parts.push(
    value(a, "hasPriorNotice") === "true"
      ? `پیش‌تر به مخاطب اخطار داده شده است${
          value(a, "priorNoticeDate") ? ` (تاریخ: ${value(a, "priorNoticeDate")})` : ""
        }.`
      : value(a, "hasPriorNotice") === "false"
        ? "پیش از این اخطار یا مطالبه‌ای به مخاطب داده نشده است (به گفتهٔ اظهارکننده)."
        : missing("سابقهٔ اخطار پیشین")
  );
  parts.push("");
  parts.push("دلایل و مستندات:");
  parts.push(
    bullets(
      evidenceLines(a, attachments, attachmentLabel),
      "در زمان تنظیم این پیش‌نویس، مستندی پیوست نشده است."
    )
  );
  if (value(a, "urgency") === "deadline_soon") {
    warnings.push(
      "شما وضعیت مهلت را «نزدیک» عنوان کرده‌اید؛ مهلت قانونی را لیگالیر تعیین یا تأیید نمی‌کند."
    );
    parts.push("");
    parts.push("توضیح مهلت (به گفتهٔ اظهارکننده): مهلت نزدیک است.");
  }
  if (value(a, "additionalNotes")) {
    parts.push("");
    parts.push("توضیح تکمیلی:");
    parts.push(value(a, "additionalNotes"));
  }
  parts.push("");
  parts.push("منابع حقوقی بررسی‌شده (از پایگاه لیگالیر):");
  parts.push(referencesBlock(references));
  if (references.length > 0) {
    warnings.push(
      "منابع فهرست‌شده به‌صورت خودکار بازیابی شده‌اند؛ انطباق آن‌ها با موضوع را خودتان یا وکیل بررسی کنید."
    );
  }
  parts.push("");
  parts.push("تاریخ: " + missing("تاریخ تنظیم"));
  parts.push("");
  parts.push("امضا: " + missing("نام و امضای اظهارکننده"));

  warnings.unshift(
    "این اظهارنامه پیش‌نویس است و ابلاغ رسمی محسوب نمی‌شود؛ ابلاغ از طریق مرجع صالح انجام می‌گیرد."
  );
  return { text: parts.join("\n"), warnings };
}

function briefText(input: ComposeInput): { text: string; warnings: string[] } {
  const { request, attachments, attachmentLabel, references, questionnaire } = input;
  const a = request.answers;
  const warnings: string[] = [];
  const labeled = (id: string) =>
    value(a, id) ? optionLabel(questionnaire, id, value(a, id)) : "";

  const parts: string[] = [];
  parts.push(HEADER_FA);
  parts.push("");
  parts.push("لایحه");
  parts.push("");
  parts.push(
    value(a, "caseReference")
      ? `شمارهٔ پرونده (به گفتهٔ ارائه‌دهنده): ${value(a, "caseReference")}`
      : `شمارهٔ پرونده: ${missing("شمارهٔ پرونده (اختیاری)")}`
  );
  parts.push(
    value(a, "courtName")
      ? `دادگاه: ${value(a, "courtName")}`
      : `دادگاه: ${missing("نام دادگاه (اختیاری)")}`
  );
  parts.push(`موضوع پرونده: ${orMissing(a, "caseSubject", "موضوع پرونده")}`);
  parts.push(
    labeled("submitterRole")
      ? `نقش ارائه‌دهنده: ${labeled("submitterRole")}`
      : `نقش ارائه‌دهنده: ${missing("نقش در پرونده")}`
  );
  parts.push("");
  parts.push("هدف این لایحه:");
  parts.push(labeled("briefPurpose") || missing("هدف لایحه"));
  parts.push("");
  parts.push("شرح لایحه (به نقل از ارائه‌دهنده):");
  parts.push(
    bullets(
      [request.narrative, ...chronologyLines(value(a, "keyFacts"))],
      missing("وقایع و نکات اصلی")
    )
  );
  parts.push("");
  parts.push("دلایل و استدلال‌های حقوقی:");
  parts.push(
    value(a, "legalReasons")
      ? value(a, "legalReasons")
      : "استدلال حقوقی مشخصی عنوان نشده است؛ لیگالیر از خود ماده یا قاعده‌ای اضافه نکرده است."
  );
  parts.push("");
  parts.push("دلایل و مستندات:");
  parts.push(
    bullets(
      evidenceLines(a, attachments, attachmentLabel),
      "در زمان تنظیم این پیش‌نویس، مستندی پیوست نشده است."
    )
  );
  parts.push("");
  parts.push("تصمیم‌های پیشین پرونده:");
  parts.push(
    value(a, "hasPriorOrder") === "true"
      ? `به گفتهٔ ارائه‌دهنده، در پرونده تصمیمی صادر شده است${
          value(a, "priorOrderRef") ? ` (${value(a, "priorOrderRef")})` : ""
        }.`
      : value(a, "hasPriorOrder") === "false"
        ? "به گفتهٔ ارائه‌دهنده، تصمیمی در پرونده صادر نشده است."
        : missing("سابقهٔ تصمیم پیشین")
  );
  parts.push("");
  parts.push("منابع حقوقی بررسی‌شده (از پایگاه لیگالیر):");
  parts.push(referencesBlock(references));
  if (references.length > 0) {
    warnings.push(
      "منابع فهرست‌شده به‌صورت خودکار بازیابی شده‌اند؛ انطباق آن‌ها با موضوع را خودتان یا وکیل بررسی کنید."
    );
  }
  parts.push("");
  parts.push("تاریخ: " + missing("تاریخ تنظیم"));
  parts.push("");
  parts.push("امضا: " + missing("نام و امضای ارائه‌دهنده"));

  warnings.unshift(
    "شمارهٔ پرونده و مرجع در این پیش‌نویس از گفتهٔ خود شما آمده و تأیید نشده است؛ پیش از ارائه، آن‌ها را با پروندهٔ واقعی مطابقت دهید."
  );
  return { text: parts.join("\n"), warnings };
}

// ------------------------------------------------------------
// Model refinement (only with a real provider)
// ------------------------------------------------------------

const REFINE_SYSTEM = [
  "شما فقط ویرایشگر متن یک پیش‌نویس حقوقی هستید، نه وکیل و نه مرجع قضایی.",
  "وظیفهٔ شما بازنویسی روان و منظم متن پیش‌نویس بر پایهٔ همان واقعیت‌های داده‌شده است.",
  "قواعد قطعی:",
  "۱) هیچ واقعیت، نام، مبلغ، تاریخ، مادهٔ قانونی، عنوان اتهام، مرجع صالح یا مهلتی اضافه نکنید.",
  "۲) هر جای متن که با «[تکمیل شود: …]» مشخص شده را باید عیناً حفظ کنید.",
  "۳) فقط و فقط از منابعی که در فهرست منابع آمده است می‌توانید نام ببرید؛ اگر فهرست خالی است هیچ ماده‌ای ذکر نکنید.",
  "۴) لحن باید خنثی و اداری باشد و هیچ‌گاه ادعای ثبت، ارسال یا تأیید سند توسط مرجع قضایی نکنید.",
  "۵) خروجی فقط متن پیش‌نویس باشد، بدون توضیح اضافه.",
].join("\n");

/**
 * Reword the composed draft with a configured provider. Returns `null` when
 * the provider is not really configured or the call fails — the caller then
 * keeps the deterministic text (a failed refinement must never lose work).
 */
export async function refineWithModel(
  provider: AiProvider,
  composed: string,
  references: JudicialDraftReference[],
  signal?: AbortSignal
): Promise<{ text: string; usage: AiUsage | null } | null> {
  if (!provider.configured) return null;

  const sourceList =
    references.length === 0
      ? "هیچ منبع قانونی بازیابی نشده است."
      : references.map((r) => `- ${r.title} — ${r.locator} (${r.tierFa})`).join("\n");

  let out = "";
  let usage: AiUsage | null = null;
  try {
    for await (const chunk of provider.stream({
      system: REFINE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `منابع مجاز:\n${sourceList}\n\nپیش‌نویس برای بازنویسی:\n${composed}`,
        },
      ],
      signal,
      // The provider's real token report — recorded on the usage ledger so the
      // draft's consumption is attributable, not estimated at display time.
      onUsage: (u) => {
        usage = u;
      },
    })) {
      out += chunk;
    }
  } catch {
    return null;
  }

  const text = out.trim();
  if (!text) return null;
  // A refinement that dropped the incomplete markers would hide missing
  // information — reject it rather than silently produce a cleaner lie.
  if (composed.includes(INCOMPLETE_MARKER) && !text.includes(INCOMPLETE_MARKER)) {
    return null;
  }
  return { text, usage };
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

export interface ComposedDraft {
  text: string;
  warnings: string[];
  ambiguitiesFa: string[];
}

/**
 * Compose the deterministic draft for a resolved family. `ambiguitiesFa` is
 * supplied by the caller (from the completeness check) so the draft carries
 * the same open questions the review page shows.
 */
const COMPOSERS: Record<
  JudicialDocumentType,
  (input: ComposeInput) => { text: string; warnings: string[] }
> = {
  statement: statementText,
  brief: briefText,
  petition: petitionText,
  complaint: complaintText,
};

export function composeStructuredDraft(
  input: ComposeInput,
  ambiguitiesFa: string[]
): ComposedDraft {
  const { request } = input;
  // An undetermined family keeps the دادخواست skeleton: the wizard refuses to
  // generate until the family is chosen, so this branch is only a safe default
  // for a stored row that predates the check.
  const compose = request.documentType ? COMPOSERS[request.documentType] : petitionText;
  const base = compose(input);

  const unanswered = flattenQuestions(input.questionnaire).filter(
    ({ question }) =>
      question.required &&
      isQuestionVisible(question, request.answers) &&
      !request.answers[question.id]?.trim()
  );

  const warnings = [...base.warnings];
  if (unanswered.length > 0) {
    warnings.push(
      `این پیش‌نویس با ${unanswered.length} پاسخ ناقص ساخته شده است؛ جاهای خالی با «[${INCOMPLETE_MARKER}]» مشخص شده‌اند.`
    );
  }
  if (!request.readyDocument && input.attachments.length === 0) {
    warnings.push(
      "هیچ مدرکی به این درخواست پیوست نشده است؛ پیش از اقدام، مستندات خود را بررسی و اضافه کنید."
    );
  }

  return { text: base.text, warnings, ambiguitiesFa };
}
