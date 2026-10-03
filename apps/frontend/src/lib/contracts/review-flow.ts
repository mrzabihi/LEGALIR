// ============================================================
// LEGALIR — Contract review start flow (model)
// ============================================================
// The review flow is a three-step intake that turns "I want my
// contract checked" into a precise, grounded question for the AI:
//
//   STEP 1 — سند  : which document are we reviewing?
//   STEP 2 — زمینه: the facts that change the analysis (role,
//                   purpose, status, dates, jurisdiction, concerns)
//   STEP 3 — تأیید: the scope, stated back to the user before we run
//
// This module is deliberately React-free and side-effect-free: it owns
// the option sets, the completeness rule and the question builder, so
// the page component only renders and the tests can exercise the logic
// without a DOM.
//
// HONESTY RULE (spec §1, §10): nothing here fabricates an analysis.
// The flow only assembles the user's own answers into a question; the
// actual review is performed by the existing document-analysis pipeline
// and its result is whatever that pipeline returns.
//
// EXTRACTED vs CONFIRMED (spec §8): a value the system pre-filled from
// the document is marked `source: "extracted"`; a value the user typed
// or corrected is `source: "user"`. The two are never conflated, and
// the confirm step shows which is which.
// ============================================================

// ------------------------------------------------------------
// Steps
// ------------------------------------------------------------

export type ReviewStepId = "document" | "context" | "confirm";

export interface ReviewStepDescriptor {
  id: ReviewStepId;
  /** Short step title shown in the stepper. */
  titleFa: string;
  /** One-line explanation of what this step is for. */
  descriptionFa: string;
}

export const REVIEW_STEPS: ReviewStepDescriptor[] = [
  {
    id: "document",
    titleFa: "انتخاب سند",
    descriptionFa: "سندی که می‌خواهید بررسی شود را انتخاب یا بارگذاری کنید.",
  },
  {
    id: "context",
    titleFa: "اطلاعات بررسی",
    descriptionFa: "چند نکته درباره نقش و هدف شما، تا بررسی دقیق‌تر انجام شود.",
  },
  {
    id: "confirm",
    titleFa: "تأیید دامنه بررسی",
    descriptionFa: "خلاصه‌ای از آنچه بررسی می‌شود را ببینید و تأیید کنید.",
  },
];

/** The zero-based index of a step, for the progress indicator. */
export function reviewStepIndex(id: ReviewStepId): number {
  return REVIEW_STEPS.findIndex((s) => s.id === id);
}

// ------------------------------------------------------------
// Step 1 — document source
// ------------------------------------------------------------

export type ReviewDocumentSource = "upload" | "drafts" | "documents";

export interface ReviewSourceDescriptor {
  id: ReviewDocumentSource;
  titleFa: string;
  descriptionFa: string;
}

export const REVIEW_SOURCES: ReviewSourceDescriptor[] = [
  {
    id: "upload",
    titleFa: "بارگذاری سند جدید",
    descriptionFa: "فایل قرارداد را از دستگاه خود بارگذاری کنید (PDF یا تصویر).",
  },
  {
    id: "drafts",
    titleFa: "از پیش‌نویس‌های من",
    descriptionFa: "قراردادی که در لیگالیر ساخته یا نیمه‌کاره رها کرده‌اید.",
  },
  {
    id: "documents",
    titleFa: "از اسناد لیگالیر",
    descriptionFa: "سندی که قبلاً در بخش اسناد بارگذاری کرده‌اید.",
  },
];

// ------------------------------------------------------------
// Step 2 — analysis context
// ------------------------------------------------------------
// Every option carries a stable `value` (sent to the model) and a
// Persian `labelFa` (shown to the user). The «نمی‌دانم» option is a
// first-class answer, never a missing value — the user is allowed not
// to know, and the analysis must say so rather than guess.

export interface ReviewOption {
  value: string;
  labelFa: string;
}

/** The role the user plays in the contract. */
export const REVIEW_ROLES: ReviewOption[] = [
  { value: "party_a", labelFa: "طرف اول قرارداد" },
  { value: "party_b", labelFa: "طرف دوم قرارداد" },
  { value: "both", labelFa: "هر دو طرف" },
  { value: "advisor", labelFa: "مشاور / وکیل" },
  { value: "unknown", labelFa: "نمی‌دانم" },
];

/** What the user wants out of the review. */
export const REVIEW_PURPOSES: ReviewOption[] = [
  { value: "pre_sign", labelFa: "بررسی پیش از امضا" },
  { value: "post_sign", labelFa: "بررسی قرارداد امضاشده" },
  { value: "dispute", labelFa: "بررسی برای اختلاف یا شکایت" },
  { value: "drafting_help", labelFa: "کمک به اصلاح و تنظیم" },
  { value: "unknown", labelFa: "نمی‌دانم" },
];

