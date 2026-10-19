// ============================================================
// LEGALIR — Judicial documents family (تنظیم و پیگیری اوراق قضایی)
// ============================================================
// Domain types for the four judicial sub-services:
//   1. judicial_statement        — اظهارنامه قضایی
//   2. judicial_brief            — لایحه
//   3. judicial_criminal_record  — گواهی عدم سوءپیشینه (needs a real provider)
//   4. judicial_credit_check     — استعلام اعتبار معاملاتی (needs consent + OTP)
//
// Rules encoded here:
//   • availability is DATA (service config + feature flag), never a hard-coded
//     UI constant — a provider-dependent service stays `soon`/`unavailable`
//     until the real integration exists;
//   • every request is owner-scoped; attachments reference an existing
//     `documents` row and are re-authorized on every access;
//   • questionnaires are versioned and stored with each request so an old
//     request always resolves against the schema it was filled with;
//   • draft versions are immutable snapshots — regenerating adds a version,
//     it never overwrites the previous text.
// ============================================================

import type { ActivityType } from "./index";

export const JUDICIAL_FAMILY_ID = "judicial_documents";

export type JudicialServiceId =
  | "judicial_statement"
  | "judicial_brief"
  | "judicial_petition"
  | "judicial_complaint"
  | "judicial_criminal_record"
  | "judicial_credit_check";

/** The four document families with a drafting flow. */
export type JudicialDocumentType = "statement" | "brief" | "petition" | "complaint";

export const JUDICIAL_DOCUMENT_TYPES: readonly JudicialDocumentType[] = [
  "statement",
  "brief",
  "petition",
  "complaint",
] as const;

export const JUDICIAL_DOCUMENT_TYPE_FA: Record<JudicialDocumentType, string> = {
  statement: "اظهارنامه قضایی",
  brief: "لایحه",
  petition: "دادخواست حقوقی",
  complaint: "شکواییه کیفری",
};

export const JUDICIAL_SERVICE_FA: Record<JudicialServiceId, string> = {
  judicial_statement: "اظهارنامه قضایی",
  judicial_brief: "لایحه",
  judicial_petition: "دادخواست حقوقی",
  judicial_complaint: "شکواییه کیفری",
  judicial_criminal_record: "گواهی عدم سوءپیشینه",
  judicial_credit_check: "استعلام اعتبار معاملاتی",
};

/**
 * The single honest status vocabulary. `available` means the real capability
 * exists; `request_only` means the service accepts a tracked request that a
 * Ligalir operator processes (the certificate/result itself is issued by an
 * external authority, and this product never pretends to issue it); `soon`
 * means the page explains why and offers no fake action; `unavailable` means
 * it is switched off entirely.
 */
export type JudicialServiceStatus =
  | "available"
  | "request_only"
  | "soon"
  | "unavailable";

export const JUDICIAL_STATUS_FA: Record<JudicialServiceStatus, string> = {
  available: "در دسترس",
  request_only: "ثبت درخواست",
  soon: "به‌زودی",
  unavailable: "در دسترس نیست",
};

/** Per-surface visibility, so admin can hide a service from one entry point. */
export interface JudicialServiceSurfaces {
  home: boolean;
  services: boolean;
  new: boolean;
  /** The /cases entry card. */
  cases: boolean;
}

/** How a run is charged. Mirrors the existing usage/subscription engine. */
export interface JudicialServiceAccess {
  mode: "free" | "subscription" | "energy";
  /** Usage-activity code charged by the backend; null for free. */
  activity: ActivityType | null;
}

/**
 * What the service physically needs to work. `internal` services are complete
 * in-product; `external` ones need a provider we have not connected — and must
 * therefore never render a submit/certificate button.
 */
export interface JudicialServiceRequirement {
  kind: "internal" | "external";
  providerFa: string | null;
  configured: boolean;
  noteFa: string | null;
}

