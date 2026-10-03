// ============================================================
// LEGALIR — Contract status presentation model
// ============================================================
// A contract has SEVERAL independent axes, and the old single chip row
// conflated them. This module keeps them apart, because they answer
// different questions and change for different reasons:
//
//   • DRAFT status   — how far along is the DOCUMENT itself?
//                      (started → in progress → ready)
//   • ANALYSIS status — what did the AI review of a FIXED version say?
//                      (not reviewed → running → ready → needs re-review → error)
//   • ARCHIVE status — is the contract active or filed away?
//   • EXPORT         — an EVENT (a file was downloaded), not a lifecycle.
//
// Two raw lifecycles feed the draft axis:
//   • the Contract Operating System (`PropertyContractState`, 15 states)
//   • the legacy V1 workspace (`V1ContractState`, 7 states)
//
// The UI never branches on a raw state string; it reads these axes.
//
// IMPORTANT — the words «تأیید شده» and «آماده» describe the DOCUMENT
// (the user confirmed the text / the text is complete). They are NEVER
// a legal approval, and they are NEVER the AI analysis result. The
// analysis axis is the only place an AI verdict appears, and it is
// always labelled as AI analysis.
// ============================================================

import type { PropertyContractState, V1ContractState } from "@legalir/types";

// ------------------------------------------------------------
// Axis 1 — draft status (the document)
// ------------------------------------------------------------

/**
 * How far along the document is. Deliberately coarse: the user cares
 * about "can I still work on it" and "is the text done", not about the
 * 15 internal states.
 */
export type ContractDraftStatus = "started" | "in_progress" | "ready";

export const CONTRACT_DRAFT_STATUS_ORDER: ContractDraftStatus[] = [
  "started",
  "in_progress",
  "ready",
];

export const CONTRACT_DRAFT_STATUS_LABELS: Record<ContractDraftStatus, string> = {
  started: "شروع‌شده",
  in_progress: "در حال تکمیل",
  ready: "متن آماده",
};

/** A short, plain-language hint shown under the status in a card. */
export const CONTRACT_DRAFT_STATUS_HINTS: Record<ContractDraftStatus, string> = {
  started: "اطلاعات اولیه ثبت شده است",
  in_progress: "در حال تکمیل اطلاعات قرارداد",
  ready: "متن قرارداد آماده است",
};

// ------------------------------------------------------------
// Axis 2 — analysis status (the AI review of a fixed version)
// ------------------------------------------------------------

/**
 * The state of the AI review. `needs_re_review` is the important one:
 * the document changed after the last analysis, so the stored result
 * describes a version that no longer exists and must not be shown as
 * the current verdict.
 */
export type ContractAnalysisStatus =
  | "not_reviewed"
  | "running"
  | "ready"
  | "needs_re_review"
  | "error";

export const CONTRACT_ANALYSIS_STATUS_ORDER: ContractAnalysisStatus[] = [
  "not_reviewed",
  "running",
  "ready",
  "needs_re_review",
  "error",
];

export const CONTRACT_ANALYSIS_STATUS_LABELS: Record<ContractAnalysisStatus, string> = {
  not_reviewed: "بررسی‌نشده",
  running: "در حال بررسی",
  ready: "نتیجه آماده",
  needs_re_review: "نیازمند بررسی مجدد",
  error: "خطا در بررسی",
};

export const CONTRACT_ANALYSIS_STATUS_HINTS: Record<ContractAnalysisStatus, string> = {
  not_reviewed: "هنوز با هوش مصنوعی بررسی نشده است",
  running: "بررسی هوش مصنوعی در حال انجام است",
  ready: "نتیجه بررسی برای نسخه فعلی آماده است",
  needs_re_review: "سند پس از بررسی تغییر کرده است",
  error: "بررسی با خطا مواجه شد",
};

// ------------------------------------------------------------
// Axis 3 — archive status
// ------------------------------------------------------------

export type ContractArchiveStatus = "active" | "archived";

