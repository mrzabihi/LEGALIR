// ============================================================
// LEGALIR — Structured follow-up questions (server-only)
// ============================================================
// The single table of information the workflow engine may ask for. Each row
// carries a STABLE `id` (which is also the `collectedFacts` key, so an answer
// can never be asked twice), a short Persian reason shown only for required
// items, and quick options when the answer is genuinely enumerable.
//
// This module only produces questions — it never invents an answer. When the
// user does not know or does not want to say, the UI records an honest
// «اطلاع ندارم» value rather than letting the model assume a fact.
// ============================================================

import type { CaseCategory, FollowUpQuestion, FollowUpQuickOption } from "@legalir/types";

export interface RequiredInfoDefinition {
  /** Stable fact key — also the key written into `WorkflowState.collectedFacts`. */
  id: string;
  questionFa: string;
  /** Short reason, shown only when the question is required. */
  whyFa: string | null;
  required: boolean;
  /** Empty when the answer is free-form. */
  quickOptionsFa: FollowUpQuickOption[];
  /** Domains this question is specific to; empty = every domain. */
  domains: CaseCategory[];
}

const opts = (...values: string[]): FollowUpQuickOption[] =>
  values.map((v) => ({ labelFa: v, value: v }));

export const REQUIRED_INFO: readonly RequiredInfoDefinition[] = [
  {
    id: "parties",
    questionFa: "طرفین موضوع چه کسانی هستند؟ (نام، نقش و رابطه آن‌ها)",
    whyFa: "نوع رابطه طرفین، مسیر حقوقی و امکان طرح دعوا را تعیین می‌کند.",
    required: true,
    quickOptionsFa: [],
    domains: [],
  },
  {
    id: "timeline",
    questionFa: "این موضوع از چه زمانی شروع شده و چه وقایعی رخ داده است؟",
    whyFa: "زمان وقوع، مهلت‌های قانونی و مرور زمان را مشخص می‌کند.",
    required: true,
    quickOptionsFa: [],
    domains: [],
  },
  {
    id: "documents",
    questionFa: "چه مدارک و مستنداتی در اختیار دارید؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: [],
  },
  {
    id: "location",
    questionFa: "محل وقوع موضوع کجاست؟ (شهر، استان)",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: [],
  },
  {
    id: "amount",
    questionFa: "مبلغ یا ارزش مالی مورد اختلاف چقدر است؟",
    whyFa: "مبلغ، صلاحیت مرجع رسیدگی و هزینه دادرسی را تعیین می‌کند.",
    required: true,
    quickOptionsFa: [],
    domains: ["contract", "financial", "property", "employment"],
  },
  {
    id: "contract_type",
    questionFa: "نوع قرارداد چیست و مفاد کلیدی آن کدام است؟",
    whyFa: null,
    required: false,
    quickOptionsFa: opts("اجاره", "کار", "بیع", "مشارکت", "سایر"),
    domains: ["contract", "employment"],
  },
  {
    id: "employer_details",
    questionFa: "مشخصات کارفرما و شرایط استخدامی چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: ["employment"],
  },
  {
    id: "property_details",
    questionFa: "مشخصات ملک (آدرس، متراژ، نوع کاربری) چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: ["property"],
  },
  {
    id: "marriage_date",
    questionFa: "تاریخ ازدواج و نوع عقد (دائم/موقت) چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: opts("دائم", "موقت"),
    domains: ["family"],
  },
  {
    id: "children",
    questionFa: "آیا فرزندی وجود دارد؟ سن و شرایط حضانت آن‌ها چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: opts("بله", "خیر"),
    domains: ["family"],
  },
  {
    id: "check_details",
    questionFa: "مشخصات چک (مبلغ، تاریخ، بانک، صادرکننده) چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: ["criminal", "financial"],
  },
  {
    id: "company_type",
    questionFa: "نوع شرکت و ساختار مدیریتی آن چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: opts("سهامی خاص", "سهامی عام", "مسئولیت محدود", "تعاونی", "سایر"),
    domains: ["business"],
  },
  {
    id: "tax_year",
    questionFa: "برای کدام سال مالی و چه نوع مالیاتی سوال دارید؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [],
    domains: ["tax"],
  },
] as const;

/** The maximum number of questions a single turn may ask. */
export const MAX_QUESTIONS_PER_TURN = 4;

function toView(def: RequiredInfoDefinition): FollowUpQuestion {
  return {
    id: def.id,
    questionFa: def.questionFa,
    whyFa: def.required ? def.whyFa : null,
    required: def.required,
    quickOptionsFa: def.quickOptionsFa,
  };
}

/**
 * Pick the questions that are still genuinely open. Domain-specific first,
 * then generic, capped per turn. A fact already collected (answered, extracted
 * from the message or present in an attached document) is never asked again.
 */
export function generateStructuredQuestions(
  domain: CaseCategory | null,
  collectedFacts: Record<string, string>
): FollowUpQuestion[] {
  const domainSpecific: FollowUpQuestion[] = [];
  const generic: FollowUpQuestion[] = [];

  for (const def of REQUIRED_INFO) {
    if (collectedFacts[def.id]) continue;
    if (def.domains.length > 0) {
      if (domain && def.domains.includes(domain)) domainSpecific.push(toView(def));
    } else {
      generic.push(toView(def));
    }
  }

  return [...domainSpecific, ...generic].slice(0, MAX_QUESTIONS_PER_TURN);
}

/** The plain-text projection the workflow system prompt consumes. */
export function structuredQuestionsToText(questions: readonly FollowUpQuestion[]): string[] {
  return questions.map((q) => q.questionFa);
}

/**
 * The value recorded as a fact when the user explicitly says they do not have
 * the information. It is a real, honest statement — never a placeholder the
 * model could mistake for an answer.
 */
export const UNKNOWN_ANSWER_FA = "اطلاع ندارم";