/** The admin-editable row. One per sub-service. */
export interface JudicialServiceConfig {
  id: JudicialServiceId;
  family: typeof JUDICIAL_FAMILY_ID;
  documentType: JudicialDocumentType | null;
  order: number;
  titleFa: string;
  shortTitleFa: string;
  descriptionFa: string;
  ctaFa: string;
  status: JudicialServiceStatus;
  statusNoteFa: string | null;
  surfaces: JudicialServiceSurfaces;
  requiresAuth: boolean;
  access: JudicialServiceAccess;
  requirement: JudicialServiceRequirement;
  /** Bumped on every admin edit; recorded on requests created afterwards. */
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

/** Config projected through the feature-flag gate for one caller. */
export interface JudicialServiceView extends JudicialServiceConfig {
  flagEnabled: boolean;
  /** Effective status = config status AND flag state. */
  availability: JudicialServiceStatus;
  availabilityNoteFa: string | null;
}

// ------------------------------------------------------------
// Versioned questionnaire
// ------------------------------------------------------------

export type JudicialQuestionType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean"
  | "date"
  | "currency";

export interface JudicialQuestionOption {
  value: string;
  labelFa: string;
}

export interface JudicialQuestion {
  id: string;
  labelFa: string;
  type: JudicialQuestionType;
  required: boolean;
  placeholderFa?: string;
  helpFa?: string;
  /** Sensitive answers get an explicit "why we ask" affordance. */
  sensitive?: boolean;
  /** The concrete reason this sensitive answer is needed, shown on demand. */
  whyFa?: string;
  options?: JudicialQuestionOption[];
  /** Conditional visibility, e.g. only show "court" when "already filed". */
  showWhen?: { field: string; equals: string | string[] };
}

export interface JudicialQuestionnaireStep {
  id: string;
  titleFa: string;
  descriptionFa?: string;
  fields: JudicialQuestion[];
}

export type JudicialQuestionnaireStatus = "draft" | "published" | "retired";

export interface JudicialQuestionnaire {
  /** Stable id, e.g. "statement:v1". */
  id: string;
  documentType: JudicialDocumentType;
  version: number;
  status: JudicialQuestionnaireStatus;
  titleFa: string;
  descriptionFa: string;
  steps: JudicialQuestionnaireStep[];
  /** Shown above the draft — "AI draft, not a filed document". */
  disclaimerFa: string;
  createdAt: string;
  createdBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface JudicialQuestionnaireRef {
  id: string;
  version: number;
}

// ------------------------------------------------------------
// Request + workflow
// ------------------------------------------------------------

/** Two start paths: let AI draft, or bring a finished document. */
export type JudicialStartMode = "ai_draft" | "ready_document";

/**
 * The workflow states. NO state means "filed", "sent" or "submitted" — the
 * product never claims a judicial act it cannot perform.
 */
export type JudicialRequestStatus =
  | "draft"
  | "collecting"
  | "needs_answers"
  | "ready_to_generate"
  | "generating"
  | "draft_ready"
  | "ready_to_review"
  | "under_review"
  | "needs_correction"
  | "approved"
  | "finalized"
  | "cancelled"
  | "archived";

/**
 * The owner-facing status vocabulary. `approved` means Ligalir approved the
 * exact submitted version and the final artifact was issued; `finalized`
 * means the owner confirmed receipt and the request was closed. No status
 * ever claims a document was filed or served.
 */
export const JUDICIAL_REQUEST_STATUS_FA: Record<JudicialRequestStatus, string> = {
  draft: "پیش‌نویس",
  collecting: "در حال تکمیل",
  needs_answers: "نیازمند تکمیل اطلاعات",
  ready_to_generate: "آمادهٔ تنظیم پیش‌نویس",
  generating: "در حال تنظیم پیش‌نویس",
  draft_ready: "پیش‌نویس آمادهٔ بازبینی",
  ready_to_review: "آمادهٔ بررسی",
  under_review: "در انتظار بررسی وکیل یا لیگالیر",
  needs_correction: "نیازمند اصلاح",
  approved: "تأییدشده",
  finalized: "تکمیل‌شده",
  cancelled: "لغو شده",
  archived: "بایگانی‌شده",
};

/**
 * Legal transitions, enforced server-side. Anything not listed is rejected
 * with 409 — the client can request a move but never force one.
 *
 * The review lane is explicit: only `submit-review` can move a request into
 * `under_review`, only an admin decision can move it to `approved` (and that
 * decision issues the final artifact), and only the owner can confirm
 * receipt (`finalized`).
 */
export const JUDICIAL_TRANSITIONS: Record<
  JudicialRequestStatus,
  readonly JudicialRequestStatus[]
> = {
  draft: ["collecting", "cancelled"],
  // `ready_to_review` is reachable directly from collection ONLY on the
  // ready-document path, where the user brought a finished document and no
  // AI draft is produced; the route enforces the presence of that document.
  collecting: ["needs_answers", "ready_to_generate", "ready_to_review", "cancelled"],
  needs_answers: ["collecting", "ready_to_generate", "ready_to_review", "cancelled"],
  ready_to_generate: ["generating", "needs_answers", "cancelled"],
  generating: ["draft_ready", "ready_to_generate", "cancelled"],
  draft_ready: ["ready_to_review", "needs_correction", "generating", "cancelled"],
  ready_to_review: ["under_review", "needs_correction", "generating", "cancelled"],
  under_review: ["needs_correction", "approved", "cancelled"],
  needs_correction: [
    "collecting",
    "needs_answers",
    "ready_to_generate",
    "ready_to_review",
    "under_review",
    "generating",
    "cancelled",
  ],
  approved: ["finalized", "archived", "under_review"],
  finalized: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

export function canTransitionJudicialRequest(
  from: JudicialRequestStatus,
  to: JudicialRequestStatus
): boolean {
  return JUDICIAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export type JudicialRequestStep =
  | "kind"
  | "narrative"
  | "questionnaire"
  | "documents"
  | "analysis"
  | "review";

export const JUDICIAL_STEP_FA: Record<JudicialRequestStep, string> = {
  kind: "نوع درخواست",
  narrative: "روایت درخواست",
  questionnaire: "پرسش‌نامه",
  documents: "مدارک",
  analysis: "جمع‌بندی و تحلیل",
  review: "پیش‌نویس و بازبینی",
};

// ------------------------------------------------------------
// Routing (a PROBABLE path, never a definitive diagnosis)
// ------------------------------------------------------------

export type JudicialConfidence = "low" | "medium" | "high";

/**
 * The suggested document family. `basis: "user_choice"` means the user picked
 * it; `"derived"` means it was inferred from their words and is explicitly
 * NOT definitive. `suggested: "undetermined"` is the honest answer when the
 * civil/criminal boundary cannot be resolved from what was said.
 */
export interface JudicialRouting {
  suggested: JudicialDocumentType | "undetermined";
  basis: "user_choice" | "derived";
  /** Never "high" for a derived suggestion. */
  confidence: JudicialConfidence;
  /** Always phrased as a probability, never as a verdict. */
  reasonFa: string;
  /** The concrete signals that produced the suggestion (user-visible). */
  factorsFa: string[];
  /** True when the boundary genuinely needs the user's clarification. */
  needsClarification: boolean;
  clarificationFa: string | null;
  decidedAt: string;
}

// ------------------------------------------------------------
// Analysis (step 4 framing — kept separate from the draft text)
// ------------------------------------------------------------
// The brief requires four things stay distinguishable: what the user said,
// what was extracted from their documents, what the AI inferred, and what is
// still unconfirmed. Each field below names its own provenance.

export interface JudicialAnalysisParty {
  roleFa: string;
  nameFa: string;
  /** Names come from the user's answers — never invented. */
  source: "answer" | "document";
}

export interface JudicialAnalysis {
  likelyType: JudicialDocumentType | "undetermined";
  confidence: JudicialConfidence;
  reasonFa: string;
  /** Restatements of the user's own words. */
  statementsFa: string[];
  parties: JudicialAnalysisParty[];
  subjectFa: string | null;
  demandFa: string | null;
  chronologyFa: string[];
  evidenceFa: string[];
  /** What must be answered before a draft can be produced. */
  missingFa: string[];
  ambiguitiesFa: string[];
  /** Items only the user can confirm (never resolved by the model). */
  mustVerifyFa: string[];
  sources: JudicialDraftReference[];
  generatedAt: string;
}

/** A document the user brought in the "ready document" path. */
export interface JudicialReadyDocumentRef {
  documentId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** The user confirmed the extracted text looks right, if extraction ran. */
  textReviewed: boolean;
}

export interface JudicialRequest {
  id: string;
  userId: string;
  serviceId: JudicialServiceId;
  /** Null until the user (or a clarified suggestion) fixes the family. */
  documentType: JudicialDocumentType | null;
  /** The probable path, with its confidence and the reason for it. */
  routing: JudicialRouting | null;
  startMode: JudicialStartMode;
  status: JudicialRequestStatus;
  currentStep: JudicialRequestStep;
  titleFa: string;
  /** The user's own words — never rewritten without permission. */
  narrative: string;
  narrativeUpdatedAt: string | null;
  questionnaireId: string;
  questionnaireVersion: number;
  /** Flat answers keyed by question id, for fast visibility re-evaluation. */
  answers: Record<string, string>;
  readyDocument: JudicialReadyDocumentRef | null;
  caseId: string | null;
  userConfirmed: boolean;
  /** The last recoverable failure, surfaced honestly (never a stack trace). */
  lastErrorFa: string | null;
  /** Client-generated uuid; a retried create returns the original row. */
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
}

/** One answer row per question, kept for editing/audit granularity. */
export interface JudicialQuestionnaireResponse {
  id: string;
  requestId: string;
  userId: string;
  questionnaireId: string;
  questionnaireVersion: number;
  stepId: string;
  questionId: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// Attachments
// ------------------------------------------------------------

export type JudicialAttachmentRole =
  | "evidence"
  | "prior_notice"
  | "court_order"
  | "identity"
  | "other";

export const JUDICIAL_ATTACHMENT_ROLE_FA: Record<JudicialAttachmentRole, string> = {
  evidence: "دلیل و مستند",
  prior_notice: "اظهارنامه پیشین",
  court_order: "دادنامه / قرار",
  identity: "مدرک هویتی",
  other: "سایر",
};

export interface JudicialAttachment {
  id: string;
  requestId: string;
  userId: string;
  /** FK to the existing `documents` table — never a copied file. */
  documentId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  role: JudicialAttachmentRole;
  linkedAt: string;
  /** Soft delete, matching the project's archive pattern. */
  removedAt: string | null;
}

// ------------------------------------------------------------
// Draft versions
// ------------------------------------------------------------

export type JudicialDraftStatus = "draft" | "approved" | "superseded";

export interface JudicialDraftReference {
  sourceId: string;
  title: string;
  locator: string;
  tierFa: string;
}

/** Exactly the inputs that produced a version — makes a draft reproducible. */
export interface JudicialDraftInputSnapshot {
  narrative: string;
  answers: Record<string, string>;
  attachmentIds: string[];
  attachmentNames: string[];
  questionnaireVersion: number;
  serviceId: JudicialServiceId;
  documentType: JudicialDocumentType;
  startMode: JudicialStartMode;
  readyDocumentName: string | null;
}

/**
 * Which producer wrote the text. `structured_composer` assembles ONLY the
 * user's own confirmed facts into the document skeleton — it is what runs
 * when no real model is configured. `model_refined` means a configured
 * provider actually wrote the prose. `user_edited` means the owner rewrote a
 * version by hand. The three are never conflated.
 */
export type JudicialDraftGenerator =
  | "structured_composer"
  | "model_refined"
  | "user_edited"
  | "admin_revised";

export const JUDICIAL_DRAFT_GENERATOR_FA: Record<JudicialDraftGenerator, string> = {
  structured_composer: "چیدمان ساختاریافته از پاسخ‌های شما",
  model_refined: "بازنویسی با مدل هوش مصنوعی",
  user_edited: "ویرایش‌شده به‌دست شما",
  admin_revised: "نسخهٔ اصلاح‌شدهٔ واحد بررسی لیگالیر",
};

export interface JudicialDraftVersion {
  id: string;
  requestId: string;
  userId: string;
  version: number;
  status: JudicialDraftStatus;
  generator: JudicialDraftGenerator;
  text: string;
  /** sha256 of inputSnapshot — identical inputs never cost twice. */
  inputHash: string;
  inputSnapshot: JudicialDraftInputSnapshot;
  references: JudicialDraftReference[];
  warnings: string[];
  /** Contradictions / unclear items the composer could not settle. */
  ambiguitiesFa: string[];
  provider: string;
  providerConfigured: boolean;
  model: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

// ------------------------------------------------------------
// Completeness (server-computed, drives the "ask instead of generate" rule)
// ------------------------------------------------------------

export interface JudicialMissingField {
  fieldId: string;
  labelFa: string;
  reasonFa: string;
}

export interface JudicialCompleteness {
  complete: boolean;
  missing: JudicialMissingField[];
  contradictions: string[];
  /** True while the civil/criminal boundary is still undetermined. */
  routingUndetermined: boolean;
}

// ------------------------------------------------------------
// Review lane (لیگالیر / وکیل) — one review per submitted version
// ------------------------------------------------------------
// A review is bound to ONE immutable submitted version (`documentHash` of the
// draft text the owner sent). If the text changes, the user resubmits and a
// NEW review row is opened — an approval can never drift onto a version the
// reviewer did not read.

export type JudicialReviewKind = "legalir" | "lawyer";

export const JUDICIAL_REVIEW_KIND_FA: Record<JudicialReviewKind, string> = {
  legalir: "بررسی لیگالیر",
  lawyer: "نظر وکیل",
};

export type JudicialReviewStatus =
  /** Awaiting an operator. */
  | "pending"
  /** Being worked on. */
  | "in_progress"
  /** Waiting for an answer, file or confirmation from the owner. */
  | "waiting_user"
  /** Returned to the owner with corrections. */
  | "changes_requested"
  /** The submitted version was approved and the final artifact issued. */
  | "approved"
  /** The owner's submission was rejected (not a draft-quality issue). */
  | "rejected"
  /** Withdrawn by the owner before a decision. */
  | "cancelled";

export const JUDICIAL_REVIEW_STATUS_FA: Record<JudicialReviewStatus, string> = {
  pending: "در انتظار بررسی",
  in_progress: "در حال بررسی",
  waiting_user: "منتظر پاسخ شما",
  changes_requested: "نیازمند اصلاح",
  approved: "تأییدشده",
  rejected: "رد شده",
  cancelled: "لغو شده",
};

/** Terminal statuses — no further decision is possible. */
export const JUDICIAL_REVIEW_TERMINAL: readonly JudicialReviewStatus[] = [
  "approved",
  "rejected",
  "cancelled",
] as const;

export type JudicialReviewEventKind =
  | "submitted"
  | "assigned"
  | "note"
  | "change_request"
  | "approval_note"
  | "revision"
  | "user_reply"
  | "resubmitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "final_issued"
  | "status_changed";

/**
 * One entry in the review's history. Append-only: nothing here is ever
 * edited or removed, so the owner and the operator read the same record.
 */
export interface JudicialReviewEvent {
  id: string;
  reviewId: string;
  requestId: string;
  kind: JudicialReviewEventKind;
  /** `admin` events are hidden from the owner unless `visibleToOwner`. */
  authorKind: "owner" | "admin" | "lawyer" | "system";
  /** Public-safe label (display name or organising office), never a user id. */
  authorLabelFa: string;
  /** Body for notes/corrections/replies. */
  bodyFa: string | null;
  /**
   * When false the event is an INTERNAL operator note: it appears in the
   * admin timeline only and must never be projected into the owner payload
   * nor into the final PDF.
   */
  visibleToOwner: boolean;
  /** Draft version this event refers to, when applicable. */
  versionId: string | null;
  versionNumber: number | null;
  createdAt: string;
}

export interface JudicialReview {
  id: string;
  requestId: string;
  userId: string;
  kind: JudicialReviewKind;
  status: JudicialReviewStatus;
  /** Exactly the version the owner submitted — approval binds to this. */
  submittedVersionId: string;
  submittedVersionNumber: number;
  /** sha256 of the submitted text; any later edit invalidates approval. */
  submittedTextHash: string;
  /** Snapshot of what the owner sent, so the admin reads the same text. */
  submittedText: string;
  serviceId: JudicialServiceId;
  documentType: JudicialDocumentType | null;
  /** The owner's question, in their own words. */
  noteFa: string | null;
  /** Display name of the operator the review is assigned to. */
  assignedToUserId: string | null;
  assignedToLabelFa: string | null;
  /** The operator's decision note, shown to the owner on request-changes. */
  decisionNoteFa: string | null;
  /** Bound lawyer request, for the "ارجاع به وکیل" path. */
  lawyerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedByLabelFa: string | null;
}

export interface JudicialReviewDetail extends JudicialReview {
  events: JudicialReviewEvent[];
  /** Admin-only: internal notes are included only in this projection. */
  internalEvents?: JudicialReviewEvent[];
}

/** The submit-review request body. */
export interface JudicialSubmitReviewInput {
  draftId: string;
  note?: string;
  kind?: JudicialReviewKind;
  idempotencyKey: string;
}

/** Actions an operator can take on a review. */
export type JudicialReviewAction =
  | "assign"
  | "note"
  | "request_changes"
  | "approve"
  | "reject"
  | "cancel";

export const JUDICIAL_REVIEW_ACTION_FA: Record<JudicialReviewAction, string> = {
  assign: "تخصیص به کارشناس",
  note: "ثبت یادداشت / پاسخ",
  request_changes: "درخواست اصلاح",
  approve: "تأیید و صدور نسخهٔ نهایی",
  reject: "رد درخواست",
  cancel: "لغو بررسی",
};

// ------------------------------------------------------------
// Service orders (گواهی عدم سوءپیشینه / استعلام اعتبار معاملاتی)
// ------------------------------------------------------------
// These two services cannot be fulfilled inside the product: the certificate
// or credit report is issued by an external authority. What the product DOES
// own — and what this record is — is the request: the applicant's details,
// the declared purpose, the attached documents, the operator's processing
// notes and the eventual outcome. The status vocabulary never claims a
// certificate was issued by Ligalir.

export type JudicialOrderStatus =
  | "draft"
  | "submitted"
  | "in_progress"
  | "waiting_user"
  | "ready"
  | "delivered"
  | "rejected"
  | "cancelled";

export const JUDICIAL_ORDER_STATUS_FA: Record<JudicialOrderStatus, string> = {
  draft: "پیش‌نویس",
  submitted: "ثبت‌شده — در انتظار بررسی",
  in_progress: "در حال پیگیری",
  waiting_user: "نیازمند اقدام شما",
  ready: "آمادهٔ تحویل",
  delivered: "تحویل‌شده",
  rejected: "رد شده",
  cancelled: "لغو شده",
};

export interface JudicialOrderAnswer {
  fieldId: string;
  labelFa: string;
  value: string;
}

export interface JudicialOrder {
  id: string;
  userId: string;
  serviceId: JudicialServiceId;
  status: JudicialOrderStatus;
  /** What the applicant asked for, in one line. */
  titleFa: string;
  /** The form fields this service actually collected. */
  answers: JudicialOrderAnswer[];
  noteFa: string | null;
  /** Declared lawful purpose (credit check) / delivery note. */
  purposeFa: string | null;
  attachmentIds: string[];
  assignedToUserId: string | null;
  assignedToLabelFa: string | null;
  /** Operator note visible to the owner (never internal notes). */
  operatorNoteFa: string | null;
  /** The delivered artifact, when the operator attached one. */
  deliveryDocumentId: string | null;
  deliveryNameFa: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  deliveredAt: string | null;
}

// ------------------------------------------------------------
// Final document (issued only after an admin approval)
// ------------------------------------------------------------

export interface JudicialFinalDocument {
  id: string;
  requestId: string;
  userId: string;
  /** Human-readable unique serial, e.g. «LGR-JD-1405-000123». */
  serialFa: string;
  /** The exact draft version this artifact renders. */
  versionId: string;
  versionNumber: number;
  /** sha256 of the text — must match the approved review's hash. */
  documentHash: string;
  /** sha256 of the generated PDF bytes. */
  pdfHash: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  issuedAt: string;
  issuedByLabelFa: string;
  reviewId: string;
  /** Public-safe initials of the approving operator. */
  approvedByInitials: string | null;
  /** Storage key inside the private contract-document root. */
  storageKey: string;
  /** Number of pages the artifact was rendered with. */
  pageCount: number;
}

// ------------------------------------------------------------
// Delivery methods for the finished draft
// ------------------------------------------------------------

export type JudicialDeliveryMethod = "none" | "lawyer" | "legalir";

export const JUDICIAL_DELIVERY_METHOD_FA: Record<JudicialDeliveryMethod, string> = {
  none: "بدون ارجاع",
  lawyer: "ارجاع به وکیل",
  legalir: "ارسال به بررسی لیگالیر",
};

// ------------------------------------------------------------
// Status history (append-only) — owner-visible
// ------------------------------------------------------------

export interface JudicialStatusEvent {
  id: string;
  requestId: string;
  userId: string;
  fromStatus: JudicialRequestStatus | null;
  toStatus: JudicialRequestStatus;
  /** Who caused the change — display label only, never a raw user id. */
  actorLabelFa: string;
  /** Optional human-readable reason. */
  noteFa: string | null;
  createdAt: string;
}

// ------------------------------------------------------------
// API contracts
// ------------------------------------------------------------

export interface JudicialServicesResponse {
  items: JudicialServiceView[];
}

/**
 * What the /cases entry card needs, in ONE request: the admin-managed
 * settings, the caller's effective availability, and their own open work.
 * A card that cannot reach this endpoint renders its unavailable state —
 * it never shows a fake CTA.
 */
export interface JudicialServiceSummary {
  settings: JudicialServiceConfig;
  availability: {
    /** Whether the card should render at all on its configured surfaces. */
    visible: boolean;
    /** Whether the wizard may be entered right now. */
    enabled: boolean;
    statusLabelFa: string;
    noteFa: string | null;
  };
  /** Non-archived, non-approved requests, newest first. */
  openCount: number;
  latest: JudicialRequestSummary | null;
}

export interface JudicialRequestSummary {
  id: string;
  serviceId: JudicialServiceId;
  /** Null while the family is still undetermined. */
  documentType: JudicialDocumentType | null;
  status: JudicialRequestStatus;
  currentStep: JudicialRequestStep;
  titleFa: string;
  /** When the request was started — the history list's "created" column. */
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  draftCount: number;
  latestDraftVersion: number | null;
  hasApprovedDraft: boolean;
  /**
   * Whether an issued artifact exists for this request. Derived from the
   * stored final-document row (never from the status label), so the history
   * can offer «دریافت نسخهٔ نهایی» only when there is a real file to serve.
   */
  hasFinalDocument: boolean;
}

/**
 * The honest capability report for this deployment. `canFileJudicially` is
 * typed as the literal `false`: there is no authorized judicial-submission
 * integration, so no code path may ever claim one exists.
 */
export interface JudicialCapabilities {
  canDraft: boolean;
  canFileJudicially: false;
  filingNoteFa: string;
  providerConfigured: boolean;
  providerName: string;
  legalSourcesAvailable: boolean;
}

export interface JudicialListResponse<T> {
  items: T[];
  total: number;
}

/** The full detail payload a wizard step loads. */
export interface JudicialRequestDetail {
  request: JudicialRequest;
  /** The schema version THIS request was filled against, never the latest. */
  questionnaire: JudicialQuestionnaire;
  responses: JudicialQuestionnaireResponse[];
  attachments: JudicialAttachment[];
  drafts: JudicialDraftVersion[];
  completeness: JudicialCompleteness;
  analysis: JudicialAnalysis | null;
  availableTransitions: JudicialRequestStatus[];
  /** The caller's OWN cases, for the optional link picker. */
  linkableCases: { id: string; titleFa: string; internalRef: string | null }[];
  /** The owner-visible review of the CURRENTLY submitted version, if any. */
  review: JudicialReviewDetail | null;
  /** Appended status changes, oldest first. */
  statusHistory: JudicialStatusEvent[];
  /** The issued artifact; present only after an admin approval. */
  finalDocument: JudicialFinalDocument | null;
}

// ------------------------------------------------------------
// Admin review queue & operator workspace
// ------------------------------------------------------------
// These are the EXACT projections the admin dispatcher returns (built in
// `lib/judicial/admin-review.ts`). They live here so the panel and the server
// agree on ONE shape: the client renders what it is given, and never
// re-derives a label, a count or an owner identity of its own.

/** Operator-safe owner identity for a queue row. */
export interface JudicialAdminOwnerBadge {
  labelFa: string;
  /** Full E.164 — operators see the real contact; the UI decides masking. */
  mobile: string | null;
  email: string | null;
}

/** ONE row in the triage queue: labels and counters, never a draft body. */
export interface JudicialReviewQueueRow {
  id: string;
  requestId: string;
  kind: JudicialReviewKind;
  kindFa: string;
  status: JudicialReviewStatus;
  statusFa: string;
  serviceId: JudicialServiceId;
  serviceFa: string;
  documentType: JudicialDocumentType | null;
  documentTypeFa: string | null;
  titleFa: string;
  owner: JudicialAdminOwnerBadge;
  requestStatusFa: string;
  submittedVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  assignedToLabelFa: string | null;
  /** True while no decision has been recorded. */
  open: boolean;
  eventCount: number;
  hasFinalDocument: boolean;
}

export interface JudicialReviewQueueFilters {
  status?: JudicialReviewStatus | "open" | "closed" | "all";
  kind?: JudicialReviewKind | "all";
  assigned?: string;
  q?: string;
}

export interface JudicialReviewQueuePage {
  items: JudicialReviewQueueRow[];
  total: number;
  /** Computed over the UNFILTERED set so the tabs stay stable. */
  counts: {
    all: number;
    open: number;
    closed: number;
    byStatus: Record<JudicialReviewStatus, number>;
  };
}

/** One resolved answer, in the questionnaire's own wording. */
export interface JudicialAdminAnswerRow {
  questionId: string;
  labelFa: string;
  valueFa: string;
  stepTitleFa: string;
  sensitive: boolean;
}

/** The operator workspace: everything needed to judge ONE submission. */
export interface JudicialReviewDetailView {
  review: JudicialReview;
  owner: JudicialAdminOwnerBadge;
  serviceFa: string;
  documentTypeFa: string | null;
  request: {
    id: string;
    titleFa: string;
    statusFa: string;
    currentStep: string;
    updatedAt: string;
    narrative: string;
  } | null;
  /** Resolved against the questionnaire version the request was FILLED with. */
  answers: JudicialAdminAnswerRow[];
  drafts: JudicialDraftVersion[];
  attachments: {
    id: string;
    nameFa: string;
    roleFa: string;
    mime: string | null;
    sizeBytes: number | null;
  }[];
  /** The COMPLETE timeline, internal notes included (admin-only). */
  events: JudicialReviewEvent[];
  internalEvents: JudicialReviewEvent[];
  finalDocument: JudicialFinalDocument | null;
  /**
   * Operators this review may be assigned to — every staff user whose role
   * actually holds `admin:judicial:read`, so an assignment can never point at
   * a colleague who cannot open the queue.
   */
  assignableStaff: { userId: string; labelFa: string; roleFa: string }[];
}

/** The admin action body. `approve` requires the reviewed version id. */
export interface JudicialAdminReviewActionInput {
  action: JudicialReviewAction;
  /** Required for note / request_changes / reject; optional on approve. */
  noteFa?: string;
  /** Only for `assign`; null unassigns. */
  assigneeUserId?: string | null;
  /** Required for `approve`: the submitted version the operator read. */
  versionId?: string;
  /** Optional corrected text, stored as a new version. */
  revisedText?: string;
  /** `true` keeps the note out of every owner projection. */
  internalNote?: boolean;
}

export interface JudicialAdminReviewActionResponse {
  review: JudicialReview;
  /** Present only when this action issued the final artifact. */
  finalDocument: { serialFa: string } | null;
}

/** ONE row in the tracked-order queue (the two provider services). */
export interface JudicialOrderQueueRow {
  id: string;
  serviceId: JudicialServiceId;
  serviceFa: string;
  status: JudicialOrderStatus;
  statusFa: string;
  titleFa: string;
  owner: JudicialAdminOwnerBadge;
  answers: JudicialOrderAnswer[];
  noteFa: string | null;
  purposeFa: string | null;
  attachmentIds: string[];
  assignedToLabelFa: string | null;
  operatorNoteFa: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  deliveredAt: string | null;
  deliveryNameFa: string | null;
}

export interface JudicialOrderQueueFilters {
  status?: JudicialOrderStatus | "open" | "all";
  serviceId?: JudicialServiceId;
  q?: string;
}

export interface JudicialOrderQueuePage {
  items: JudicialOrderQueueRow[];
  total: number;
  counts: { all: number; open: number };
}

/** The admin update body for a tracked order. */
export interface JudicialAdminOrderUpdateInput {
  status?: JudicialOrderStatus;
  assignedToUserId?: string | null;
  operatorNoteFa?: string | null;
  deliveryDocumentId?: string | null;
  deliveryNameFa?: string | null;
}

// ------------------------------------------------------------
// Entry availability per service
// ------------------------------------------------------------
// A single projection the two /cases cards and the discovery surfaces read:
// whether the service can be STARTED right now, and which real entry route
// it leads to. `request_only` services lead to the order intake, `available`
// drafting services lead to the wizard, and anything else offers no action.

export interface JudicialEntryAvailability {
  serviceId: JudicialServiceId;
  titleFa: string;
  shortTitleFa: string;
  descriptionFa: string;
  ctaFa: string;
  status: JudicialServiceStatus;
  /** The EFFECTIVE status after flags + requirements. */
  availability: JudicialServiceStatus;
  /** True when a start action exists right now. */
  enabled: boolean;
  /** Real route, or null when the service cannot be entered. */
  href: string | null;
  noteFa: string | null;
  openCount: number;
}

export interface JudicialCreateRequestInput {
  serviceId: JudicialServiceId;
  startMode: JudicialStartMode;
  /** Which family the user picked; omitted means "don't know". */
  documentType?: JudicialDocumentType | null;
  narrative?: string;
  titleFa?: string;
  /** Optional link to one of the caller's OWN internal cases. */
  caseId?: string | null;
  narrativeFromCase?: boolean;
  /** Client-generated uuid — makes creation idempotent on retry. */
  idempotencyKey: string;
}

export interface JudicialUpdateRequestInput {
  narrative?: string;
  currentStep?: JudicialRequestStep;
  caseId?: string | null;
  titleFa?: string;
  /**
   * The user's own family choice. When present it becomes the request's
   * resolved type (`routing.basis: "user_choice"`); a suggestion is never
   * able to override an explicit choice.
   */
  documentType?: JudicialDocumentType | null;
}

export interface JudicialSaveAnswersInput {
  answers: Record<string, string>;
  /** Optimistic-concurrency guard — the version the client edited. */
  questionnaireVersion: number;
}

export interface JudicialLinkAttachmentInput {
  documentId: string;
  role: JudicialAttachmentRole;
}

export interface JudicialGenerateDraftInput {
  /** Client-generated uuid — makes the generation idempotent on retry. */
  idempotencyKey: string;
}

export interface JudicialGenerateDraftResponse {
  draft: JudicialDraftVersion;
  replayed: boolean;
  completeness: JudicialCompleteness;
  /** Present when generation was refused because the inputs are incomplete. */
  missing?: JudicialMissingField[];
}
