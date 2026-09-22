// ============================================================
// LEGALIR — Legal Intake Wizard Schemas (PART 5)
// ============================================================
// Versioned, per-category questionnaires. Each schema is a 9-step wizard
// (or fewer where a category genuinely needs less) that collects the facts
// the AI needs BEFORE it reasons. Schemas are versioned so an in-flight
// draft can be resumed against the exact schema it was started with.
//
// Adding a field is a MINOR version bump; changing/removing a field is a
// MAJOR bump. Never mutate a published version in place.
// ============================================================

import type { IntakeSchema, IntakeStep } from "@legalir/types";

/** The current schema version for every category. */
export const INTAKE_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Shared step builders
// ---------------------------------------------------------------------------

const STEP_SUBJECT: IntakeStep = {
  id: "subject",
  titleFa: "موضوع و شرح مسئله",
  descriptionFa: "مسئله حقوقی خود را دقیق و کامل شرح دهید.",
  fields: [
    {
      key: "title",
      labelFa: "عنوان کوتاه",
      type: "text",
      required: true,
      placeholderFa: "مثلاً: اختلاف با مالک درباره ودیعه",
    },
    {
      key: "description",
      labelFa: "شرح کامل ماجرا",
      type: "textarea",
      required: true,
      helpFa: "هرچه دقیق‌تر بنویسید، تحلیل دقیق‌تر خواهد بود.",
    },
  ],
};

const STEP_PARTIES: IntakeStep = {
  id: "parties",
  titleFa: "طرفین",
  descriptionFa: "طرفین درگیر در این موضوع چه کسانی هستند؟",
  fields: [
    {
      key: "partyRole",
      labelFa: "نقش شما",
      type: "select",
      required: true,
      options: [
        { value: "claimant", labelFa: "خواهان / شاکی" },
        { value: "respondent", labelFa: "خوانده / متهم" },
        { value: "both", labelFa: "هر دو طرف" },
        { value: "advisor", labelFa: "مشاور" },
      ],
    },
    {
      key: "counterpartyType",
      labelFa: "نوع طرف مقابل",
      type: "select",
      required: false,
      options: [
        { value: "individual", labelFa: "شخص حقیقی" },
        { value: "company", labelFa: "شخص حقوقی / شرکت" },
        { value: "government", labelFa: "دولتی" },
        { value: "unknown", labelFa: "نامشخص" },
      ],
    },
  ],
};

const STEP_TIMELINE: IntakeStep = {
  id: "timeline",
  titleFa: "زمان‌بندی",
  descriptionFa: "وقایع کلیدی چه زمانی رخ داده‌اند؟",
  fields: [
    {
      key: "incidentDate",
      labelFa: "تاریخ واقعه اصلی",
      type: "date",
      required: false,
    },
    {
      key: "hasDeadline",
      labelFa: "آیا مهلت قانونی در پیش است؟",
      type: "boolean",
      required: true,
    },
    {
      key: "deadlineDate",
      labelFa: "تاریخ مهلت",
      type: "date",
      required: false,
      showWhen: { field: "hasDeadline", equals: "true" },
    },
  ],
};

const STEP_DOCUMENTS: IntakeStep = {
  id: "documents",
  titleFa: "مستندات",
  descriptionFa: "چه مدارکی در اختیار دارید؟",
  fields: [
    {
      key: "documentTypes",
      labelFa: "انواع مستندات موجود",
      type: "multiselect",
      required: false,
      options: [
        { value: "contract", labelFa: "قرارداد" },
        { value: "receipt", labelFa: "رسید / فیش" },
        { value: "correspondence", labelFa: "مکاتبات" },
        { value: "witness", labelFa: "شهادت شهود" },
        { value: "official", labelFa: "سند رسمی" },
        { value: "none", labelFa: "هیچ‌کدام" },
      ],
    },
    {
      key: "documentNotes",
      labelFa: "توضیح تکمیلی درباره مستندات",
      type: "textarea",
      required: false,
    },
  ],
};

const STEP_GOAL: IntakeStep = {
  id: "goal",
  titleFa: "خواسته و هدف",
  descriptionFa: "در نهایت به چه نتیجه‌ای می‌خواهید برسید؟",
  fields: [
    {
      key: "desiredOutcome",
      labelFa: "خواسته اصلی",
      type: "textarea",
      required: true,
    },
    {
      key: "urgency",
      labelFa: "فوریت",
      type: "select",
      required: true,
      options: [
        { value: "low", labelFa: "عادی" },
        { value: "medium", labelFa: "نسبتاً فوری" },
        { value: "high", labelFa: "فوری" },
      ],
    },
  ],
};

const STEP_LOCATION: IntakeStep = {
  id: "location",
  titleFa: "حوزه قضایی",
  descriptionFa: "موضوع در کدام شهر یا استان مطرح است؟",
  fields: [
    { key: "province", labelFa: "استان", type: "text", required: false },
    { key: "city", labelFa: "شهر", type: "text", required: false },
    {
      key: "courtStage",
      labelFa: "مرحله رسیدگی",
      type: "select",
      required: false,
      options: [
        { value: "none", labelFa: "هنوز اقدامی نشده" },
        { value: "preliminary", labelFa: "بدوی" },
        { value: "appeal", labelFa: "تجدیدنظر" },
        { value: "execution", labelFa: "اجرای حکم" },
      ],
    },
  ],
};

