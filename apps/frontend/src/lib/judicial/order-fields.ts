// ============================================================
// LEGALIR — Judicial order intake fields (client-safe)
// ============================================================
// The two `request_only` services do not draft a document; they record a
// tracked request an operator moves by hand. This module is the ONE field
// model for those requests — the intake form, the owner's edit view and the
// shared validator all read it, so a field can never exist in one place and
// be missing in another.
//
// Honesty rules baked into the shape:
//   • nothing here asks for a national id, a bank account or any credential —
//     the operator only needs enough to identify the request and its subject;
//   • the credit check additionally requires a declared lawful purpose and an
//     explicit consent declaration, because no check runs without them;
//   • `requiresConsent` is enforced again by the server on submit, so hiding a
//     client checkbox is not a way to skip it.
// ============================================================

import type {
  JudicialOrderAnswer,
  JudicialServiceId,
  JudicialServiceView,
} from "@legalir/types";

export interface JudicialOrderFieldDef {
  id: string;
  labelFa: string;
  hintFa?: string;
  placeholder?: string;
  /** A `select` renders the declared options; otherwise a text field. */
  options?: readonly { value: string; labelFa: string }[];
  multiline?: boolean;
  required: boolean;
  maxLength: number;
}

export interface JudicialOrderFieldConfig {
  fields: readonly JudicialOrderFieldDef[];
  /** The lawful-purpose declaration sent as `purposeFa`. */
  requiresPurpose: boolean;
  purposeLabelFa?: string;
  /** The explicit consent declaration (`consent_confirmed` answer). */
  requiresConsent: boolean;
  consentFa?: string;
  /** `false` when the service has no intake model at all. */
  available: boolean;
}

const CRIMINAL_RECORD: JudicialOrderFieldConfig = {
  available: true,
  requiresPurpose: false,
  requiresConsent: false,
  fields: [
    {
      id: "subject_name",
      labelFa: "نام و نام خانوادگی صاحب گواهی",
      required: true,
      maxLength: 120,
    },
    {
      id: "relation",
      labelFa: "نسبت شما با صاحب گواهی",
      hintFa: "مثلاً: خودم، کارمند، متقاضی استخدام",
      required: true,
      maxLength: 120,
    },
    {
      id: "authority",
      labelFa: "مرجعی که گواهی را می‌خواهد",
      hintFa: "اختیاری — اگر می‌دانید کدام مرجع یا کارفرما گواهی را خواسته است.",
      required: false,
      maxLength: 160,
    },
    {
      id: "reason",
      labelFa: "علت درخواست گواهی",
      hintFa: "این توضیح فقط برای پیگیری درخواست شما استفاده می‌شود.",
      multiline: true,
      required: true,
      maxLength: 2_000,
    },
  ],
};

const CREDIT_CHECK: JudicialOrderFieldConfig = {
  available: true,
  requiresPurpose: true,
  purposeLabelFa: "هدف مشروع استعلام",
  requiresConsent: true,
  consentFa:
    "تأیید می‌کنم رضایت صاحب داده را برای این استعلام دارم و اطلاعات را برای هدف مشروع اعلام‌شده درخواست می‌کنم.",
  fields: [
    {
      id: "subject_name",
      labelFa: "نام صاحب داده یا طرف معامله",
      required: true,
      maxLength: 120,
    },
    {
      id: "subject_kind",
      labelFa: "نوع شخص",
      required: true,
      maxLength: 40,
      options: [
        { value: "person", labelFa: "شخص حقیقی" },
        { value: "company", labelFa: "شخص حقوقی" },
      ],
    },
    {
      id: "transaction",
      labelFa: "موضوع معامله یا رابطهٔ مالی",
      hintFa: "مثلاً: قرارداد فروش خودرو، چک برگشتی، پیش‌پرداخت اجاره.",
      multiline: true,
      required: true,
      maxLength: 2_000,
    },
  ],
};

export const JUDICIAL_ORDER_CONFIG: Partial<
  Record<JudicialServiceId, JudicialOrderFieldConfig>
> = {
  judicial_criminal_record: CRIMINAL_RECORD,
  judicial_credit_check: CREDIT_CHECK,
};

const UNSUPPORTED: JudicialOrderFieldConfig = {
  available: false,
  requiresPurpose: false,
  requiresConsent: false,
  fields: [],
};

export function judicialOrderConfig(
  serviceId: JudicialServiceId | string
): JudicialOrderFieldConfig {
  return JUDICIAL_ORDER_CONFIG[serviceId as JudicialServiceId] ?? UNSUPPORTED;
}

/** The services that have a real order intake today. */
export function isOrderableJudicialService(id: string): boolean {
  return judicialOrderConfig(id).available;
}

export type OrderFormValues = Record<string, string>;

/** Values → the answer rows the server stores (empty fields are dropped). */
export function toOrderAnswers(
  config: JudicialOrderFieldConfig,
  values: OrderFormValues,
  consent: boolean
): JudicialOrderAnswer[] {
  const answers: JudicialOrderAnswer[] = [];
  for (const field of config.fields) {
    const value = (values[field.id] ?? "").trim();
    if (!value) continue;
    // A select stores the option's label so the operator reads the same text
    // the applicant chose; unknown values are dropped rather than stored.
    if (field.options) {
      const option = field.options.find((o) => o.value === value);
      if (!option) continue;
      answers.push({ fieldId: field.id, labelFa: field.labelFa, value: option.labelFa });
      continue;
    }
    answers.push({ fieldId: field.id, labelFa: field.labelFa, value });
  }
  if (config.requiresConsent && consent) {
    answers.push({
      fieldId: "consent_confirmed",
      labelFa: "تأیید رضایت صاحب داده",
      value: "تأیید شد",
    });
  }
  return answers;
}

/** Stored answers → form values (selects are matched back to their value). */
export function fromOrderAnswers(
  config: JudicialOrderFieldConfig,
  answers: JudicialOrderAnswer[]
): { values: OrderFormValues; consent: boolean } {
  const values: OrderFormValues = {};
  let consent = false;
  for (const answer of answers) {
    if (answer.fieldId === "consent_confirmed") {
      consent = true;
      continue;
    }
    const field = config.fields.find((f) => f.id === answer.fieldId);
    if (!field) continue;
    if (field.options) {
      const option = field.options.find((o) => o.labelFa === answer.value);
      values[field.id] = option ? option.value : "";
      continue;
    }
    values[field.id] = answer.value;
  }
  return { values, consent };
}

/** Field-level messages; an empty object means the form may be submitted. */
export function validateOrderForm(
  config: JudicialOrderFieldConfig,
  values: OrderFormValues,
  purpose: string,
  consent: boolean,
  submit: boolean
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of config.fields) {
    if (!submit || !field.required) continue;
    if (!(values[field.id] ?? "").trim()) errors[field.id] = "این فیلد الزامی است.";
  }
  if (submit && config.requiresPurpose && !purpose.trim()) {
    errors["purpose"] = "هدف مشروع استعلام را بنویسید.";
  }
  if (submit && config.requiresConsent && !consent) {
    errors["consent"] = "برای ثبت استعلام، تأیید رضایت صاحب داده لازم است.";
  }
  return errors;
}

/** One-line title derived from the subject, never from free-form guessing. */
export function orderTitleFa(service: JudicialServiceView, values: OrderFormValues): string {
  const subject = (values["subject_name"] ?? "").trim();
  return subject ? `${service.shortTitleFa} — ${subject}`.slice(0, 160) : service.shortTitleFa;
}