/** The lifecycle status of the document being reviewed. */
export const REVIEW_STATUSES: ReviewOption[] = [
  { value: "draft", labelFa: "پیش‌نویس، هنوز امضا نشده" },
  { value: "signed", labelFa: "امضا شده" },
  { value: "executed", labelFa: "در حال اجرا" },
  { value: "expired", labelFa: "منقضی شده" },
  { value: "unknown", labelFa: "نمی‌دانم" },
];

/** The specific worries the user wants the review to focus on. */
export const REVIEW_CONCERNS: ReviewOption[] = [
  { value: "payment", labelFa: "شرایط پرداخت و مبلغ" },
  { value: "termination", labelFa: "شرایط فسخ و خاتمه" },
  { value: "penalty", labelFa: "وجه التزام و جریمه" },
  { value: "liability", labelFa: "مسئولیت و خسارت" },
  { value: "ownership", labelFa: "مالکیت و انتقال" },
  { value: "confidentiality", labelFa: "محرمانگی و مالکیت فکری" },
  { value: "dispute", labelFa: "حل اختلاف و مرجع صالح" },
  { value: "other", labelFa: "موضوع دیگر" },
];

/** The jurisdiction the contract is governed by. */
export const REVIEW_JURISDICTIONS: ReviewOption[] = [
  { value: "iran", labelFa: "قوانین ایران" },
  { value: "other", labelFa: "حوزه قضایی دیگر" },
  { value: "unknown", labelFa: "نمی‌دانم" },
];

/** Where a context value came from — the honesty marker of §8. */
export type ReviewValueSource = "extracted" | "user";

/** One answered field, with its provenance. */
export interface ReviewAnswer {
  value: string;
  source: ReviewValueSource;
}

/**
 * The user's answers to step 2. Every field is optional: the flow is
 * complete as soon as the user has confirmed the scope, and an
 * unanswered field is simply absent (never a fabricated default).
 */
export interface ReviewContext {
  role?: ReviewAnswer;
  purpose?: ReviewAnswer;
  status?: ReviewAnswer;
  jurisdiction?: ReviewAnswer;
  /** Free-text dates the user supplied (start / end / signing). */
  startDate?: ReviewAnswer;
  endDate?: ReviewAnswer;
  /** The concerns the user selected, each with provenance. */
  concerns: ReviewAnswer[];
  /** Anything else the user wants the review to know. */
  notes?: ReviewAnswer;
}

export const EMPTY_REVIEW_CONTEXT: ReviewContext = { concerns: [] };

/** Look up the Persian label for a value within an option set. */
export function optionLabelFa(options: ReviewOption[], value: string | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.labelFa ?? value;
}

/**
 * True when the context is complete enough to run a review. The only
 * hard requirement is the purpose — without it the analysis cannot be
 * framed. Everything else may legitimately be «نمی‌دانم» or absent.
 */
export function isReviewContextComplete(context: ReviewContext): boolean {
  return !!context.purpose?.value;
}

/** True when the user explicitly answered «نمی‌دانم» for a field. */
export function isUnknown(answer: ReviewAnswer | undefined): boolean {
  return answer?.value === "unknown";
}

// ------------------------------------------------------------
// Step 3 — scope summary + the question we send
// ------------------------------------------------------------

/** One line of the scope summary shown on the confirm step. */
export interface ReviewScopeLine {
  labelFa: string;
  valueFa: string;
  /** True when the value was pre-filled from the document. */
  extracted: boolean;
}

/**
 * Build the scope summary from the context. Only answered fields
 * appear — an absent field is omitted rather than shown as «نامشخص»,
 * so the summary never implies the user told us something they did not.
 */
