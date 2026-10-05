// ============================================================
// LEGALIR — Case Management operational model (PART 10 extension)
// ============================================================
// The four concepts below are INDEPENDENT and must never be collapsed into a
// single `status` field:
//   1. CaseLifecycleStatus — the internal LEGALIR lifecycle of the case.
//   2. CaseProceeding.stage — the stage of a specific proceeding before an
//      authority (a case may have several: first instance, appeal, enforcement).
//   3. LawyerEngagement — a lawyer's collaboration request/acceptance and the
//      access scope granted on this case.
//   4. RepresentationRecord — a power-of-attorney document and its authority
//      limits, independent of engagement acceptance and of the service contract.
//
// Creating a case in LEGALIR NEVER files anything with a judicial authority.
// The confirmation message is exactly «پرونده شما در لیگالیر ایجاد شد».
//
// This module is ADDITIVE. It re-uses CaseStatus/CaseCategory/CasePriority
// from ./index.ts and adds the operational layer on top.
// ============================================================

import type { Case, CaseCategory, CasePriority, CaseDocumentItem } from "./index";

// ---------------------------------------------------------------------------
// 1. Internal lifecycle
// ---------------------------------------------------------------------------

/** The internal LEGALIR lifecycle of a case. Distinct from any proceeding stage. */
export type CaseLifecycleStatus = "ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED";

export const CASE_LIFECYCLE_FA: Record<CaseLifecycleStatus, string> = {
  ACTIVE: "فعال",
  ON_HOLD: "متوقف / در انتظار",
  CLOSED: "بسته‌شده",
  ARCHIVED: "بایگانی‌شده",
};

/** Why a lifecycle status changed — always recorded with a date. */
export interface CaseLifecycleChange {
  status: CaseLifecycleStatus;
  reason: string;
  changedAt: string;
  changedByUserId: string;
}

// ---------------------------------------------------------------------------
// 2. Proceeding path & stage (مسیر رسیدگی)
// ---------------------------------------------------------------------------

/**
 * The path a proceeding follows. This is SEPARATE from the case's subject
 * category (ملکی/چک/خانواده/…): a property dispute can be civil or enforcement.
 * `other` is the honest default when the path is not yet known — the UI must
 * never force a court path onto an unclassified case.
 */
export type CaseProceedingPath = "civil" | "criminal" | "family" | "enforcement" | "other";

export const CASE_PROCEEDING_PATH_FA: Record<CaseProceedingPath, string> = {
  civil: "حقوقی",
  criminal: "کیفری",
  family: "خانواده",
  enforcement: "اجرا",
  other: "سایر / نامشخص",
};

/**
 * A stage within a proceeding path. Stages are drawn from a versioned
 * template; a case may enter at ANY stage (it can arrive mid-proceeding).
 * `unknown` is used when the past of a stage was never recorded — it is
 * never back-filled with fabricated history.
 */
export type CaseStageKey =
  // civil
  | "civil_preparation"
  | "civil_filing"
  | "civil_defect_or_referral"
  | "civil_hearing"
  | "civil_judgment"
  | "civil_appeal_review"
  | "civil_appeal_hearing"
  | "civil_enforcement"
  | "civil_end"
  // criminal
  | "criminal_preparation"
  | "criminal_complaint_filed"
  | "criminal_investigation"
  | "criminal_investigation_decision"
  | "criminal_court_hearing"
  | "criminal_judgment"
  | "criminal_appeal_review"
  | "criminal_enforcement"
  | "criminal_end"
  // family
  | "family_preparation"
  | "family_filing"
  | "family_hearing"
  | "family_decision"
  | "family_appeal_review"
  | "family_enforcement"
  | "family_end"
  // enforcement
  | "enforcement_basis_review"
  | "enforcement_request"
  | "enforcement_writ"
  | "enforcement_actions"
  | "enforcement_result"
  // other / unknown
  | "other_info_completion"
  | "other_path_review"
  | "other_action"
  | "other_followup"
  | "other_result"
  // sentinel
  | "unknown";