export const CONTRACT_ARCHIVE_STATUS_LABELS: Record<ContractArchiveStatus, string> = {
  active: "فعال",
  archived: "بایگانی",
};

// ------------------------------------------------------------
// Semantic tone (shared by every axis)
// ------------------------------------------------------------

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
  | "muted"
  | "error";

export const CONTRACT_DRAFT_STATUS_TONE: Record<ContractDraftStatus, ContractStatusTone> = {
  started: "neutral",
  in_progress: "primary",
  ready: "info",
};

export const CONTRACT_ANALYSIS_STATUS_TONE: Record<ContractAnalysisStatus, ContractStatusTone> = {
  not_reviewed: "muted",
  running: "info",
  ready: "success",
  needs_re_review: "warning",
  error: "error",
};

export const CONTRACT_ARCHIVE_STATUS_TONE: Record<ContractArchiveStatus, ContractStatusTone> = {
  active: "neutral",
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
  error: "bg-error-50 text-error-700",
};

/** The dot colour inside a status badge, keyed by tone. */
export const STATUS_DOT_CLASSES: Record<ContractStatusTone, string> = {
  neutral: "bg-on-surface-variant",
  primary: "bg-primary",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  muted: "bg-on-surface-variant/50",
  error: "bg-error",
};

// ------------------------------------------------------------
// Raw state → draft status
// ------------------------------------------------------------

const PROPERTY_STATE_DRAFT: Record<PropertyContractState, ContractDraftStatus> = {
  DRAFT: "started",
  PARTIES_PENDING: "in_progress",
  PROPERTY_PENDING: "in_progress",
  DOCUMENTS_PENDING: "in_progress",
  TERMS_PENDING: "in_progress",
  CHANGES_REQUESTED: "in_progress",
  READY_FOR_REVIEW: "ready",
  COUNTERPARTY_REVIEW: "ready",
  READY_TO_SIGN: "ready",
  PARTIALLY_SIGNED: "ready",
  SIGNED: "ready",
  READY_FOR_OFFICIAL_REGISTRATION: "ready",
  FINALIZED: "ready",
  CANCELLED: "started",
  ARCHIVED: "ready",
};

const V1_STATE_DRAFT: Record<V1ContractState, ContractDraftStatus> = {
  draft: "started",
  collecting: "in_progress",
  generated: "ready",
  under_review: "ready",
  approved: "ready",
  exported: "ready",
  archived: "ready",
};

/** Map a Contract-OS state onto the draft axis. */
export function draftStatusForPropertyState(state: PropertyContractState): ContractDraftStatus {
  return PROPERTY_STATE_DRAFT[state] ?? "started";
}

/** Map a legacy V1 state onto the draft axis. */
export function draftStatusForV1State(state: V1ContractState): ContractDraftStatus {
  return V1_STATE_DRAFT[state] ?? "started";
}

// ------------------------------------------------------------
// Raw state → archive status
// ------------------------------------------------------------

/** True when the raw Contract-OS state means "filed away". */
export function isArchivedPropertyState(state: PropertyContractState): boolean {
  return state === "ARCHIVED" || state === "CANCELLED";
}

/** True when the raw V1 state means "filed away". */
export function isArchivedV1State(state: V1ContractState): boolean {
  return state === "archived";
}

// ------------------------------------------------------------
// Derived predicates
// ------------------------------------------------------------

/** True when the contract still has work the user can resume. */
export function isActionableDraft(status: ContractDraftStatus): boolean {
  return status === "started" || status === "in_progress";
}

/** True when the document text is complete and only readable. */
export function isReadyDraft(status: ContractDraftStatus): boolean {
  return status === "ready";
}

/**
 * The primary action label for a contract, derived from BOTH the draft
 * axis and the analysis axis. The analysis axis wins when it has
 * something actionable to say (a stale or failed review), because that
 * is the more urgent next step; otherwise the draft axis decides.
 *
 * This is the single verb the card offers, so every card agrees.
 */