export function reviewScopeSummary(context: ReviewContext): ReviewScopeLine[] {
  const lines: ReviewScopeLine[] = [];
  const push = (
    labelFa: string,
    answer: ReviewAnswer | undefined,
    options: ReviewOption[]
  ) => {
    if (!answer?.value) return;
    lines.push({
      labelFa,
      valueFa: optionLabelFa(options, answer.value),
      extracted: answer.source === "extracted",
    });
  };

  push("نقش شما", context.role, REVIEW_ROLES);
  push("هدف بررسی", context.purpose, REVIEW_PURPOSES);
  push("وضعیت سند", context.status, REVIEW_STATUSES);
  push("حوزه قضایی", context.jurisdiction, REVIEW_JURISDICTIONS);

  if (context.startDate?.value) {
    lines.push({
      labelFa: "تاریخ شروع",
      valueFa: context.startDate.value,
      extracted: context.startDate.source === "extracted",
    });
  }
  if (context.endDate?.value) {
    lines.push({
      labelFa: "تاریخ پایان",
      valueFa: context.endDate.value,
      extracted: context.endDate.source === "extracted",
    });
  }

  if (context.concerns.length > 0) {
    lines.push({
      labelFa: "نکات مورد توجه",
      valueFa: context.concerns
        .map((c) => optionLabelFa(REVIEW_CONCERNS, c.value))
        .join("، "),
      extracted: context.concerns.every((c) => c.source === "extracted"),
    });
  }

  return lines;
}

/**
 * Assemble the review question from the user's own answers. This is the
 * text handed to the existing document-analysis pipeline — it contains
 * ONLY what the user told us, so the model is never fed invented facts.
 *
 * The document itself is attached separately (by id), so this string
 * carries the *intent*, not the content.
 */
export function buildReviewQuestion(context: ReviewContext): string {
  const parts: string[] = ["این قرارداد را بررسی کن."];

  const purpose = optionLabelFa(REVIEW_PURPOSES, context.purpose?.value);
  if (purpose) parts.push(`هدف من از این بررسی: ${purpose}.`);

  const role = optionLabelFa(REVIEW_ROLES, context.role?.value);
  if (role && !isUnknown(context.role)) parts.push(`نقش من در این قرارداد: ${role}.`);

  const status = optionLabelFa(REVIEW_STATUSES, context.status?.value);
  if (status && !isUnknown(context.status)) parts.push(`وضعیت سند: ${status}.`);

  const jurisdiction = optionLabelFa(REVIEW_JURISDICTIONS, context.jurisdiction?.value);
  if (jurisdiction && !isUnknown(context.jurisdiction)) {
    parts.push(`حوزه قضایی: ${jurisdiction}.`);
  }

  if (context.concerns.length > 0) {
    const concerns = context.concerns
      .map((c) => optionLabelFa(REVIEW_CONCERNS, c.value))
      .join("، ");
    parts.push(`به این نکات توجه ویژه کن: ${concerns}.`);
  }

  if (context.notes?.value.trim()) {
    parts.push(`توضیح بیشتر: ${context.notes.value.trim()}`);
  }

  parts.push(
    "برای هر ایراد، متن دقیق سند، اثر حقوقی آن و منبع قانونی را ذکر کن. اگر منبع کافی در دسترس نیست، صریح بگو."
  );

  return parts.join(" ");
}

// ------------------------------------------------------------
// Result page tabs (spec §11)
// ------------------------------------------------------------
// The result surface is a fixed set of tabs. They are declared here so
// the result page and its tests agree on the vocabulary, and so a tab
// can never be added in one place and forgotten in another.

export type ReviewResultTab =
  | "summary"
  | "findings"
  | "missing"
  | "sources"
  | "suggestions"
  | "document";

export interface ReviewResultTabDescriptor {
  id: ReviewResultTab;
  labelFa: string;
  /** One-line explanation of what the tab contains. */
  descriptionFa: string;
}

export const REVIEW_RESULT_TABS: ReviewResultTabDescriptor[] = [
  {
    id: "summary",
    labelFa: "خلاصه بررسی",
    descriptionFa: "جمع‌بندی وضعیت قرارداد و مهم‌ترین نکات.",
  },
  {
    id: "findings",
    labelFa: "ایرادها و ریسک‌ها",
    descriptionFa: "ایرادهای حقوقی و ریسک‌های قراردادی، هر یک با متن و منبع.",
  },
  {
    id: "missing",
    labelFa: "اطلاعات ناقص",
    descriptionFa: "مواردی که برای تحلیل دقیق‌تر باید تکمیل شوند.",
  },
  {
    id: "sources",
    labelFa: "منابع و مستندات",
    descriptionFa: "مواد قانونی و مستنداتی که به آن‌ها ارجاع شده است.",
  },
  {
    id: "suggestions",
    labelFa: "پیشنهاد اصلاح",
    descriptionFa: "متن پیشنهادی برای رفع هر ایراد.",
  },
  {
    id: "document",
    labelFa: "سند و نشانه‌گذاری",
    descriptionFa: "متن کامل سند همراه با نشانه‌گذاری محل هر یافته.",
  },
];

/** The default tab a result page opens on. */
export const DEFAULT_REVIEW_RESULT_TAB: ReviewResultTab = "summary";