export const CASE_STAGE_FA: Record<CaseStageKey, string> = {
  civil_preparation: "آماده‌سازی",
  civil_filing: "ثبت نزد مرجع",
  civil_defect_or_referral: "رفع نقص / ارجاع",
  civil_hearing: "رسیدگی",
  civil_judgment: "رأی",
  civil_appeal_review: "بررسی اعتراض",
  civil_appeal_hearing: "رسیدگی اعتراضی",
  civil_enforcement: "اجرا",
  civil_end: "پایان",
  criminal_preparation: "آماده‌سازی",
  criminal_complaint_filed: "ثبت شکایت / شروع رسیدگی",
  criminal_investigation: "تحقیقات",
  criminal_investigation_decision: "تصمیم مرجع تحقیق",
  criminal_court_hearing: "رسیدگی دادگاه",
  criminal_judgment: "رأی",
  criminal_appeal_review: "بررسی اعتراض",
  criminal_enforcement: "اجرا",
  criminal_end: "پایان",
  family_preparation: "آماده‌سازی",
  family_filing: "اقدام نزد مرجع",
  family_hearing: "رسیدگی",
  family_decision: "تصمیم / رأی",
  family_appeal_review: "بررسی اعتراض",
  family_enforcement: "اجرا / ثبت نتیجه",
  family_end: "پایان",
  enforcement_basis_review: "بررسی مبنای اجرا",
  enforcement_request: "درخواست اجرا",
  enforcement_writ: "صدور / ابلاغ اجراییه",
  enforcement_actions: "اقدامات اجرا",
  enforcement_result: "ثبت نتیجه",
  other_info_completion: "تکمیل اطلاعات",
  other_path_review: "بررسی مسیر",
  other_action: "اقدام",
  other_followup: "پیگیری",
  other_result: "ثبت نتیجه",
  unknown: "نامشخص",
};

/**
 * A versioned workflow template. Templates are the OPERATIONAL model of the
 * product — they are NOT a binding statement about the path of every claim.
 * Every stage is optional; a case may enter at any stage.
 */
export interface CaseWorkflowTemplate {
  path: CaseProceedingPath;
  version: number;
  /** Ordered stage keys. Ordering is advisory, not a forced sequence. */
  stages: CaseStageKey[];
  /** Stages that are terminal for this path. */
  terminalStages: CaseStageKey[];
}

// ---------------------------------------------------------------------------
// 3. Legal role of a party (independent of access role)
// ---------------------------------------------------------------------------

/**
 * The LEGAL role a person plays in a proceeding. This is entirely separate
 * from their ACCESS role (CaseMemberRole). In a criminal case the accused is
 * NEVER labelled «مجرم» or «محکوم‌علیه» at the start.
 */
export type CaseLegalRole =
  | "plaintiff" // خواهان (civil)
  | "defendant" // خوانده (civil)
  | "complainant" // شاکی (criminal)
  | "accused" // متهم (criminal)
  | "convict" // محکوم‌علیه (only after a recorded judgment)
  | "representative" // نماینده
  | "witness" // شاهد
  | "expert" // کارشناس
  | "other"
  | "unknown";

export const CASE_LEGAL_ROLE_FA: Record<CaseLegalRole, string> = {
  plaintiff: "خواهان",
  defendant: "خوانده",
  complainant: "شاکی",
  accused: "متهم",
  convict: "محکوم‌علیه",
  representative: "نماینده",
  witness: "شاهد",
  expert: "کارشناس",
  other: "سایر",
  unknown: "هنوز مشخص نیست",
};

/** The legal roles offered for a given path — never a criminal label in civil. */
export function legalRolesForPath(path: CaseProceedingPath): CaseLegalRole[] {
  switch (path) {
    case "civil":
      return ["plaintiff", "defendant", "representative", "witness", "expert", "other", "unknown"];
    case "criminal":
      return ["complainant", "accused", "representative", "witness", "expert", "other", "unknown"];
    case "family":
      return ["plaintiff", "defendant", "representative", "witness", "expert", "other", "unknown"];
    case "enforcement":
      return ["plaintiff", "defendant", "representative", "other", "unknown"];
    default:
      return ["plaintiff", "defendant", "complainant", "accused", "representative", "other", "unknown"];
  }
}

// ---------------------------------------------------------------------------
// 4. Access roles (CaseMember)
// ---------------------------------------------------------------------------

/**
 * The ACCESS role a member holds on a case. Distinct from CaseLegalRole.
 * Membership on one case NEVER grants access to another case.
 */
