// ============================================================
// LEGALIR — Judicial entry points (client-safe)
// ============================================================
// Which judicial services have a REAL wizard entry today. The mapping lives
// here, next to the href builder, so the discovery surfaces and the launcher
// cannot drift apart.
//
// All four drafting families are enterable because each one now has its OWN
// questionnaire, its own completeness rules and its own composer template
// (`lib/judicial/compose.ts`). `judicial_criminal_record` and
// `judicial_credit_check` still need external integrations and therefore render
// as explanatory cards, never as links.
// ============================================================

import type {
  JudicialDocumentType,
  JudicialServiceId,
  JudicialServiceView,
} from "@legalir/types";

/** Services whose questionnaire, analysis and draft are wired end to end. */
const ENTRY_TYPE: Partial<Record<JudicialServiceId, JudicialDocumentType>> = {
  judicial_statement: "statement",
  judicial_brief: "brief",
  judicial_petition: "petition",
  judicial_complaint: "complaint",
};

/** The document type this service opens the wizard with, or null. */
export function judicialEntryType(id: JudicialServiceId): JudicialDocumentType | null {
  return ENTRY_TYPE[id] ?? null;
}

/** The one destination for an enterable judicial service. */
export function judicialEntryHref(type: JudicialDocumentType): string {
  return `/judicial?type=${type}`;
}

/** Whether the launcher can pre-select this value from `?type=`. */
export function isJudicialEntryQuery(value: string | null): value is JudicialDocumentType {
  return value === "statement" || value === "brief" || value === "petition" || value === "complaint";
}

/**
 * Search-only aliases, so «شکایت» finds the شکواییه service and
 * «مطالبه» finds the دادخواست one. Never rendered.
 */
export const JUDICIAL_SEARCH_KEYWORDS: Record<JudicialServiceId, string[]> = {
  judicial_statement: ["اظهارنامه", "اخطار", "مطالبه"],
  judicial_brief: ["لایحه", "دفاعیه", "دادگاه"],
  judicial_petition: ["دادخواست", "شکایت حقوقی", "مطالبه", "خسارت", "محکومیت"],
  judicial_complaint: ["شکواییه", "شکایت کیفری", "جرم", "کلاهبرداری", "ضرب و جرح"],
  judicial_criminal_record: ["سوءپیشینه", "گواهی", "عدم سوء"],
  judicial_credit_check: ["اعتبار", "استعلام", "چک برگشتی"],
};

/** Free-text haystack for one service, used by surface search. */
export function judicialSearchHaystack(service: JudicialServiceView): string {
  return [
    service.titleFa,
    service.shortTitleFa,
    service.descriptionFa,
    service.ctaFa,
    ...(JUDICIAL_SEARCH_KEYWORDS[service.id] ?? []),
  ]
    .join(" ")
    .toLowerCase();
}
