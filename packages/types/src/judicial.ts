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
 * exists; `soon` means the page explains why and offers no fake action;
 * `unavailable` means it is switched off entirely.
 */
export type JudicialServiceStatus = "available" | "soon" | "unavailable";

export const JUDICIAL_STATUS_FA: Record<JudicialServiceStatus, string> = {
  available: "در دسترس",
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
  | "needs_correction"
  | "approved"
  | "cancelled"
  | "archived";

export const JUDICIAL_REQUEST_STATUS_FA: Record<JudicialRequestStatus, string> = {
  draft: "ثبت شده",
  collecting: "در حال نوشتن شرح موضوع",
  needs_answers: "نیازمند پاسخ به پرسش‌ها",
  ready_to_generate: "آمادهٔ تنظیم پیش‌نویس",
  generating: "در حال تنظیم پیش‌نویس",
  draft_ready: "پیش‌نویس آمادهٔ بازبینی",
  ready_to_review: "آمادهٔ بازبینی نهایی",
  needs_correction: "نیازمند اصلاح اطلاعات",
  approved: "پیش‌نویس تأییدشده توسط شما",
  cancelled: "لغو شده",
  archived: "بایگانی‌شده",
};

/**
 * Legal transitions, enforced server-side. Anything not listed is rejected
 * with 409 — the client can request a move but never force one.
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
  ready_to_review: ["approved", "needs_correction", "generating", "cancelled"],
  needs_correction: [
    "collecting",
    "needs_answers",
    "ready_to_generate",
    "ready_to_review",
    "generating",
    "cancelled",
  ],
  approved: ["generating", "archived"],
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
  | "user_edited";

export const JUDICIAL_DRAFT_GENERATOR_FA: Record<JudicialDraftGenerator, string> = {
  structured_composer: "چیدمان ساختاریافته از پاسخ‌های شما",
  model_refined: "بازنویسی با مدل هوش مصنوعی",
  user_edited: "ویرایش‌شده به‌دست شما",
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
  updatedAt: string;
  documentCount: number;
  draftCount: number;
  latestDraftVersion: number | null;
  hasApprovedDraft: boolean;
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