export type CaseMemberRole =
  | "owner"
  | "lawyer" // accepted collaborating lawyer
  | "limited" // limited collaborator — only explicitly delegated resources
  | "viewer" // read-only
  | "pending"; // requester / lawyer awaiting acceptance — minimal summary only

export const CASE_MEMBER_ROLE_FA: Record<CaseMemberRole, string> = {
  owner: "مالک پرونده",
  lawyer: "وکیل همکار",
  limited: "همکار محدود",
  viewer: "مشاهده‌گر",
  pending: "در انتظار پذیرش",
};

export type CaseMemberStatus = "active" | "revoked";

export interface CaseMember {
  id: string;
  caseId: string;
  /** The account granted access. */
  accountId: string;
  role: CaseMemberRole;
  /** Resource scopes granted (e.g. "documents", "deadlines"). Empty = default. */
  scopes: string[];
  status: CaseMemberStatus;
  grantedAt: string;
  grantedByUserId: string;
  revokedAt: string | null;
}

// ---------------------------------------------------------------------------
// 5. Parties (CaseParty)
// ---------------------------------------------------------------------------

/**
 * A party to a proceeding. A party is NOT a member: naming the opposing party
 * creates NO account and grants NO access. `accountId` is set only when the
 * party happens to also be a platform user who was explicitly invited.
 */
