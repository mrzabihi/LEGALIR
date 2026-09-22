// ============================================================
// LEGALIR — Contract status presentation model
// ============================================================
// The app has TWO contract lifecycles:
//   • the Contract Operating System (`PropertyContractState`, 15 states)
//   • the legacy V1 workspace (`V1ContractState`, 7 states)
//
// The Contracts page shows both in one list, so it needs ONE set of
// user-facing status buckets. This module is the single mapping from
// either raw state onto that shared vocabulary — the UI never branches
// on a raw state string, and the two lifecycles can never drift into
// two different sets of labels.
//
// The buckets are ordered by *work remaining*, so the default sort
// (draft first) falls out of the group order rather than a second list.
// ============================================================

import type { PropertyContractState, V1ContractState } from "@legalir/types";

/** The shared, user-facing status buckets. */
export type ContractStatusGroup =
  | "draft"
  | "in_progress"
  | "generated"
  | "under_review"
  | "approved"
  | "exported"
  | "archived";

/** Display order — least-finished first, so drafts surface at the top. */
export const CONTRACT_STATUS_ORDER: ContractStatusGroup[] = [
  "draft",
  "in_progress",
  "generated",
  "under_review",
  "approved",
  "exported",
  "archived",
];

export const CONTRACT_STATUS_LABELS: Record<ContractStatusGroup, string> = {
  draft: "پیش‌نویس",
  in_progress: "در حال تکمیل",
  generated: "تولید شده",
  under_review: "در حال بررسی",
  approved: "تأیید شده",
  exported: "خروجی گرفته شده",
  archived: "بایگانی",
};

/** A short, plain-language hint shown under the status in a card. */
export const CONTRACT_STATUS_HINTS: Record<ContractStatusGroup, string> = {
  draft: "آماده ادامه تکمیل",
  in_progress: "در حال تکمیل اطلاعات",
  generated: "متن قرارداد آماده است",
  under_review: "در انتظار بررسی",
  approved: "تأییدشده و آماده خروجی",
  exported: "خروجی گرفته شده",
  archived: "بایگانی‌شده",
};

/**
 * Semantic tone for a status. Maps onto the design-system semantic
 * ramps so a status is never communicated by colour alone — the label
 * always accompanies it.
 */
export type ContractStatusTone =
  | "neutral"
  | "primary"
  | "info"
  | "warning"
  | "success"
  | "muted";

export const CONTRACT_STATUS_TONE: Record<ContractStatusGroup, ContractStatusTone> = {
  draft: "neutral",
  in_progress: "primary",
  generated: "info",
  under_review: "warning",
  approved: "success",
  exported: "success",
  archived: "muted",
};

/** Tailwind classes for a status badge, keyed by tone. */
export const STATUS_TONE_CLASSES: Record<ContractStatusTone, string> = {
  neutral: "bg-surface-container text-on-surface",
  primary: "bg-primary-container text-primary-on-container",
  info: "bg-info-50 text-info-700",
  warning: "bg-warning-50 text-warning-700",
  success: "bg-success-50 text-success-700",
  muted: "bg-surface-container text-muted",
};

/** The dot colour inside a status badge, keyed by tone. */
export const STATUS_DOT_CLASSES: Record<ContractStatusTone, string> = {
  neutral: "bg-on-surface-variant",
  primary: "bg-primary",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  muted: "bg-on-surface-variant/50",
};

// ------------------------------------------------------------
// Raw state → shared bucket
// ------------------------------------------------------------

const PROPERTY_STATE_GROUP: Record<PropertyContractState, ContractStatusGroup> = {
  DRAFT: "draft",
  PARTIES_PENDING: "in_progress",
  PROPERTY_PENDING: "in_progress",
  DOCUMENTS_PENDING: "in_progress",
  TERMS_PENDING: "in_progress",
  READY_FOR_REVIEW: "under_review",
  COUNTERPARTY_REVIEW: "under_review",
  CHANGES_REQUESTED: "in_progress",
  READY_TO_SIGN: "approved",
  PARTIALLY_SIGNED: "approved",
  SIGNED: "approved",
  READY_FOR_OFFICIAL_REGISTRATION: "exported",
  FINALIZED: "exported",
  CANCELLED: "archived",
  ARCHIVED: "archived",
};

const V1_STATE_GROUP: Record<V1ContractState, ContractStatusGroup> = {
  draft: "draft",
  collecting: "in_progress",
  generated: "generated",
  under_review: "under_review",
  approved: "approved",
  exported: "exported",
  archived: "archived",
};

/** Map a Contract-OS state onto the shared bucket. */
export function statusGroupForPropertyState(state: PropertyContractState): ContractStatusGroup {
  return PROPERTY_STATE_GROUP[state] ?? "draft";
}

/** Map a legacy V1 state onto the shared bucket. */
export function statusGroupForV1State(state: V1ContractState): ContractStatusGroup {
  return V1_STATE_GROUP[state] ?? "draft";
}

/** True when the contract still has work the user can resume. */
export function isActionableStatus(group: ContractStatusGroup): boolean {
  return group === "draft" || group === "in_progress";
}

/** True when the contract is finished and only readable. */
export function isReadOnlyStatus(group: ContractStatusGroup): boolean {
  return group === "approved" || group === "exported" || group === "archived";
}

/**
 * The primary action label for a status — the single verb the card
 * offers. Kept here so every card in the list agrees on the wording.
 */
export function primaryActionLabel(group: ContractStatusGroup): string {
  switch (group) {
    case "draft":
      return "ادامه تکمیل";
    case "in_progress":
      return "ادامه";
    case "generated":
      return "مشاهده قرارداد";
    case "under_review":
      return "مشاهده وضعیت";
    case "approved":
      return "مشاهده نسخه نهایی";
    case "exported":
      return "دانلود مجدد";
    case "archived":
      return "مشاهده";
  }
}

/** The high-level groups the "all" view is organised into. */
export const MY_CONTRACTS_GROUPS: {
  key: string;
  titleFa: string;
  statuses: ContractStatusGroup[];
}[] = [
  { key: "needs-work", titleFa: "نیازمند ادامه", statuses: ["draft", "in_progress"] },
  { key: "in-review", titleFa: "در حال بررسی", statuses: ["generated", "under_review"] },
  { key: "ready", titleFa: "قراردادهای آماده", statuses: ["approved", "exported"] },
  { key: "archived", titleFa: "بایگانی", statuses: ["archived"] },
];