const STEP_PRIOR_ACTIONS: IntakeStep = {
  id: "prior_actions",
  titleFa: "اقدامات انجام‌شده",
  descriptionFa: "تا کنون چه اقداماتی انجام داده‌اید؟",
  fields: [
    {
      key: "priorActions",
      labelFa: "اقدامات قبلی",
      type: "multiselect",
      required: false,
      options: [
        { value: "notice", labelFa: "ارسال اظهارنامه" },
        { value: "complaint", labelFa: "شکایت / دادخواست" },
        { value: "mediation", labelFa: "میانجی‌گری" },
        { value: "lawyer", labelFa: "مشورت با وکیل" },
        { value: "none", labelFa: "هیچ‌کدام" },
      ],
    },
  ],
};

const STEP_BUDGET: IntakeStep = {
  id: "budget",
  titleFa: "بودجه و همکاری",
  descriptionFa: "برای پیگیری این موضوع چه بودجه و ترجیحی دارید؟",
  fields: [
    {
      key: "budgetToman",
      labelFa: "بودجه تقریبی (تومان)",
      type: "currency",
      required: false,
    },
    {
      key: "preferRemote",
      labelFa: "ترجیح مشاوره آنلاین",
      type: "boolean",
      required: false,
    },
  ],
};

const STEP_REVIEW: IntakeStep = {
  id: "review",
  titleFa: "بازبینی و تأیید",
  descriptionFa: "پاسخ‌های خود را مرور کنید و برای دریافت تحلیل تأیید کنید.",
  fields: [],
};

/** The nine canonical steps, in order. */
const BASE_STEPS: IntakeStep[] = [
  STEP_SUBJECT,
  STEP_PARTIES,
  STEP_TIMELINE,
  STEP_DOCUMENTS,
  STEP_GOAL,
  STEP_LOCATION,
  STEP_PRIOR_ACTIONS,
  STEP_BUDGET,
  STEP_REVIEW,
];

// ---------------------------------------------------------------------------
// Category-specific extra fields, injected into the subject step
// ---------------------------------------------------------------------------

const CATEGORY_EXTRA_FIELDS: Record<string, IntakeStep["fields"]> = {
  family: [
    {
      key: "marriageDate",
      labelFa: "تاریخ ازدواج",
      type: "date",
      required: false,
    },
    {
      key: "hasChildren",
      labelFa: "آیا فرزند دارید؟",
      type: "boolean",
      required: false,
    },
    {
      key: "dowryAmount",
      labelFa: "مبلغ مهریه (تومان)",
      type: "currency",
      required: false,
    },
  ],
  real_estate: [
    {
      key: "propertyType",
      labelFa: "نوع ملک",
      type: "select",
      required: false,
      options: [
        { value: "residential", labelFa: "مسکونی" },
        { value: "commercial", labelFa: "تجاری" },
        { value: "land", labelFa: "زمین" },
        { value: "other", labelFa: "سایر" },
      ],
    },
    {
      key: "hasDeed",
      labelFa: "آیا سند رسمی وجود دارد؟",
      type: "boolean",
      required: false,
    },
  ],
  labor: [
    {
      key: "employmentStart",
      labelFa: "تاریخ شروع به کار",
      type: "date",
      required: false,
    },
    {
      key: "hasInsurance",
      labelFa: "آیا بیمه رد شده است؟",
      type: "boolean",
      required: false,
    },
  ],
  checks: [
    {
      key: "checkAmount",
      labelFa: "مبلغ چک (تومان)",
      type: "currency",
      required: false,
    },
    {
      key: "checkDueDate",
      labelFa: "تاریخ سررسید چک",
      type: "date",
      required: false,
    },
  ],
  companies: [
    {
      key: "companyRole",
      labelFa: "نقش شما در شرکت",
      type: "select",
      required: false,
      options: [
        { value: "shareholder", labelFa: "سهامدار" },
        { value: "director", labelFa: "مدیر" },
        { value: "employee", labelFa: "کارمند" },
        { value: "other", labelFa: "سایر" },
      ],
    },
  ],
  tax: [
    {
      key: "taxType",
      labelFa: "نوع مالیات",
      type: "select",
      required: false,
      options: [
        { value: "income", labelFa: "بر درآمد" },
        { value: "vat", labelFa: "بر ارزش افزوده" },
        { value: "property", labelFa: "بر املاک" },
        { value: "other", labelFa: "سایر" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Schema registry
// ---------------------------------------------------------------------------

const CATEGORY_TITLES: Record<string, string> = {
  family: "خانواده",
  contract: "قرارداد",
  real_estate: "املاک",
  labor: "کار و تأمین اجتماعی",
  commerce: "تجارت",
  criminal: "کیفری",
  tax: "مالیاتی",
  companies: "شرکت‌ها",
  checks: "چک و اسناد تجاری",
  immigration: "مهاجرت",
  cyber: "جرائم رایانه‌ای",
  other: "سایر موضوعات حقوقی",
};

/** Build the schema for a category, injecting its extra fields. */
export function buildIntakeSchema(category: string): IntakeSchema {
  const extra = CATEGORY_EXTRA_FIELDS[category] ?? [];
  const steps = BASE_STEPS.map((step) =>
    step.id === "subject" && extra.length > 0
      ? { ...step, fields: [...step.fields, ...extra] }
      : step
  );

  return {
    category,
    version: INTAKE_SCHEMA_VERSION,
    titleFa: `پرسش‌نامه ${CATEGORY_TITLES[category] ?? category}`,
    descriptionFa:
      "برای دریافت تحلیل دقیق و مستند، لطفاً به پرسش‌های زیر پاسخ دهید. هرچه اطلاعات کامل‌تر باشد، نتیجه دقیق‌تر خواهد بود.",
    steps,
  };
}

/** All supported categories, in display order. */
export const INTAKE_CATEGORIES = Object.keys(CATEGORY_TITLES);

export function isSupportedCategory(category: string): boolean {
  return category in CATEGORY_TITLES;
}