export interface CaseParty {
  id: string;
  caseId: string;
  proceedingId: string | null;
  /** Person or legal entity. */
  kind: "person" | "entity" | "contact";
  name: string;
  legalRole: CaseLegalRole;
  /** Optional minimal identifiers — never required to create a party. */
  nationalId: string | null;
  phone: string | null;
  /** Set only when this party is also an invited platform member. */
  accountId: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 6. Proceedings (CaseProceeding)
// ---------------------------------------------------------------------------

/**
 * A proceeding before an authority. A case may have several (first instance,
 * appeal, enforcement). Official numbers are stored as STRINGS and kept
 * separate: judicial number, archive number, tracking code, judgment id.
 */
export interface CaseProceeding {
  id: string;
  caseId: string;
  path: CaseProceedingPath;
  /** The current stage. `unknown` when the past was never recorded. */
  stage: CaseStageKey;
  /** The workflow template version this proceeding follows. */
  templateVersion: number;
  /** The authority (مرجع) — free text; never fabricated. */
  authority: string | null;
  province: string | null;
  city: string | null;
  branch: string | null;
  /** Official identifiers — all strings, all independent. */
  judicialNumber: string | null;
  archiveNumber: string | null;
  trackingCode: string | null;
  judgmentId: string | null;
  /** When the proceeding was registered with the authority, if known. */
  filedAt: string | null;
  /** Where the stage information came from. */
  stageSource: CaseInfoSource;
  /** When the stage information was recorded. */
  stageRecordedAt: string;
  /** The proceeding this one follows (e.g. appeal follows first instance). */
  parentProceedingId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Provenance of a piece of case information. */
export type CaseInfoSource =
  | "user" // entered by the case owner
  | "lawyer" // entered by a collaborating lawyer
  | "legal_source" // derived from a legal rule (needs confirmation)
  | "system" // produced by LEGALIR
  | "external"; // imported from an external provider (future ADLIRAN)

export const CASE_INFO_SOURCE_FA: Record<CaseInfoSource, string> = {
  user: "اعلام کاربر",
  lawyer: "اعلام وکیل",
  legal_source: "منبع قانونی",
  system: "سیستم",
  external: "منبع بیرونی",
};

// ---------------------------------------------------------------------------
// 7. Events (CaseEvent)
// ---------------------------------------------------------------------------

/**
 * A timeline event. `occurredAt` (when it actually happened) is SEPARATE from
 * `recordedAt` (when it was entered into LEGALIR). An old hearing entered
 * today shows at its real date with a «بعداً ثبت شده» badge.
 */
export type CaseEventType =
  | "case_created"
  | "info_completed"
  | "stage_changed"
  | "filing_recorded"
  | "service_notice"
  | "hearing"
  | "document_added"
  | "task_created"
  | "task_completed"
  | "deadline_added"
  | "deadline_changed"
  | "lawyer_requested"
  | "lawyer_accepted"
  | "contract_linked"
  | "judgment"
  | "appeal_noted"
  | "enforcement_action"
  | "case_closed"
  | "note_added"
  // legacy aliases kept for existing rows
  | "document_uploaded"
  | "ai_analysis_completed"
  | "contract_generated"
  | "lawyer_contacted"
  | "status_changed";

export const CASE_EVENT_FA: Record<CaseEventType, string> = {
  case_created: "ایجاد پرونده",
  info_completed: "تکمیل اطلاعات",
  stage_changed: "تغییر مرحله",
  filing_recorded: "ثبت نزد مرجع",
  service_notice: "ابلاغ",
  hearing: "جلسه",
  document_added: "افزودن سند",
  task_created: "ایجاد وظیفه",
  task_completed: "تکمیل وظیفه",
  deadline_added: "ثبت مهلت",
  deadline_changed: "تغییر مهلت",
  lawyer_requested: "درخواست وکیل",
  lawyer_accepted: "پذیرش وکیل",
  contract_linked: "اتصال قرارداد",
  judgment: "رأی / قرار",
  appeal_noted: "اعتراض اعلام‌شده",
  enforcement_action: "اقدام اجرایی",
  case_closed: "بسته‌شدن داخلی",
  note_added: "یادداشت",
  document_uploaded: "سند بارگذاری شد",
  ai_analysis_completed: "تحلیل هوش مصنوعی تکمیل شد",
  contract_generated: "قرارداد تولید شد",
  lawyer_contacted: "تماس با وکیل",
  status_changed: "تغییر وضعیت",
};

/** Who may see an event. Private notes never leak into overview/notifications. */
export type CaseEventVisibility = "shared" | "private";

export interface CaseEvent {
  id: string;
  caseId: string;
  proceedingId: string | null;
  eventType: CaseEventType;
  title: string;
  description: string;
  /** When it actually happened (may be in the past). */
  occurredAt: string;
  /** When it was entered into LEGALIR. */
  recordedAt: string;
  recordedByUserId: string;
  source: CaseInfoSource;
  visibility: CaseEventVisibility;
  /** Linked resource ids, when applicable. */
  documentId: string | null;
  taskId: string | null;
  deadlineId: string | null;
  contractId: string | null;
  /** Groups events produced by one user action. */
  correlationId: string | null;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 8. Tasks (extended)
// ---------------------------------------------------------------------------

export type CaseTaskStatusV2 = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

export const CASE_TASK_STATUS_V2_FA: Record<CaseTaskStatusV2, string> = {
  todo: "انجام‌نشده",
  in_progress: "در حال انجام",
  blocked: "منتظر / مسدود",
  done: "انجام‌شده",
  cancelled: "لغوشده",
};

export type CaseTaskActionType =
  | "general"
  | "document"
  | "filing"
  | "hearing_prep"
  | "deadline_action"
  | "followup"
  | "payment";

export const CASE_TASK_ACTION_FA: Record<CaseTaskActionType, string> = {
  general: "عمومی",
  document: "مدارک",
  filing: "ثبت / تقدیم",
  hearing_prep: "آماده‌سازی جلسه",
  deadline_action: "اقدام مرتبط با مهلت",
  followup: "پیگیری",
  payment: "پرداخت",
};

export interface CaseTaskV2 {
  id: string;
  caseId: string;
  proceedingId: string | null;
  stageKey: CaseStageKey | null;
  title: string;
  description: string;
  actionType: CaseTaskActionType;
  status: CaseTaskStatusV2;
  priority: CasePriority;
  /** The member responsible — must be an active, authorized member. */
  assigneeUserId: string | null;
  createdByUserId: string;
  dueDate: string | null;
  /** Task ids that must complete first. Cycles are rejected. */
  dependsOn: string[];
  checklist: { id: string; label: string; done: boolean }[];
  /** The outcome / receipt. A legal task completed without one is «اعلامی». */
  result: string | null;
  /** True when completion is only a user claim, not a verified filing. */
  resultIsClaim: boolean;
  documentIds: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 9. Deadlines (extended)
// ---------------------------------------------------------------------------

/**
 * Three INDEPENDENT concepts, never merged:
 *   - legal: a legal/judicial deadline before an authority.
 *   - internal: an internal work deadline (may be earlier than the legal one).
 *   - hearing: a hearing / appointment time.
 */
export type CaseDeadlineKind = "legal" | "internal" | "hearing";

export const CASE_DEADLINE_KIND_FA: Record<CaseDeadlineKind, string> = {
  legal: "موعد حقوقی / قضایی",
  internal: "موعد داخلی کار",
  hearing: "جلسه / قرار ملاقات",
};

/** How a deadline's date was established. */
export type CaseDeadlineBasis =
  | "manual" // entered by a user
  | "computed" // proposed by a rule — needs review
  | "document"; // explicit in a source document

export type CaseDeadlineReviewState =
  | "user_entered" // ثبت دستی کاربر
  | "proposed" // پیشنهادی محاسبه‌شده
  | "needs_review" // نیازمند بررسی
  | "reviewed"; // بررسی‌شده با هویت مسئول

export const CASE_DEADLINE_REVIEW_FA: Record<CaseDeadlineReviewState, string> = {
  user_entered: "ثبت‌شده توسط شما",
  proposed: "پیشنهادی — نیازمند بررسی",
  needs_review: "نیازمند بررسی",
  reviewed: "بررسی‌شده",
};

export type CaseDeadlineOperationalState =
  | "open"
  | "action_done"
  | "needs_review_after_due"
  | "cancelled";

export const CASE_DEADLINE_OPERATIONAL_FA: Record<CaseDeadlineOperationalState, string> = {
  open: "باز",
  action_done: "اقدام انجام‌شده",
  needs_review_after_due: "نیازمند بررسی پس از موعد",
  cancelled: "لغوشده",
};

export interface CaseDeadlineV2 {
  id: string;
  caseId: string;
  proceedingId: string | null;
  kind: CaseDeadlineKind;
  title: string;
  /** ISO date (date-only) or timestamp. */
  dueAt: string;
  /** True when `dueAt` carries no meaningful time-of-day. */
  dateOnly: boolean;
  basis: CaseDeadlineBasis;
  reviewState: CaseDeadlineReviewState;
  operationalState: CaseDeadlineOperationalState;
  /** The rule reference when basis is computed. */
  ruleRef: string | null;
  /** The source document when basis is document. */
  sourceDocumentId: string | null;
  /** Who reviewed/confirmed it, when reviewed. */
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  /** An explicit override of a computed date, with its reason. */
  overrideReason: string | null;
  /** The authority's announced date, kept separate from the computed one. */
  announcedDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 10. Lawyer engagement & representation
// ---------------------------------------------------------------------------

export type LawyerEngagementState =
  | "requested"
  | "under_review"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export const LAWYER_ENGAGEMENT_FA: Record<LawyerEngagementState, string> = {
  requested: "ارسال‌شده",
  under_review: "در حال بررسی",
  accepted: "پذیرفته‌شده",
  declined: "ردشده",
  cancelled: "لغوشده",
  expired: "منقضی‌شده",
};

/** The kind of help requested — acceptance of a consultation is NOT a full handover. */
export type LawyerEngagementKind = "consultation" | "document_review" | "drafting" | "representation";

export const LAWYER_ENGAGEMENT_KIND_FA: Record<LawyerEngagementKind, string> = {
  consultation: "مشاوره",
  document_review: "بررسی مدارک",
  drafting: "تنظیم متن",
  representation: "درخواست پذیرش وکالت",
};

export interface LawyerEngagement {
  id: string;
  caseId: string;
  lawyerProfileId: string;
  lawyerUserId: string | null;
  kind: LawyerEngagementKind;
  state: LawyerEngagementState;
  /** The scope the owner consented to share, shown before sending. */
  sharedScopes: string[];
  /** The owner's recorded consent to the shared scope. */
  ownerConsentAt: string | null;
  requestedByUserId: string;
  requestedAt: string;
  respondedAt: string | null;
  note: string | null;
}

/**
 * A power-of-attorney / representation document. Independent of engagement
 * acceptance and of the service contract. Some authorities require explicit
 * powers — a platform checkbox is NOT a substitute for the document text.
 */
export interface RepresentationRecord {
  id: string;
  caseId: string;
  lawyerProfileId: string | null;
  lawyerUserId: string | null;
  /** The document type (وکالت‌نامه، …). */
  documentType: string;
  /** The document id in the documents store, when uploaded. */
  documentId: string | null;
  /** The official identifier, when present. */
  referenceNumber: string | null;
  issuedAt: string | null;
  /** The proceedings this representation covers. */
  coveredProceedingIds: string[];
  /** The authority limits, as free text. */
  authorityLimits: string | null;
  /** Declared validity / termination. */
  validUntil: string | null;
  terminatedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 11. Case contract links (typed)
// ---------------------------------------------------------------------------

export type CaseContractKind =
  | "disputed" // the contract under dispute
  | "service" // legal services / fee agreement
  | "settlement" // settlement agreement
  | "other";

export const CASE_CONTRACT_KIND_FA: Record<CaseContractKind, string> = {
  disputed: "قرارداد موضوع اختلاف",
  service: "قرارداد خدمات حقوقی",
  settlement: "توافق سازش",
  other: "سایر",
};

export interface CaseContractLinkV2 {
  id: string;
  caseId: string;
  contractId: string;
  kind: CaseContractKind;
  addedByUserId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 12. Overview aggregate
// ---------------------------------------------------------------------------

/** The single "next action" the overview surfaces, with an explainable reason. */
export interface CaseNextAction {
  kind: "deadline" | "hearing" | "task" | "info" | "none";
  title: string;
  reason: string;
  /** The responsible member, when known. */
  assigneeUserId: string | null;
  dueAt: string | null;
  /** A deep link target within the case. */
  targetTab: "deadlines" | "tasks" | "overview" | "documents";
  targetId: string | null;
}

export interface CaseOverview {
  case: Case;
  lifecycle: CaseLifecycleStatus;
  /** The primary proceeding's stage, when one exists. */
  currentStage: CaseStageKey;
  currentStageSource: CaseInfoSource;
  currentStageAt: string | null;
  nextAction: CaseNextAction;
  /** The nearest open deadline, when any. */
  nearestDeadline: CaseDeadlineV2 | null;
  /** The next upcoming hearing, when any. */
  nextHearing: CaseDeadlineV2 | null;
  openTaskCount: number;
  overdueTaskCount: number;
  /** Collaborating lawyers and their engagement state. */
  engagements: LawyerEngagement[];
  /** Representation records, shown separately from engagements. */
  representations: RepresentationRecord[];
  /** True when no authority information has been recorded yet. */
  authorityInfoMissing: boolean;
  /** The last time case information was updated. */
  infoUpdatedAt: string;
  /** The last official sync — always null until an external provider exists. */
  lastSyncedAt: string | null;
}

// ---------------------------------------------------------------------------
// 13. API contracts (v2)
// ---------------------------------------------------------------------------

/** The extended case shape returned by the v2 detail/overview endpoints. */
export interface CaseV2 extends Case {
  /** The human-facing LEGALIR reference (LGL-CASE-…). */
  internalRef: string;
  lifecycle: CaseLifecycleStatus;
  version: number;
  /** The caller's access role on this case. */
  viewerRole: CaseMemberRole;
}

export interface CaseDetailResponseV2 {
  case: CaseV2;
  /** The primary proceeding, when one exists. */
  proceeding: CaseProceeding | null;
  proceedings: CaseProceeding[];
  parties: CaseParty[];
  members: CaseMember[];
  documents: CaseDocumentItem[];
  contracts: CaseLinkedContractV2[];
  timeline: CaseEvent[];
  tasks: CaseTaskV2[];
  deadlines: CaseDeadlineV2[];
  engagements: LawyerEngagement[];
  representations: RepresentationRecord[];
  /** The computed next action, so the overview and detail agree. */
  nextAction: CaseNextAction;
}

export interface CaseLinkedContractV2 {
  id: string;
  referenceCode: string;
  title: string;
  typeFa: string;
  state: string;
  progress: number;
  updatedAt: string;
  /** The link's semantic kind on this case. */
  kind: CaseContractKind;
}

export interface CaseCreateRequestV2 {
  title: string;
  description: string;
  category: CaseCategory;
  priority?: CasePriority;
  /** Optional client-supplied idempotency key — a repeat create is a no-op. */
  idempotencyKey?: string;
}

export interface CaseStageChangeRequest {
  proceedingId: string;
  stage: CaseStageKey;
  /**
   * The proceeding's path. Supplied when the user is (re)classifying the
   * case — e.g. moving it off the placeholder `other` path onto `civil`.
   * When omitted the proceeding keeps its current path.
   */
  path?: CaseProceedingPath;
  /** Why the stage changed — required. */
  reason: string;
  /** When it actually happened; defaults to now. */
  occurredAt?: string;
  /** The provenance of the change. */
  source?: CaseInfoSource;
  /** An optional linked document. */
  documentId?: string | null;
}

export interface CaseEventCreateRequestV2 {
  eventType: CaseEventType;
  title: string;
  description?: string;
  /** When it actually happened; defaults to now. */
  occurredAt?: string;
  proceedingId?: string | null;
  visibility?: CaseEventVisibility;
  documentId?: string | null;
  taskId?: string | null;
  deadlineId?: string | null;
  contractId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CaseTaskCreateRequestV2 {
  title: string;
  description?: string;
  priority?: CasePriority;
  dueDate?: string | null;
  actionType?: CaseTaskActionType;
  assigneeUserId?: string | null;
  proceedingId?: string | null;
  stageKey?: CaseStageKey | null;
  dependsOn?: string[];
  documentIds?: string[];
}

export interface CaseTaskUpdateRequestV2 {
  title?: string;
  description?: string;
  status?: CaseTaskStatusV2;
  priority?: CasePriority;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  dependsOn?: string[];
  checklist?: { id: string; label: string; done: boolean }[];
  result?: string | null;
  /** True when the completion is only a user claim (no receipt). */
  resultIsClaim?: boolean;
}

export interface CaseDeadlineCreateRequestV2 {
  title: string;
  dueAt: string;
  kind?: CaseDeadlineKind;
  dateOnly?: boolean;
  basis?: CaseDeadlineBasis;
  source?: "user" | "lawyer" | "legal_source" | "system";
  ruleRef?: string | null;
  sourceDocumentId?: string | null;
  announcedDueAt?: string | null;
  proceedingId?: string | null;
}

export interface CaseDeadlineUpdateRequestV2 {
  deadlineId: string;
  title?: string;
  dueAt?: string;
  kind?: CaseDeadlineKind;
  operationalState?: CaseDeadlineOperationalState;
  reviewState?: CaseDeadlineReviewState;
  overrideReason?: string | null;
  announcedDueAt?: string | null;
}

export interface CasePartyCreateRequest {
  name: string;
  legalRole: CaseLegalRole;
  kind?: "person" | "entity" | "contact";
  nationalId?: string | null;
  phone?: string | null;
  note?: string | null;
  proceedingId?: string | null;
}

export interface CaseProceedingCreateRequest {
  path: CaseProceedingPath;
  stage: CaseStageKey;
  authority?: string | null;
  province?: string | null;
  city?: string | null;
  branch?: string | null;
  judicialNumber?: string | null;
  archiveNumber?: string | null;
  trackingCode?: string | null;
  judgmentId?: string | null;
  filedAt?: string | null;
  parentProceedingId?: string | null;
}

export interface CaseEngagementCreateRequest {
  lawyerProfileId: string;
  kind: LawyerEngagementKind;
  /** The scopes the owner consents to share — shown before sending. */
  sharedScopes: string[];
  /** The owner's explicit consent to the shared scope. */
  ownerConsent: boolean;
  note?: string | null;
}

export interface CaseEngagementUpdateRequest {
  engagementId: string;
  state: LawyerEngagementState;
  note?: string | null;
}

export interface CaseRepresentationCreateRequest {
  documentType: string;
  lawyerProfileId?: string | null;
  documentId?: string | null;
  referenceNumber?: string | null;
  issuedAt?: string | null;
  coveredProceedingIds?: string[];
  authorityLimits?: string | null;
  validUntil?: string | null;
  note?: string | null;
}

export interface CaseLifecycleChangeRequest {
  lifecycle: CaseLifecycleStatus;
  reason: string;
}

/** The scopes a lawyer engagement may request. */
export const CASE_ENGAGEMENT_SCOPES = ["summary", "documents", "deadlines", "tasks", "parties"] as const;
export type CaseEngagementScope = (typeof CASE_ENGAGEMENT_SCOPES)[number];

export const CASE_ENGAGEMENT_SCOPE_FA: Record<CaseEngagementScope, string> = {
  summary: "خلاصه پرونده",
  documents: "اسناد",
  deadlines: "مهلت‌ها",
  tasks: "وظایف",
  parties: "طرف‌ها",
};
