// ============================================================
// LEGALIR — Lawyer Portal domain types
// ============================================================
// The lawyer workbench (پنل وکیل) is a first-class surface: a referral
// queue, a traceable workflow, an SLA clock, a professional profile with
// per-service rates, and a private settlement account.
//
// Everything here is additive. The request state machine stays in
// platform.ts (`LegalRequestState` + `LEGAL_REQUEST_TRANSITIONS`); these
// types describe the *workflow layer* on top of it — who did what, when
// the clock started, what the lawyer charges and where the money goes.
//
// Money is always an integer number of Toman, matching `LawyerPricing`.
// Instants are ISO 8601 strings; calendar dates are `YYYY-MM-DD`.
// ============================================================

import type {
  LegalRequestState,
  LawyerProfile,
  LawyerReferralItem,
  PlatformRole,
} from "./platform";

// ---------------------------------------------------------------------------
// SLA policy
// ---------------------------------------------------------------------------
// A policy per service. `serviceKey` is a `LawyerService.id` from the
// lawyer taxonomy, or `DEFAULT_SLA_SERVICE_KEY` for every request that has
// no explicit service. Response is the clock to first *decision*
// (accept or decline); completion is the clock to the delivered result.

/** The policy that applies when a request names no specific service. */
export const DEFAULT_SLA_SERVICE_KEY = "__default__";

/** How the clock advances. */
export type SlaClockMode =
  /** Wall-clock hours — nights, weekends and holidays count. */
  | "CALENDAR"
  /** Only the configured working hours count. */
  | "BUSINESS_HOURS";

/** What happens to the clock while the request waits on the client. */
export type SlaPauseBehavior =
  /** The clock stops; the paused duration is added back on resume. */
  | "PAUSE"
  /** The clock keeps running — the client's delay still counts. */
  | "CONTINUE";

/** A single `HH:mm` window in the platform timezone. */
export interface WorkingHoursWindow {
  /** "HH:mm" — inclusive. */
  startTime: string;
  /** "HH:mm" — exclusive. */
  endTime: string;
}

/**
 * The platform working calendar. One row, edited by an operator with
 * `admin:settings:manage`. Iran's official weekend is Thursday+Friday;
 * the default matches a Saturday–Wednesday office week.
 */
export interface PlatformWorkCalendar {
  /** IANA timezone. */
  timezone: string;
  /** 0 = Saturday … 6 = Friday (Iranian week starts Saturday). */
  workingDays: number[];
  /** One window per working day (kept simple: a single shared window). */
  hours: WorkingHoursWindow;
  /** Closed days, `YYYY-MM-DD` in the platform timezone. */
  holidays: string[];
  updatedAt: string;
  updatedBy: string | null;
}