export function primaryActionLabel(
  draft: ContractDraftStatus,
  analysis: ContractAnalysisStatus = "not_reviewed",
  archived = false
): string {
  if (archived) return "مشاهده";
  if (analysis === "running") return "مشاهده پیشرفت بررسی";
  if (analysis === "needs_re_review") return "بررسی نسخه جدید";
  if (analysis === "error") return "تلاش مجدد بررسی";
  if (analysis === "ready") return "مشاهده نتیجه بررسی";
  switch (draft) {
    case "started":
      return "ادامه تکمیل";
    case "in_progress":
      return "ادامه تکمیل";
    case "ready":
      return "مشاهده و ویرایش";
  }
}

// ------------------------------------------------------------
// Top-level tabs (the «همه» view)
// ------------------------------------------------------------

/**
 * The four top-level tabs. These are the ONLY lifecycle buckets the
 * user sees as tabs; the finer axes live under «فیلترهای بیشتر».
 */
export type ContractTab = "all" | "needs_work" | "ready" | "archived";

export interface ContractTabDescriptor {
  key: ContractTab;
  labelFa: string;
}

export const CONTRACT_TABS: ContractTabDescriptor[] = [
  { key: "all", labelFa: "همه" },
  { key: "needs_work", labelFa: "نیازمند تکمیل" },
  { key: "ready", labelFa: "آماده" },
  { key: "archived", labelFa: "بایگانی" },
];

/** True when a contract belongs in the given top-level tab. */
export function matchesTab(
  tab: ContractTab,
  draft: ContractDraftStatus,
  archived: boolean
): boolean {
  switch (tab) {
    case "all":
      return true;
    case "needs_work":
      return !archived && isActionableDraft(draft);
    case "ready":
      return !archived && isReadyDraft(draft);
    case "archived":
      return archived;
  }
}

// ------------------------------------------------------------
// Backwards-compatible aliases
// ------------------------------------------------------------
// The old single-axis vocabulary is still referenced by the status
// badge and a few call sites. It is derived from the draft axis so the
// two can never disagree, and it is kept only until those call sites
// migrate to the explicit axes above.

/** @deprecated Use `ContractDraftStatus`. */
export type ContractStatusGroup = ContractDraftStatus;

/** @deprecated Use `CONTRACT_DRAFT_STATUS_ORDER`. */
export const CONTRACT_STATUS_ORDER = CONTRACT_DRAFT_STATUS_ORDER;

/** @deprecated Use `CONTRACT_DRAFT_STATUS_LABELS`. */
export const CONTRACT_STATUS_LABELS = CONTRACT_DRAFT_STATUS_LABELS;

/** @deprecated Use `CONTRACT_DRAFT_STATUS_HINTS`. */
export const CONTRACT_STATUS_HINTS = CONTRACT_DRAFT_STATUS_HINTS;

/** @deprecated Use `CONTRACT_DRAFT_STATUS_TONE`. */
export const CONTRACT_STATUS_TONE = CONTRACT_DRAFT_STATUS_TONE;

/** @deprecated Use `draftStatusForPropertyState`. */
export const statusGroupForPropertyState = draftStatusForPropertyState;

/** @deprecated Use `draftStatusForV1State`. */
export const statusGroupForV1State = draftStatusForV1State;

/** @deprecated Use `isActionableDraft`. */
export const isActionableStatus = isActionableDraft;

/** @deprecated Use `isReadyDraft`. */
export const isReadOnlyStatus = isReadyDraft;

/** @deprecated Use `CONTRACT_TABS`. */
export const MY_CONTRACTS_GROUPS: {
  key: string;
  titleFa: string;
  statuses: ContractDraftStatus[];
}[] = [
  { key: "needs-work", titleFa: "نیازمند ادامه", statuses: ["started", "in_progress"] },
  { key: "ready", titleFa: "قراردادهای آماده", statuses: ["ready"] },
];
