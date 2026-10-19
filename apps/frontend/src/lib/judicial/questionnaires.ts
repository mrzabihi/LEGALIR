// ============================================================
// LEGALIR — Versioned judicial questionnaires (server-only)
// ============================================================
// Every document family (اظهارنامه، لایحه، دادخواست، شکواییه) has its own
// rule set. The rules live HERE as versioned, publishable schemas — never as
// scattered conditionals inside a component — because:
//
//   • a request must always resolve against the schema it was filled with,
//     even after the schema moves on;
//   • an admin must be able to publish a new version and audit the change;
//   • the same schema drives both the form rendering and the server-side
//     completeness check, so the two can never disagree.
//
// A published version is immutable. Publishing a revision appends a NEW
// version and retires the old one; existing requests keep pointing at the
// version they were created with.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import type {
  JudicialDocumentType,
  JudicialQuestion,
  JudicialQuestionnaire,
  JudicialQuestionnaireStatus,
  JudicialQuestionnaireStep,
} from "@legalir/types";

const TABLE = "judicial_questionnaires";

/** The schema generation the seeds below belong to. */
export const JUDICIAL_QUESTIONNAIRE_SEED_VERSION = 1;

const DISCLAIMER_FA =
  "این متن یک پیش‌نویس است که بر پایهٔ اطلاعات خود شما تنظیم شده و سند رسمی، ثبت‌شده یا ابلاغ‌شده محسوب نمی‌شود. پیش از هر اقدام قضایی، متن را کامل بازبینی کنید و در صورت نیاز با وکیل مشورت کنید.";

// ------------------------------------------------------------
// Shared question helpers
// ------------------------------------------------------------

function q(question: JudicialQuestion): JudicialQuestion {
  return question;
}

function options(pairs: [string, string][]): { value: string; labelFa: string }[] {
  return pairs.map(([value, labelFa]) => ({ value, labelFa }));
}

// ------------------------------------------------------------
// اظهارنامه — a formal demand notified to the addressee
// ------------------------------------------------------------

function statementSteps(): JudicialQuestionnaireStep[] {
  return [
    {
      id: "parties",
      titleFa: "طرفین",
      descriptionFa: "مخاطب اظهارنامه و مشخصاتی که باید در متن بیاید.",
      fields: [
        q({
          id: "addresseeName",
          labelFa: "نام مخاطب (طرفی که اظهارنامه به او ابلاغ می‌شود)",
          type: "text",
          required: true,
          sensitive: true,
          whyFa: "نام مخاطب مستقیماً در متن اظهارنامه و برگ ابلاغ درج می‌شود.",
          placeholderFa: "نام شخص یا شرکت",
        }),
        q({
          id: "addresseeAddress",
          labelFa: "نشانی مخاطب (اختیاری)",
          type: "textarea",
          required: false,
          sensitive: true,
          whyFa: "نشانی برای ابلاغ استفاده می‌شود و فقط در همین درخواست نگهداری می‌شود.",
          placeholderFa: "نشانی کامل پستی",
        }),
        q({
          id: "relationship",
          labelFa: "رابطهٔ شما با مخاطب",
          type: "select",
          required: false,
          options: options([
            ["contract", "قرارداد / تعهد قراردادی"],
            ["check", "چک یا سفته"],
            ["rent", "اجاره"],
            ["family", "رابطهٔ خانوادگی"],
            ["other", "سایر"],
          ]),
        }),
      ],
    },
    {
      id: "claim",
      titleFa: "موضوع مطالبه",
      descriptionFa: "دقیقاً چه چیزی و به چه مبنایی مطالبه می‌کنید؟",
      fields: [
        q({
          id: "claimKind",
          labelFa: "نوع مطالبه",
          type: "select",
          required: true,
          options: options([
            ["debt", "مطالبهٔ وجه (دین)"],
            ["check", "مطالبهٔ وجه چک"],
            ["promissory", "مطالبهٔ وجه سفته"],
            ["performance", "انجام تعهد"],
            ["vacate", "تخلیه / تحویل"],
            ["damages", "خسارت"],
            ["other", "سایر"],
          ]),
        }),
        q({
          id: "claimAmount",
          labelFa: "مبلغ مورد مطالبه (ریال)",
          type: "currency",
          required: false,
          helpFa: "اگر مطالبه مالی است، مبلغ را به ریال بنویسید.",
        }),
        q({
          id: "dueDate",
          labelFa: "تاریخ سررسید یا مهلت (اختیاری)",
          type: "date",
          required: false,
        }),
        q({
          id: "demandText",
          labelFa: "چه چیزی از مخاطب می‌خواهید؟",
          type: "textarea",
          required: true,
          placeholderFa: "مثلاً: مبلغ … ریال بابت چک شمارهٔ … را ظرف … روز پرداخت کنید.",
        }),
        q({
          id: "hasPriorNotice",
          labelFa: "آیا پیش‌تر اخطار یا مطالبه‌ای به مخاطب داده‌اید؟",
          type: "boolean",
          required: true,
        }),
        q({
          id: "priorNoticeDate",
          labelFa: "تاریخ اخطار پیشین",
          type: "date",
          required: false,
          showWhen: { field: "hasPriorNotice", equals: "true" },
        }),
      ],
    },
    {
      id: "completion",
      titleFa: "مهلت و توضیحات",
      descriptionFa: "اطلاعاتی که به تنظیم دقیق‌تر متن کمک می‌کند.",
      fields: [
        q({
          id: "urgency",
          labelFa: "وضعیت مهلت",
          type: "select",
          required: false,
          helpFa: "اگر مهلت قانونی نزدیک است، این را در متن لحاظ می‌کنیم.",
          options: options([
            ["routine", "عادی"],
            ["deadline_soon", "مهلت نزدیک است"],
          ]),
        }),
        q({
          id: "additionalNotes",
          labelFa: "توضیح تکمیلی (اختیاری)",
          type: "textarea",
          required: false,
        }),
      ],
    },
  ];
}