/** Per-service SLA policy. */
export interface ServiceSlaPolicy {
  id: string;
  /** `LawyerService.id`, or `DEFAULT_SLA_SERVICE_KEY`. */
  serviceKey: string;
  /** Human label, so the admin list reads without joining the taxonomy. */
  labelFa: string;
  /** Hours allowed from referral to the lawyer's accept/decline decision. */
  responseHours: number;
  /** Hours allowed from acceptance to the delivered result. */
  completionHours: number;
  clock: SlaClockMode;
  /** Behaviour while the request is `WAITING_FOR_CLIENT`. */
  pauseBehavior: SlaPauseBehavior;
  /** Start warning the lawyer/admin this many hours before the deadline. */
  warnBeforeHours: number;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

// ---------------------------------------------------------------------------
// Per-request SLA state
// ---------------------------------------------------------------------------
// Stored on the request row (`LegalRequest.sla`) for fast list rendering.
// The append-only `request_actions` log remains the audit source of truth;
// this snapshot is a denormalization written in the same call as the action
// that caused it.

export type SlaPhase = "RESPONSE" | "COMPLETION" | "DONE";

export type SlaHealth =
  /** Clock running, comfortably inside the window. */
  | "ON_TRACK"
  /** Inside the warning window. */
  | "AT_RISK"
  /** Deadline passed unmet. */
  | "BREACHED"
  /** Waiting on the client and the policy pauses the clock. */
  | "PAUSED"
  /** Finished inside the deadline. */
  | "MET"
  /** Finished after the deadline. */
  | "MISSED"
  /** No policy applies (no lawyer assigned, or policy disabled). */
  | "NONE";

/** One manual deadline change, ordered oldest → newest. */
export interface SlaOverride {
  at: string;
  actorId: string;
  reason: string;
  /** The deadline that was replaced (ISO), or null when it did not exist. */
  previousDueAt: string | null;
  /** The deadline that replaced it (ISO), or null to clear it. */
  nextDueAt: string | null;
  /** Which clock was edited. */
  phase: SlaPhase;
}

export interface LegalRequestSla {
  /** The policy row used when the clock started, or null. */
  policyId: string | null;
  /** The resolved service key at assignment time. */
  serviceKey: string;
  /** Clock start — the referral instant. */
  assignedAt: string;
  /** Response deadline (referral + responseHours). */
  responseDueAt: string | null;
  /** Completion deadline (acceptedAt + completionHours). */
  completionDueAt: string | null;
  viewedAt: string | null;
  /** When the lawyer accepted OR declined — the response clock stops here. */
  respondedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  startedAt: string | null;
  infoRequestedAt: string | null;
  completedAt: string | null;
  /** True while the clock is stopped because the request waits on the client. */
  paused: boolean;
  pausedAt: string | null;
  /** Total paused milliseconds already added back to the deadlines. */
  pausedMs: number;
  /** The instant the response or completion deadline was first crossed. */
  breachedAt: string | null;
  overrides: SlaOverride[];
}

/** The computed view of the clock for one request at one instant. */
export interface SlaSnapshot {
  phase: SlaPhase;
  health: SlaHealth;
  /** The deadline the current phase is judged against. */
  dueAt: string | null;
  /** Milliseconds left (negative when overdue), frozen while paused. */
  remainingMs: number | null;
  /** True when the clock is stopped. */
  paused: boolean;
  /** Human label for the health, e.g. «نزدیک به مهلت». */
  healthFa: string;
  /** True when the remaining time is inside the policy warning window. */
  atRisk: boolean;
  breached: boolean;
  /** True when a terminal outcome was reached. */
  done: boolean;
}

// ---------------------------------------------------------------------------
// Request actions (the workflow log)
// ---------------------------------------------------------------------------
// State changes are already logged in `legal_request_events`. This log
// records everything that is NOT a state change — the view, the notes, the
// deliverables, the SLA pause/resume — so the timeline is complete and
// every row is attributable.

export type RequestActionKind =
  | "VIEWED"
  | "ACCEPTED"
  | "DECLINED"
  | "STARTED"
  | "INFO_REQUESTED"
  | "RESULT_SENT"
  | "COMPLETED"
  | "NOTE"
  | "INTERNAL_NOTE"
  | "FILE"
  | "SLA_PAUSED"
  | "SLA_RESUMED"
  | "SLA_OVERRIDDEN"
  | "REASSIGNED";

/**
 * Who may see an action. `internal` is the platform's private notebook:
 * visible to the assigned lawyer and to authorized staff, never to the
 * client. Absent = `public`.
 */
export type RequestActionVisibility = "public" | "internal";

export interface RequestAction {
  id: string;
  requestId: string;
  kind: RequestActionKind;
  /** User id of the actor, or "system". */
  actorId: string;
  actorRole: PlatformRole | "system";
  note: string | null;
  visibility?: RequestActionVisibility;
  /** Kind-specific payload — e.g. the decline reason or deliverable ids. */
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** The client-visible result of a completed referral. */
export interface LegalRequestResult {
  summary: string;
  /** Document ids the lawyer attached as deliverables. */
  documentIds: string[];
  deliveredAt: string;
  /** The lawyer user id that delivered it. */
  deliveredBy: string;
}

/** One line in the merged request timeline. */
export type RequestTimelineKind = "STATE" | "ACTION" | "MESSAGE";

export interface RequestTimelineEntry {
  id: string;
  kind: RequestTimelineKind;
  at: string;
  /** Display name of the actor (never a raw id). */
  actorLabel: string;
  actorRole: PlatformRole | "system";
  /** Short human title, e.g. «پذیرش درخواست». */
  titleFa: string;
  /** Optional body (a note, a message, a decline reason). */
  body: string | null;
  visibility: RequestActionVisibility;
  /** State transition endpoints, when this entry is a state change. */
  fromState?: LegalRequestState | null;
  toState?: LegalRequestState | null;
}

// ---------------------------------------------------------------------------
// Professional profile: per-service rates
// ---------------------------------------------------------------------------

export type LawyerRateUnit = "FIXED" | "HOURLY" | "PER_SESSION";

/** One service price the lawyer publishes. */
export interface LawyerServiceRate {
  serviceKey: string;
  amountToman: number;
  unit: LawyerRateUnit;
  /** Optional note shown next to the price on the lawyer's card. */
  noteFa?: string | null;
}

/** One append-only rate change, so historic requests keep their price. */
export interface LawyerRateChange {
  id: string;
  lawyerId: string;
  serviceKey: string;
  previousAmountToman: number | null;
  nextAmountToman: number | null;
  previousUnit: LawyerRateUnit | null;
  nextUnit: LawyerRateUnit | null;
  actorId: string;
  actorRole: PlatformRole;
  createdAt: string;
}

/**
 * A snapshot of the price agreed for one referral. Written when the lawyer
 * accepts, so a later rate change never rewrites the price of a request
 * that was already accepted.
 */
export interface ReferralAgreedRate {
  serviceKey: string;
  amountToman: number;
  unit: LawyerRateUnit;
  /** ISO instant the price was fixed. */
  agreedAt: string;
}

// ---------------------------------------------------------------------------
// Settlement (bank) account
// ---------------------------------------------------------------------------

export type LawyerBankStatus = "NOT_SET" | "PENDING_REVIEW" | "VERIFIED" | "NEEDS_CORRECTION";

/** The full account, readable only by the owner and authorized staff. */
export interface LawyerBankAccount {
  holderName: string;
  bankName: string;
  /** IBAN (`IR…`) — 26 characters, digits after the prefix. */
  iban: string;
  /** Optional legacy account number. */
  accountNumber: string | null;
  /** Last four digits of the settlement card, for human confirmation. */
  cardLast4: string | null;
}

/** One append-only bank review event. */
export interface LawyerBankEvent {
  id: string;
  lawyerId: string;
  action: "SUBMITTED" | "VERIFIED" | "CORRECTION_REQUESTED";
  actorId: string;
  actorRole: PlatformRole;
  reason: string | null;
  /** Masked snapshot, never the full IBAN. */
  destinationMasked: string | null;
  createdAt: string;
}

export interface LawyerBankRecord {
  lawyerId: string;
  status: LawyerBankStatus;
  account: LawyerBankAccount | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  updatedAt: string;
}

/** What a lawyer may submit. Validation happens server-side. */
export interface LawyerBankSubmission {
  holderName: string;
  bankName: string;
  iban: string;
  accountNumber?: string | null;
  cardLast4?: string | null;
}

/** What a staff reviewer may decide. */
export interface LawyerBankReview {
  action: "VERIFY" | "REQUEST_CORRECTION";
  /** Mandatory for a correction request. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Profile completeness
// ---------------------------------------------------------------------------

/** A required field the lawyer has not filled yet. */
export interface LawyerProfileGap {
  key: string;
  labelFa: string;
  /** Where the lawyer goes to fix it. */
  href: string;
}

export interface LawyerProfileCompleteness {
  complete: boolean;
  /** 0–100 — derived from the required field list. */
  percent: number;
  missing: LawyerProfileGap[];
  /** True when the profile may receive new referrals. */
  acceptingReferrals: boolean;
}

// ---------------------------------------------------------------------------
// Referral list + dashboard projections
// ---------------------------------------------------------------------------

/** The queue the lawyer sees. */
export interface LawyerReferralListItem {
  requestId: string;
  title: string;
  /** `LawyerService.id` when known. */
  serviceKey: string | null;
  serviceLabelFa: string;
  requestCategory: string;
  requestCategoryLabelFa: string;
  state: LegalRequestState;
  stateLabelFa: string;
  /** The client's display name (individual or organization representative). */
  clientName: string;
  /** The organization name when the request is org-scoped. */
  organizationName: string | null;
  /** ISO instant the request was referred to this lawyer. */
  referredAt: string;
  /** ISO instant of the most recent action/message/state change. */
  lastActivityAt: string;
  /** A short, already-sanitized description of the last action. */
  lastActivityFa: string;
  sla: SlaSnapshot;
  perspective: "NEEDS_ACTION" | "WAITING_ON_CLIENT" | "ACTIVE" | "DONE";
}

/** The filter bag the list route accepts. */
export interface LawyerReferralFilters {
  serviceKey?: string | null;
  state?: LegalRequestState | null;
  perspective?: LawyerReferralListItem["perspective"] | null;
  slaHealth?: SlaHealth | null;
  /** ISO date (inclusive) on the referral instant. */
  fromIso?: string | null;
  /** ISO date (inclusive). */
  toIso?: string | null;
  search?: string | null;
  /**
   * One dashboard KPI bucket. The list reuses the dashboard's own predicate,
   * so clicking a stat lands on exactly the requests it counted.
   */
  bucket?: keyof LawyerDashboardCounts | null;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "due";
}

export interface LawyerReferralListResponse {
  items: LawyerReferralListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    services: { value: string; labelFa: string; count: number }[];
    states: { value: LegalRequestState; labelFa: string; count: number }[];
    sla: Record<SlaHealth, number>;
  };
}

/** KPI counters on the lawyer dashboard. */
export interface LawyerDashboardCounts {
  /** Referred and never opened. */
  newAssignments: number;
  /** Referred, opened, but not yet accepted/declined. */
  viewed: number;
  /** Accepted and not yet started. */
  accepted: number;
  /** Started, work in progress. */
  inProgress: number;
  /** Waiting on the client (information or a reply). */
  waitingForClient: number;
  completed: number;
  declined: number;
  cancelled: number;
  /** Open referrals inside the warning window. */
  atRisk: number;
  /** Open referrals past the deadline. */
  breached: number;
}

/** One bucket of the referral trend chart. */
export interface LawyerReferralTrendPoint {
  /** `YYYY-MM-DD` in the platform calendar. */
  date: string;
  referred: number;
  accepted: number;
  completed: number;
  declined: number;
}

/** A concrete item the lawyer should act on now. */
export interface LawyerActionItem {
  /** `new` | `accept` | `info` | `sla` | `reply` — drives label + href. */
  kind: "new" | "accept" | "info" | "sla" | "reply";
  requestId: string;
  title: string;
  detailFa: string;
  /** Higher = more urgent. */
  weight: number;
}

export interface LawyerDashboard {
  counts: LawyerDashboardCounts;
  trend: LawyerReferralTrendPoint[];
  /** Ordered, human-readable to-do list. */
  actionItems: LawyerActionItem[];
  /** A one-paragraph Persian summary of the most urgent work. */
  summaryFa: string;
  profileCompleteness: LawyerProfileCompleteness;
  bankStatus: LawyerBankStatus;
  /** The assigned lawyer profile id, null when the user has no profile. */
  lawyerId: string | null;
  profile: LawyerProfile | null;
  /** The referral ids behind each KPI, so every number is clickable. */
  buckets: Record<keyof LawyerDashboardCounts, string[]>;
  /**
   * Every referral assigned to this lawyer, unified across the four
   * surfaces (cases, contracts, consultations, representation) and
   * de-duplicated by `id`. The dashboard renders the SAME row under each
   * surface listed in `surfaces` — never a second copy of the referral.
   */
  referrals: LawyerReferralItem[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Referral detail projection
// ---------------------------------------------------------------------------

export interface LawyerReferralDetail {
  requestId: string;
  title: string;
  serviceKey: string | null;
  serviceLabelFa: string;
  category: string;
  categoryLabelFa: string;
  state: LegalRequestState;
  stateLabelFa: string;
  intakeAnswers: Record<string, string>;
  /** Client identity — individual or organization representative. */
  client: {
    displayName: string;
    mobileMasked: string | null;
    organizationName: string | null;
    representativeName: string | null;
    representativeMobileMasked: string | null;
  };
  referredAt: string;
  sla: {
    snapshot: SlaSnapshot;
    state: LegalRequestSla | null;
    policy: ServiceSlaPolicy | null;
    /** True when the clock stops while waiting on the client. */
    pausesOnClientWait: boolean;
    /** Human explanation rendered on the request page. */
    policyNoteFa: string;
  };
  /** The price fixed for this referral, when accepted. */
  agreedRate: ReferralAgreedRate | null;
  /** The current catalogue price for this service, for context. */
  currentRate: LawyerServiceRate | null;
  result: LegalRequestResult | null;
  attachments: {
    id: string;
    name: string;
    mime: string;
    sizeBytes: number;
    createdAt: string;
  }[];
  timeline: RequestTimelineEntry[];
  messages: {
    id: string;
    senderName: string;
    senderRole: PlatformRole;
    isMine: boolean;
    body: string;
    createdAt: string;
    readAt: string | null;
  }[];
  /** The actions the server will accept right now. */
  allowedActions: LawyerReferralAction[];
  createdAt: string;
  updatedAt: string;
}

/** The verbs the lawyer workflow exposes. */
export type LawyerReferralAction =
  | "VIEW"
  | "ACCEPT"
  | "DECLINE"
  | "START"
  | "REQUEST_INFO"
  | "COMPLETE"
  | "SEND_MESSAGE"
  | "ADD_NOTE";

/** Persian labels for the workflow verbs. */
export const LAWYER_REFERRAL_ACTION_FA: Record<LawyerReferralAction, string> = {
  VIEW: "مشاهده",
  ACCEPT: "پذیرش",
  DECLINE: "رد درخواست",
  START: "شروع کار",
  REQUEST_INFO: "درخواست اطلاعات",
  COMPLETE: "ارسال نتیجه و تکمیل",
  SEND_MESSAGE: "ارسال پیام",
  ADD_NOTE: "ثبت یادداشت",
};

/** Persian labels for SLA health. */
export const SLA_HEALTH_FA: Record<SlaHealth, string> = {
  ON_TRACK: "در محدودهٔ مهلت",
  AT_RISK: "نزدیک به مهلت",
  BREACHED: "مهلت نقض شده",
  PAUSED: "ساعت متوقف (انتظار کاربر)",
  MET: "در مهلت انجام شد",
  MISSED: "با تأخیر انجام شد",
  NONE: "بدون مهلت",
};

/** Persian labels for the request action log. */
export const REQUEST_ACTION_FA: Record<RequestActionKind, string> = {
  VIEWED: "مشاهدهٔ درخواست",
  ACCEPTED: "پذیرش درخواست",
  DECLINED: "رد درخواست",
  STARTED: "شروع انجام کار",
  INFO_REQUESTED: "درخواست اطلاعات تکمیلی",
  RESULT_SENT: "ارسال نتیجه",
  COMPLETED: "تکمیل درخواست",
  NOTE: "یادداشت برای کاربر",
  INTERNAL_NOTE: "یادداشت داخلی",
  FILE: "افزودن فایل",
  SLA_PAUSED: "توقف ساعت پاسخ‌گویی",
  SLA_RESUMED: "ادامهٔ ساعت پاسخ‌گویی",
  SLA_OVERRIDDEN: "تغییر دستی مهلت",
  REASSIGNED: "ارجاع مجدد",
};

/** Persian labels for the bank review status. */
export const LAWYER_BANK_STATUS_FA: Record<LawyerBankStatus, string> = {
  NOT_SET: "ثبت‌نشده",
  PENDING_REVIEW: "در انتظار بررسی",
  VERIFIED: "تأییدشده",
  NEEDS_CORRECTION: "نیازمند اصلاح",
};

/** Persian labels for a rate unit. */
export const LAWYER_RATE_UNIT_FA: Record<LawyerRateUnit, string> = {
  FIXED: "مبلغ ثابت",
  HOURLY: "نرخ ساعتی",
  PER_SESSION: "هر جلسه",
};