// ------------------------------------------------------------
// لایحه — submitted inside an existing case
// ------------------------------------------------------------

function briefSteps(): JudicialQuestionnaireStep[] {
  return [
    {
      id: "case",
      titleFa: "پرونده",
      descriptionFa:
        "اطلاعاتی که شما از پرونده دارید. هیچ‌کدام از این‌ها توسط لیگالیر تأیید یا استعلام نمی‌شود.",
      fields: [
        q({
          id: "caseReference",
          labelFa: "شمارهٔ پرونده (اختیاری)",
          type: "text",
          required: false,
          helpFa: "اگر شمارهٔ پرونده را می‌دانید وارد کنید؛ این شماره فقط در متن درج می‌شود و اعتبارسنجی نمی‌شود.",
        }),
        q({
          id: "courtName",
          labelFa: "دادگاه (اختیاری)",
          type: "text",
          required: false,
        }),
        q({
          id: "caseSubject",
          labelFa: "موضوع پرونده",
          type: "text",
          required: true,
        }),
        q({
          id: "submitterRole",
          labelFa: "نقش شما در پرونده",
          type: "select",
          required: true,
          options: options([
            ["claimant", "خواهان / شاکی"],
            ["respondent", "خوانده / متهم"],
            ["lawyer", "وکیل"],
            ["other", "سایر"],
          ]),
        }),
        q({
          id: "hasPriorOrder",
          labelFa: "آیا قرار یا تصمیمی در پرونده صادر شده است؟",
          type: "boolean",
          required: false,
        }),
        q({
          id: "priorOrderRef",
          labelFa: "شماره یا تاریخ قرار / تصمیم",
          type: "text",
          required: false,
          showWhen: { field: "hasPriorOrder", equals: "true" },
        }),
      ],
    },
    {
      id: "content",
      titleFa: "محتوای لایحه",
      descriptionFa: "هدف لایحه و دلایلی که می‌خواهید در آن بیاید.",
      fields: [
        q({
          id: "briefPurpose",
          labelFa: "هدف این لایحه",
          type: "select",
          required: true,
          options: options([
            ["defense", "دفاع"],
            ["explanation", "توضیح"],
            ["objection", "اعتراض"],
            ["completion", "تکمیل مدارک یا اطلاعات"],
            ["response", "پاسخ به لایحهٔ طرف مقابل"],
            ["other", "سایر"],
          ]),
        }),
        q({
          id: "keyFacts",
          labelFa: "وقایع و نکات اصلی",
          type: "textarea",
          required: true,
          placeholderFa: "به ترتیب زمانی بنویسید؛ هرچه دقیق‌تر، متن منظم‌تری تنظیم می‌شود.",
        }),
        q({
          id: "legalReasons",
          labelFa: "دلایل و استدلال‌های حقوقی (اختیاری)",
          type: "textarea",
          required: false,
          helpFa: "اگر به ماده یا قاعدهٔ مشخصی استناد می‌کنید، اینجا بنویسید. لیگالیر منبعی از خود نمی‌سازد.",
        }),
        q({
          id: "evidenceList",
          labelFa: "دلایل و مستندات (اختیاری)",
          type: "textarea",
          required: false,
        }),
      ],
    },
  ];
}

// ------------------------------------------------------------
// دادخواست — a civil statement of claim
// ------------------------------------------------------------

function petitionSteps(): JudicialQuestionnaireStep[] {
  return [
    {
      id: "parties",
      titleFa: "طرفین دعوا",
      fields: [
        q({
          id: "claimantName",
          labelFa: "نام خواهان",
          type: "text",
          required: true,
          sensitive: true,
          whyFa: "نام خواهان در سرصفحهٔ دادخواست درج می‌شود.",
        }),
        q({
          id: "respondentName",
          labelFa: "نام خوانده",
          type: "text",
          required: true,
          sensitive: true,
          whyFa: "نام خوانده در سرصفحهٔ دادخواست درج می‌شود.",
        }),
        q({
          id: "respondentAddress",
          labelFa: "نشانی خوانده (اختیاری)",
          type: "textarea",
          required: false,
          sensitive: true,
          whyFa: "نشانی برای ابلاغ است و فقط در همین درخواست نگهداری می‌شود.",
        }),
      ],
    },
    {
      id: "claim",
      titleFa: "خواسته",
      fields: [
        q({
          id: "claimKind",
          labelFa: "نوع خواسته",
          type: "select",
          required: true,
          options: options([
            ["debt", "مطالبهٔ وجه"],
            ["contract", "الزام به انجام قرارداد"],
            ["property", "الزام به تنظیم سند / تحویل مال"],
            ["damages", "خسارت"],
            ["other", "سایر"],
          ]),
        }),
        q({
          id: "claimValue",
          labelFa: "بهای خواسته (ریال)",
          type: "currency",
          required: false,
          helpFa: "برای خواسته‌های مالی، مبلغ را به ریال بنویسید.",
        }),
        q({
          id: "claimBasis",
          labelFa: "منشأ دعوا",
          type: "text",
          required: true,
          placeholderFa: "مثلاً: قرارداد شمارهٔ … یا چک …",
        }),
        q({
          id: "facts",
          labelFa: "شرح وقایع",
          type: "textarea",
          required: true,
        }),
        q({
          id: "courtName",
          labelFa: "دادگاه پیشنهادی (اختیاری)",
          type: "text",
          required: false,
          helpFa: "صلاحیت دادگاه در متن ادعا نمی‌شود؛ هنگام ثبت، مرجع مربوطه بررسی می‌کند.",
        }),
      ],
    },
    {
      id: "evidence",
      titleFa: "دلایل",
      fields: [
        q({
          id: "evidenceList",
          labelFa: "دلایل و مستندات (اختیاری)",
          type: "textarea",
          required: false,
        }),
        q({
          id: "hasUrgency",
          labelFa: "آیا دستور موقت یا اقدام فوری لازم است؟",
          type: "boolean",
          required: false,
        }),
      ],
    },
  ];
}

// ------------------------------------------------------------
// شکواییه — a criminal complaint
// ------------------------------------------------------------

function complaintSteps(): JudicialQuestionnaireStep[] {
  return [
    {
      id: "parties",
      titleFa: "طرفین",
      fields: [
        q({
          id: "complainantName",
          labelFa: "نام شاکی",
          type: "text",
          required: true,
          sensitive: true,
          whyFa: "نام شاکی در سرصفحهٔ شکواییه درج می‌شود.",
        }),
        q({
          id: "accusedKnown",
          labelFa: "مشتکی‌عنه را می‌شناسید؟",
          type: "boolean",
          required: true,
        }),
        q({
          id: "accusedName",
          labelFa: "نام مشتکی‌عنه",
          type: "text",
          required: false,
          sensitive: true,
          whyFa: "نام مشتکی‌عنه در متن شکواییه درج می‌شود.",
          showWhen: { field: "accusedKnown", equals: "true" },
        }),
      ],
    },
    {
      id: "incident",
      titleFa: "واقعه",
      fields: [
        q({
          id: "incidentDate",
          labelFa: "تاریخ واقعه",
          type: "date",
          required: true,
        }),
        q({
          id: "incidentPlace",
          labelFa: "محل واقعه (اختیاری)",
          type: "text",
          required: false,
        }),
        q({
          id: "offenseTitle",
          labelFa: "عنوانی که در شکایت مطرح می‌کنید",
          type: "text",
          required: true,
          helpFa: "این عنوان، ادعای شماست؛ تعیین عنوان مجرمانه و تصمیم نهایی با مرجع قضایی است.",
        }),
        q({
          id: "facts",
          labelFa: "شرح واقعه",
          type: "textarea",
          required: true,
        }),
        q({
          id: "evidenceList",
          labelFa: "دلایل و مستندات (اختیاری)",
          type: "textarea",
          required: false,
        }),
      ],
    },
    {
      id: "history",
      titleFa: "سابقه",
      fields: [
        q({
          id: "hasPriorComplaint",
          labelFa: "آیا پیش‌تر شکایت یا اقدامی انجام داده‌اید؟",
          type: "boolean",
          required: false,
        }),
        q({
          id: "priorComplaintRef",
          labelFa: "شماره یا تاریخ اقدام پیشین",
          type: "text",
          required: false,
          showWhen: { field: "hasPriorComplaint", equals: "true" },
        }),
      ],
    },
  ];
}

const SEED_STEPS: Record<JudicialDocumentType, () => JudicialQuestionnaireStep[]> = {
  statement: statementSteps,
  brief: briefSteps,
  petition: petitionSteps,
  complaint: complaintSteps,
};

export const QUESTIONNAIRE_TITLES: Record<
  JudicialDocumentType,
  { titleFa: string; descriptionFa: string }
> = {
  statement: {
    titleFa: "پرسش‌نامهٔ اظهارنامه",
    descriptionFa:
      "برای تنظیم دقیق اظهارنامه، چند پرسش کوتاه دربارهٔ طرفین و موضوع مطالبه می‌پرسیم.",
  },
  brief: {
    titleFa: "پرسش‌نامهٔ لایحه",
    descriptionFa:
      "برای تنظیم لایحه، اطلاعات پرونده و هدف لایحه را می‌پرسیم. اطلاعات پرونده را شما وارد می‌کنید.",
  },
  petition: {
    titleFa: "پرسش‌نامهٔ دادخواست",
    descriptionFa: "برای تنظیم دادخواست، طرفین، خواسته و وقایع را مشخص کنید.",
  },
  complaint: {
    titleFa: "پرسش‌نامهٔ شکواییه",
    descriptionFa:
      "برای تنظیم شکواییه، واقعه و طرفین را شرح دهید. تعیین عنوان مجرمانه با مرجع قضایی است.",
  },
};

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

function buildSeedRow(documentType: JudicialDocumentType, now: string): JudicialQuestionnaire {
  return {
    id: `${documentType}:v${JUDICIAL_QUESTIONNAIRE_SEED_VERSION}`,
    documentType,
    version: JUDICIAL_QUESTIONNAIRE_SEED_VERSION,
    status: "published",
    titleFa: QUESTIONNAIRE_TITLES[documentType].titleFa,
    descriptionFa: QUESTIONNAIRE_TITLES[documentType].descriptionFa,
    steps: SEED_STEPS[documentType](),
    disclaimerFa: DISCLAIMER_FA,
    createdAt: now,
    createdBy: null,
    publishedAt: now,
    publishedBy: null,
  };
}

function seed(): JudicialQuestionnaire[] {
  const now = new Date().toISOString();
  const rows = (Object.keys(SEED_STEPS) as JudicialDocumentType[]).map((t) =>
    buildSeedRow(t, now)
  );
  writeTable(TABLE, rows);
  return rows;
}

/**
 * Every questionnaire version, seeding the published v1 set on first access.
 * Additive: a document type shipped after the first seed is appended.
 */
export function listQuestionnaires(): JudicialQuestionnaire[] {
  const rows = readTable<JudicialQuestionnaire>(TABLE);
  if (rows.length === 0) return seed();

  const presentTypes = new Set(rows.map((r) => r.documentType));
  const missingTypes = (Object.keys(SEED_STEPS) as JudicialDocumentType[]).filter(
    (t) => !presentTypes.has(t)
  );
  if (missingTypes.length === 0) return rows;

  const now = new Date().toISOString();
  const appended = missingTypes.map((t) => buildSeedRow(t, now));
  const next = [...rows, ...appended];
  writeTable(TABLE, next);
  return next;
}

/** All versions for one document family, newest first. */
export function listQuestionnaireVersions(
  documentType: JudicialDocumentType
): JudicialQuestionnaire[] {
  return listQuestionnaires()
    .filter((r) => r.documentType === documentType)
    .sort((a, b) => b.version - a.version);
}

/** The version a NEW request must use. */
export function getPublishedQuestionnaire(
  documentType: JudicialDocumentType
): JudicialQuestionnaire {
  const published = listQuestionnaires()
    .filter((r) => r.documentType === documentType && r.status === "published")
    .sort((a, b) => b.version - a.version);
  if (published.length > 0) return published[0]!;

  // The seed always publishes v1, so reaching here means an operator retired
  // every version. Return the newest row rather than fabricating a schema —
  // the caller decides whether the service may still be entered.
  const any = listQuestionnaireVersions(documentType)[0];
  if (any) return any;
  throw new Error(`No questionnaire for ${documentType}`);
}

/** Resolve the EXACT version a stored request was created against. */
export function getQuestionnaireVersion(
  documentType: JudicialDocumentType,
  version: number
): JudicialQuestionnaire | undefined {
  return listQuestionnaires().find(
    (r) => r.documentType === documentType && r.version === version
  );
}

export function getQuestionnaireById(id: string): JudicialQuestionnaire | undefined {
  return listQuestionnaires().find((r) => r.id === id);
}

/**
 * Append a new DRAFT version cloned from the newest existing version. Editing
 * the copy is a separate concern; this guarantees a published version is
 * never mutated in place.
 */
export function createQuestionnaireVersion(input: {
  documentType: JudicialDocumentType;
  createdBy: string;
  titleFa?: string;
  descriptionFa?: string;
  disclaimerFa?: string;
}): JudicialQuestionnaire | undefined {
  const rows = listQuestionnaires();
  const forType = rows.filter((r) => r.documentType === input.documentType);
  if (forType.length === 0) return undefined;
  const source = forType.reduce((a, b) => (b.version > a.version ? b : a));
  const nextVersion = forType.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  const now = new Date().toISOString();

  const created: JudicialQuestionnaire = {
    id: `${input.documentType}:v${nextVersion}`,
    documentType: input.documentType,
    version: nextVersion,
    status: "draft",
    titleFa: input.titleFa?.trim() || source.titleFa,
    descriptionFa: input.descriptionFa?.trim() || source.descriptionFa,
    steps: structuredClone(source.steps),
    disclaimerFa: input.disclaimerFa?.trim() || source.disclaimerFa,
    createdAt: now,
    createdBy: input.createdBy,
    publishedAt: null,
    publishedBy: null,
  };

  rows.push(created);
  writeTable(TABLE, rows);
  return created;
}

/**
 * Publish a draft version and retire the previously published one. Requests
 * already created keep their own `questionnaireVersion` and are untouched.
 */
export function publishQuestionnaire(
  id: string,
  actorUserId: string
): JudicialQuestionnaire | undefined {
  const rows = listQuestionnaires();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const target = rows[idx]!;
  if (target.status === "retired") return undefined;

  const now = new Date().toISOString();
  for (const row of rows) {
    if (
      row.documentType === target.documentType &&
      row.status === "published" &&
      row.id !== target.id
    ) {
      row.status = "retired" as JudicialQuestionnaireStatus;
    }
  }
  rows[idx] = {
    ...target,
    status: "published",
    publishedAt: target.publishedAt ?? now,
    publishedBy: actorUserId,
  };
  writeTable(TABLE, rows);
  return rows[idx];
}

// ------------------------------------------------------------
// Visibility + completeness
// ------------------------------------------------------------

/**
 * Whether a question is currently visible given the answers so far. The SAME
 * rule drives the form renderer and the server-side completeness check, so a
 * hidden required question can never block submission and a visible one can
 * never be skipped.
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

/** Every question that is visible under the given answers, flattened. */
export function visibleQuestions(
  questionnaire: JudicialQuestionnaire,
  answers: Record<string, string>
): { step: JudicialQuestionnaireStep; question: JudicialQuestion }[] {
  const out: { step: JudicialQuestionnaireStep; question: JudicialQuestion }[] = [];
  for (const step of questionnaire.steps) {
    for (const question of step.fields) {
      if (isQuestionVisible(question, answers)) out.push({ step, question });
    }
  }
  return out;
}
