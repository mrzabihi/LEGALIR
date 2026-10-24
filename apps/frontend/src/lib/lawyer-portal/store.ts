// ============================================================
// LEGALIR — Lawyer portal store (JSON tables, server-only)
// ============================================================
// Tables:
//   platform_work_calendar — one row: the SLA working calendar
//   sla_policies           — one row per service key (+ `__default__`)
//   request_actions        — the workflow log (view, notes, files, SLA events)
//   lawyer_rates           — the current published price per service
//   lawyer_rate_changes    — append-only price history
//   lawyer_bank_accounts   — one settlement account per lawyer
//   lawyer_bank_events     — append-only bank review history
//
// State changes are NOT duplicated here: they go through the authoritative
// state machine in `../legal-request-db` and its `legal_request_events` log.
// This module records everything else, so a request timeline can be rebuilt
// from (state events ∪ actions ∪ messages) without guessing.
//
// Every write is scoped: a lawyer command verifies `selectedLawyerId` equals
// the caller's profile id and returns `not_found` otherwise, so a bare
// request id is never authorization.
// ============================================================

import {
  DEFAULT_SLA_SERVICE_KEY,
  type LegalRequest,
  type LegalRequestResult,
  type LegalRequestState,
  type LawyerBankAccount,
  type LawyerBankEvent,
  type LawyerBankRecord,
  type LawyerBankReview,
  type LawyerBankSubmission,
  type LawyerRateChange,
  type LawyerRateUnit,
  type LawyerServiceRate,
  type PlatformRole,
  type PlatformWorkCalendar,
  type RequestAction,
  type RequestActionKind,
  type RequestActionVisibility,
  type ServiceSlaPolicy,
  type SlaPhase,
  type V1DocumentDetail,
} from "@legalir/types";
import { readTable, writeTable } from "../db";
import { recordAudit } from "../admin/audit";
import { appendMessage, getOrCreateThread } from "../consultation-message-db";
import {
  assignRequestLawyer,
  getRequestById,
  listRequestEvents,
  transitionRequest,
  updateRequest,
} from "../legal-request-db";
import { getLawyerProfileByUserId } from "../lawyer-db";
import { addCaseMember, addCaseTimelineEvent, createCase } from "../case-db";
import {
  DEFAULT_WORK_CALENDAR,
  applyOverride,
  defaultPolicy,
  initializeSla,
  markAccepted,
  markBreached,
  markCompleted,
  markDeclined,
  markInfoRequested,
  markStarted,
  markViewed,
  pauseClock,
  resumeClock,
  slaSnapshot,
} from "./sla";

const CALENDAR_TABLE = "platform_work_calendar";
const POLICY_TABLE = "sla_policies";
const ACTION_TABLE = "request_actions";
const RATE_TABLE = "lawyer_rates";
const RATE_CHANGE_TABLE = "lawyer_rate_changes";
const BANK_TABLE = "lawyer_bank_accounts";
const BANK_EVENT_TABLE = "lawyer_bank_events";

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type CommandFailure =
  | "not_found"
  | "forbidden"
  | "illegal_state"
  | "invalid_input"
  | "conflict";

export type CommandResult =
  | { ok: true; request: LegalRequest; action: RequestAction | null }
  | { ok: false; reason: CommandFailure; messageFa: string };

function fail(reason: CommandFailure, messageFa: string): CommandResult {
  return { ok: false, reason, messageFa };
}

export interface CommandActor {
  userId: string;
  role: PlatformRole;
}

// ---------------------------------------------------------------------------
// Working calendar
// ---------------------------------------------------------------------------

/** The configured calendar, or the seeded default before one is saved. */
export function getWorkCalendar(): PlatformWorkCalendar {
  const rows = readTable<PlatformWorkCalendar>(CALENDAR_TABLE);
  const row = rows[0];
  if (!row) return { ...DEFAULT_WORK_CALENDAR };
  return {
    timezone: row.timezone || DEFAULT_WORK_CALENDAR.timezone,
    workingDays: Array.isArray(row.workingDays) ? row.workingDays : DEFAULT_WORK_CALENDAR.workingDays,
    hours: row.hours ?? DEFAULT_WORK_CALENDAR.hours,
    holidays: Array.isArray(row.holidays) ? row.holidays : [],
    updatedAt: row.updatedAt ?? DEFAULT_WORK_CALENDAR.updatedAt,
    updatedBy: row.updatedBy ?? null,
  };
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validHm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateWorkCalendar(input: PlatformWorkCalendar): string | null {
  if (!validTimeZone(input.timezone)) return "منطقهٔ زمانی معتبر نیست.";
  if (!Array.isArray(input.workingDays) || input.workingDays.length === 0) {
    return "حداقل یک روز کاری باید انتخاب شود.";
  }
  if (input.workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return "روزهای کاری باید بین ۰ (شنبه) و ۶ (جمعه) باشند.";
  }
  if (!validHm(input.hours.startTime) || !validHm(input.hours.endTime)) {
    return "ساعت شروع و پایان باید به شکل HH:mm باشند.";
  }
  if (input.hours.startTime >= input.hours.endTime) {
    return "ساعت پایان باید بعد از ساعت شروع باشد.";
  }
  if (input.holidays.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    return "تاریخ تعطیلات باید به شکل YYYY-MM-DD باشد.";
  }
  return null;
}

export function saveWorkCalendar(
  input: PlatformWorkCalendar,
  actor: CommandActor
): { ok: true; calendar: PlatformWorkCalendar } | { ok: false; messageFa: string } {
  const error = validateWorkCalendar(input);
  if (error) return { ok: false, messageFa: error };

  const before = getWorkCalendar();
  const next: PlatformWorkCalendar = {
    ...input,
    workingDays: [...new Set(input.workingDays)].sort((a, b) => a - b),
    holidays: [...new Set(input.holidays)].sort(),
    updatedAt: nowIso(),
    updatedBy: actor.userId,
  };
  writeTable(CALENDAR_TABLE, [next]);
  recordAudit({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: "sla.calendar.update",
    resourceType: "platform_work_calendar",
    resourceId: "default",
    before: { ...before },
    after: { ...next },
  });
  return { ok: true, calendar: next };
}

// ---------------------------------------------------------------------------
// SLA policies
// ---------------------------------------------------------------------------

/** Persist the `__default__` policy once so the admin list always has a row. */
function ensureDefaultPolicy(): void {
  const rows = readTable<ServiceSlaPolicy>(POLICY_TABLE);
  if (rows.some((r) => r.serviceKey === DEFAULT_SLA_SERVICE_KEY)) return;
  rows.push(defaultPolicy(DEFAULT_SLA_SERVICE_KEY, "پیش‌فرض (همهٔ درخواست‌ها)"));
  writeTable(POLICY_TABLE, rows);
}

const POLICY_PRIORITY_RANK: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

/**
 * Normalise one stored row into the current shape.
 *
 * Three fields post-date the first version of this table, and rows written
 * then simply do not have them. Rather than a migration that rewrites the
 * store (and could lose a field this code does not know about), every read
 * fills the gaps: `status` derives from the legacy `enabled` flag, and the
 * audience/priority default to the values the old behaviour implied.
 */
function normalizePolicy(row: ServiceSlaPolicy): ServiceSlaPolicy {
  const legacy = row as ServiceSlaPolicy & { enabled?: boolean };
  return {
    ...row,
    audience: row.audience ?? "both",
    priority: row.priority ?? "NORMAL",
    status: row.status ?? (legacy.enabled === false ? "inactive" : "active"),
  };
}

export function listSlaPolicies(includeArchived = false): ServiceSlaPolicy[] {
  ensureDefaultPolicy();
  const rows = readTable<ServiceSlaPolicy>(POLICY_TABLE).map(normalizePolicy);
  return rows
    .filter((p) => includeArchived || p.status !== "archived")
    .sort((a, b) => {
      if (a.serviceKey === DEFAULT_SLA_SERVICE_KEY) return -1;
      if (b.serviceKey === DEFAULT_SLA_SERVICE_KEY) return 1;
      const rank = (POLICY_PRIORITY_RANK[a.priority] ?? 1) - (POLICY_PRIORITY_RANK[b.priority] ?? 1);
      if (rank !== 0) return rank;
      // Active before inactive before archived, so the rows that actually
      // start clocks are the first thing an operator sees.
      const lifecycle = (p: ServiceSlaPolicy) =>
        p.status === "active" ? 0 : p.status === "inactive" ? 1 : 2;
      const byStatus = lifecycle(a) - lifecycle(b);
      if (byStatus !== 0) return byStatus;
      return a.labelFa.localeCompare(b.labelFa, "fa");
    });
}

/**
 * The policy that governs `serviceKey`: the exact row, else the `__default__`
 * row, else a synthesized in-memory default so a service added to the
 * catalogue never blocks a referral.
 */
export function getSlaPolicyForService(serviceKey: string | null | undefined): ServiceSlaPolicy {
  const key = serviceKey ?? DEFAULT_SLA_SERVICE_KEY;
  const rows = readTable<ServiceSlaPolicy>(POLICY_TABLE).map(normalizePolicy);
  const exact = rows.find((r) => r.serviceKey === key);
  if (exact) return exact;
  // A service whose own policy was ARCHIVED must not silently inherit the
  // default: archiving is the operator saying "this service has no deadline
  // right now". Its own (archived) row is returned so the UI can say so.
  const archivedOwn = rows.find(
    (r) => r.serviceKey === key && r.status === "archived"
  );
  if (archivedOwn) return archivedOwn;
  const fallback = rows.find((r) => r.serviceKey === DEFAULT_SLA_SERVICE_KEY);
  if (fallback) return { ...fallback, serviceKey: key };
  return defaultPolicy(key, key === DEFAULT_SLA_SERVICE_KEY ? "پیش‌فرض (همهٔ درخواست‌ها)" : key);
}

export interface SlaPolicyInput {
  serviceKey: string;
  labelFa: string;
  /** Optional so a caller that predates the audience field still validates. */
  audience?: ServiceSlaPolicy["audience"];
  priority?: ServiceSlaPolicy["priority"];
  responseHours: number;
  completionHours: number;
  clock: ServiceSlaPolicy["clock"];
  pauseBehavior: ServiceSlaPolicy["pauseBehavior"];
  warnBeforeHours: number;
  /** Optional: `active` / `inactive` / `archived`. Legacy callers used `enabled`. */
  status?: ServiceSlaPolicy["status"];
  /** Legacy flag, honoured only when `status` is absent. */
  enabled?: boolean;
}

const SLA_AUDIENCES = ["user", "lawyer", "both"] as const;
const SLA_PRIORITIES = ["HIGH", "NORMAL", "LOW"] as const;
const SLA_STATUSES = ["active", "inactive", "archived"] as const;

/**
 * Resolve the lifecycle from the new `status`, the legacy `enabled` flag, or —
 * when a caller supplies NEITHER — the policy's current status. That last case
 * matters: a partial PATCH that only edits hours must not silently re-activate
 * a policy the operator deliberately paused.
 */
export function resolvePolicyStatus(
  input: { status?: ServiceSlaPolicy["status"]; enabled?: boolean },
  current: ServiceSlaPolicy["status"] = "active"
): ServiceSlaPolicy["status"] {
  if (input.status) return input.status;
  if (input.enabled !== undefined) return input.enabled === false ? "inactive" : "active";
  return current;
}

function validatePolicy(input: SlaPolicyInput): string | null {
  if (!input.serviceKey.trim()) return "شناسهٔ سرویس الزامی است.";
  if (!input.labelFa.trim()) return "عنوان سیاست الزامی است.";
  if (input.audience !== undefined && !SLA_AUDIENCES.includes(input.audience)) {
    return "مخاطب سیاست باید «کاربر»، «وکیل» یا «هر دو» باشد.";
  }
  if (input.priority !== undefined && !SLA_PRIORITIES.includes(input.priority)) {
    return "اولویت سیاست معتبر نیست.";
  }
  if (input.status !== undefined && !SLA_STATUSES.includes(input.status)) {
    return "وضعیت سیاست معتبر نیست.";
  }
  for (const [label, value] of [
    ["مهلت پاسخ", input.responseHours],
    ["مهلت تکمیل", input.completionHours],
    ["هشدار پیش از مهلت", input.warnBeforeHours],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 24 * 60) {
      return `${label} باید عددی بین ۰ و ${24 * 60} ساعت باشد.`;
    }
  }
  if (input.responseHours <= 0) return "مهلت پاسخ باید بزرگ‌تر از صفر باشد.";
  if (input.completionHours <= 0) return "مهلت تکمیل باید بزرگ‌تر از صفر باشد.";
  if (input.clock !== "CALENDAR" && input.clock !== "BUSINESS_HOURS") {
    return "نوع ساعت معتبر نیست.";
  }
  if (input.pauseBehavior !== "PAUSE" && input.pauseBehavior !== "CONTINUE") {
    return "رفتار ساعت هنگام انتظار کاربر معتبر نیست.";
  }
  return null;
}

export function saveSlaPolicy(
  input: SlaPolicyInput,
  actor: CommandActor
): { ok: true; policy: ServiceSlaPolicy } | { ok: false; messageFa: string } {
  const error = validatePolicy(input);
  if (error) return { ok: false, messageFa: error };
  // The `__default__` row is the fallback every unconfigured service inherits.
  // Archiving it would leave those services with no deadline at all while the
  // UI still claimed a platform-wide policy existed — so it may be deactivated
  // (clock paused) but never archived.
  if (
    input.serviceKey === DEFAULT_SLA_SERVICE_KEY &&
    resolvePolicyStatus(input) === "archived"
  ) {
    return { ok: false, messageFa: "سیاست پیش‌فرض را می‌توان غیرفعال کرد، اما بایگانی آن مجاز نیست." };
  }

  const rows = readTable<ServiceSlaPolicy>(POLICY_TABLE);
  const idx = rows.findIndex((r) => r.serviceKey === input.serviceKey);
  const before = idx === -1 ? null : normalizePolicy(rows[idx]!);
  const policy: ServiceSlaPolicy = {
    id: before?.id ?? `sla-${input.serviceKey}`,
    serviceKey: input.serviceKey,
    labelFa: input.labelFa.trim(),
    audience: input.audience ?? before?.audience ?? "both",
    priority: input.priority ?? before?.priority ?? "NORMAL",
    responseHours: input.responseHours,
    completionHours: input.completionHours,
    clock: input.clock,
    pauseBehavior: input.pauseBehavior,
    warnBeforeHours: input.warnBeforeHours,
    status: resolvePolicyStatus(input, before?.status ?? "active"),
    updatedAt: nowIso(),
    updatedBy: actor.userId,
  };
  if (idx === -1) rows.push(policy);
  else rows[idx] = policy;
  writeTable(POLICY_TABLE, rows);

  // The action name distinguishes a lifecycle change from a numeric edit, so
  // an operator reading the audit log sees "activated/archived" as its own
  // event rather than having to diff two hour counts to find it.
  const lifecycleChange = before !== null && before.status !== policy.status;
  recordAudit({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: lifecycleChange
      ? `sla.policy.${policy.status === "archived" ? "archive" : policy.status === "active" ? "activate" : "deactivate"}`
      : "sla.policy.update",
    resourceType: "sla_policy",
    resourceId: policy.serviceKey,
    before: before ? { ...before } : null,
    after: { ...policy },
  });
  return { ok: true, policy };
}

export function deleteSlaPolicy(
  serviceKey: string,
  actor: CommandActor
): { ok: boolean; messageFa?: string } {
  if (serviceKey === DEFAULT_SLA_SERVICE_KEY) {
    return { ok: false, messageFa: "سیاست پیش‌فرض قابل حذف نیست." };
  }
  const rows = readTable<ServiceSlaPolicy>(POLICY_TABLE);
  const before = rows.find((r) => r.serviceKey === serviceKey);
  if (!before) return { ok: false, messageFa: "سیاست موردنظر پیدا نشد." };
  writeTable(POLICY_TABLE, rows.filter((r) => r.serviceKey !== serviceKey));
  recordAudit({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: "sla.policy.delete",
    resourceType: "sla_policy",
    resourceId: serviceKey,
    before: { ...before },
    after: null,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Request actions
// ---------------------------------------------------------------------------

export function appendRequestAction(params: {
  requestId: string;
  kind: RequestActionKind;
  actorId: string;
  actorRole: PlatformRole | "system";
  note?: string | null;
  visibility?: RequestActionVisibility;
  metadata?: Record<string, unknown>;
  at?: string;
}): RequestAction {
  const row: RequestAction = {
    id: `ract-${crypto.randomUUID()}`,
    requestId: params.requestId,
    kind: params.kind,
    actorId: params.actorId,
    actorRole: params.actorRole,
    note: params.note ?? null,
    visibility: params.visibility ?? "public",
    metadata: params.metadata,
    createdAt: params.at ?? nowIso(),
  };
  const rows = readTable<RequestAction>(ACTION_TABLE);
  rows.push(row);
  writeTable(ACTION_TABLE, rows);
  return row;
}

export function listRequestActions(requestId: string): RequestAction[] {
  return readTable<RequestAction>(ACTION_TABLE)
    .filter((a) => a.requestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listRequestActionsFor(requestIds: string[]): RequestAction[] {
  const ids = new Set(requestIds);
  return readTable<RequestAction>(ACTION_TABLE)
    .filter((a) => ids.has(a.requestId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// SLA lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * The instant the lawyer received the request. The first assignment state
 * event is authoritative; legacy rows without one fall back to the last
 * update, which is the only defensible default available.
 */
function referralInstant(request: LegalRequest): string {
  const assignedStates = new Set<LegalRequestState>([
    "LAWYER_SELECTED",
    "WAITING_FOR_ACCEPTANCE",
  ]);
  for (const event of listRequestEvents(request.id)) {
    if (event.toState && assignedStates.has(event.toState)) return event.createdAt;
  }
  return request.updatedAt || request.createdAt;
}

/**
 * Additive migration for requests that predate the SLA layer: initialize the
 * snapshot on first read. Idempotent — a request with `sla` is returned as is.
 */
export function ensureRequestSla(request: LegalRequest): LegalRequest {
  if (request.sla) return request;
  const serviceKey = request.serviceKey ?? DEFAULT_SLA_SERVICE_KEY;
  const policy = getSlaPolicyForService(serviceKey);
  const sla = initializeSla({
    policy,
    assignedAt: referralInstant(request),
    calendar: getWorkCalendar(),
  });
  return updateRequest(request.id, { sla, serviceKey }) ?? { ...request, sla, serviceKey };
}

/**
 * Write the sticky breach marker the first time a deadline is observed
 * crossed. Read paths call this; it writes at most once per request.
 */
export function observeSla(request: LegalRequest, now: string = nowIso()): LegalRequest {
  const state = request.sla;
  if (!state || state.breachedAt || state.completedAt || state.declinedAt) return request;
  const policy = getSlaPolicyForService(state.serviceKey);
  const snapshot = slaSnapshot({
    state,
    policy,
    calendar: getWorkCalendar(),
    requestState: request.state,
    now,
  });
  if (!snapshot.breached) return request;
  return updateRequest(request.id, { sla: markBreached(state, now) }) ?? request;
}

function policyFor(request: LegalRequest): ServiceSlaPolicy {
  return getSlaPolicyForService(request.sla?.serviceKey ?? request.serviceKey);
}

/** Load a request that is assigned to `lawyerId`; anything else is not found. */
function loadOwnedRequest(requestId: string, lawyerId: string): LegalRequest | CommandResult {
  const row = getRequestById(requestId);
  if (!row || row.selectedLawyerId !== lawyerId) {
    // 404, not 403: never reveal that another lawyer's request exists.
    return fail("not_found", "درخواست پیدا نشد.");
  }
  return observeSla(ensureRequestSla(row));
}

function isFailure(value: LegalRequest | CommandResult): value is CommandResult {
  return (value as CommandResult).ok === false;
}

export function getLawyerIdForUser(userId: string): string | null {
  return getLawyerProfileByUserId(userId)?.id ?? null;
}

/** Write a message on the request's own thread, creating it on first use. */
function postCaseMessage(request: LegalRequest, actor: CommandActor, body: string): void {
  const thread = getOrCreateThread(request.id, request.caseId ?? null, [
    request.userId,
    actor.userId,
  ]);
  appendMessage({
    threadId: thread.id,
    senderUserId: actor.userId,
    senderRole: actor.role,
    body,
  });
}

// ---------------------------------------------------------------------------
// Lawyer workflow commands
// ---------------------------------------------------------------------------

/** Opening the request records the view once and never re-writes it. */
export function markRequestViewed(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
}): CommandResult {
  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (request.sla?.viewedAt) return { ok: true, request, action: null };

  const at = nowIso();
  const sla = request.sla ? markViewed(request.sla, at) : request.sla;
  const updated = updateRequest(request.id, { sla }) ?? request;
  const action = appendRequestAction({
    requestId: request.id,
    kind: "VIEWED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    visibility: "public",
    at,
  });
  return { ok: true, request: updated, action };
}

export function acceptRequest(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
}): CommandResult {
  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (request.state !== "WAITING_FOR_ACCEPTANCE") {
    return fail("illegal_state", "این درخواست در وضعیت قابل پذیرش نیست.");
  }

  const at = nowIso();
  const policy = policyFor(request);
  const sla = request.sla
    ? markAccepted({ state: request.sla, policy, calendar: getWorkCalendar(), at })
    : request.sla;

  const rate = getLawyerRate(params.lawyerId, sla?.serviceKey ?? request.serviceKey);
  const agreedRate = rate
    ? {
        serviceKey: rate.serviceKey,
        amountToman: rate.amountToman,
        unit: rate.unit,
        agreedAt: at,
      }
    : null;

  // Acceptance is what creates the Case — the architectural centre the
  // client-driven transition route also creates. Done once, keyed on the
  // request's own `caseId`.
  let caseId = request.caseId;
  if (!caseId) {
    caseId = crypto.randomUUID();
    createCase({
      id: caseId,
      userId: request.userId,
      title: request.title,
      description: `پرونده ایجادشده از درخواست «${request.title}»`,
      category: request.category,
      priority: "medium",
    });
    addCaseTimelineEvent({
      id: crypto.randomUUID(),
      caseId,
      eventType: "case_created",
      title: "ایجاد پرونده از درخواست",
      description: `پرونده از درخواست «${request.title}» ایجاد شد`,
      metadata: { requestId: request.id },
    });
  }

  // Acceptance is also what GRANTS the lawyer access to the case. The
  // `/api/v1/cases/**` routes authorize through `resolveCaseAccess`, which
  // reads `case_members`; without this row the lawyer creates the case and
  // then cannot open it. Keyed on the USER id (the same key those routes
  // resolve), `lawyer` role = write access without owner-only powers.
  addCaseMember({
    id: crypto.randomUUID(),
    caseId,
    accountId: params.actor.userId,
    role: "lawyer",
    grantedByUserId: params.actor.userId,
  });

  const result = transitionRequest({
    requestId: request.id,
    to: "ACCEPTED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: "پذیرش درخواست توسط وکیل",
    noteVisibility: "public",
    patch: { sla, agreedRate, caseId },
  });
  if (!result.ok || !result.request) return fail("conflict", "تغییر وضعیت انجام نشد.");
  return { ok: true, request: result.request, action: null };
}

export function declineRequest(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  reason: string;
}): CommandResult {
  const reason = params.reason.trim();
  if (reason.length < 5) {
    return fail("invalid_input", "دلیل رد درخواست الزامی است (حداقل ۵ نویسه).");
  }
  if (reason.length > 1000) {
    return fail("invalid_input", "دلیل رد درخواست بیش از حد طولانی است.");
  }

  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (request.state !== "WAITING_FOR_ACCEPTANCE") {
    return fail("illegal_state", "این درخواست در وضعیت قابل رد نیست.");
  }

  const at = nowIso();
  const sla = request.sla ? markDeclined(request.sla, at) : request.sla;
  const result = transitionRequest({
    requestId: request.id,
    to: "DECLINED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: reason,
    noteVisibility: "public",
    patch: { sla },
  });
  if (!result.ok || !result.request) return fail("conflict", "تغییر وضعیت انجام نشد.");

  // The client deserves the reason in their own case room, not only in the
  // lawyer's history.
  postCaseMessage(request, params.actor, `درخواست توسط وکیل رد شد: ${reason}`);
  return { ok: true, request: result.request, action: null };
}

export function startRequest(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  note?: string | null;
}): CommandResult {
  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (
    !["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_FOR_LAWYER"].includes(
      request.state
    )
  ) {
    return fail("illegal_state", "شروع کار در این وضعیت مجاز نیست.");
  }

  const at = nowIso();
  let sla = request.sla;
  if (sla) {
    sla = markStarted(sla, at);
    // Returning from a client wait resumes the paused clock.
    if (sla.paused) sla = resumeClock(sla, policyFor(request), getWorkCalendar(), at);
  }

  const result = transitionRequest({
    requestId: request.id,
    to: "IN_PROGRESS",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: params.note?.trim() || "شروع کار توسط وکیل",
    noteVisibility: "public",
    patch: { sla },
  });
  if (!result.ok || !result.request) return fail("conflict", "تغییر وضعیت انجام نشد.");
  return { ok: true, request: result.request, action: null };
}

/** Ask the client for information; stops the clock when the policy says so. */
export function requestInformation(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  note: string;
}): CommandResult {
  const note = params.note.trim();
  if (note.length < 3) return fail("invalid_input", "متن درخواست اطلاعات الزامی است.");
  if (note.length > 3000) return fail("invalid_input", "متن درخواست بیش از حد طولانی است.");

  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  const from = request.state;
  const legalFrom = ["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "WAITING_FOR_LAWYER"].includes(from);
  const alreadyWaiting = from === "WAITING_FOR_CLIENT";
  if (!legalFrom && !alreadyWaiting) {
    return fail("illegal_state", "درخواست اطلاعات در این وضعیت مجاز نیست.");
  }

  const at = nowIso();
  const policy = policyFor(request);
  let sla = request.sla;
  if (sla) {
    sla = markInfoRequested(sla, at);
    sla = pauseClock(sla, policy, at);
  }

  if (alreadyWaiting) {
    // No state change is possible; the message and the pause are the record.
    const updated = updateRequest(request.id, { sla }) ?? request;
    postCaseMessage(request, params.actor, note);
    appendRequestAction({
      requestId: request.id,
      kind: "INFO_REQUESTED",
      actorId: params.actor.userId,
      actorRole: params.actor.role,
      note,
      visibility: "public",
      metadata: { resumedWait: true },
      at,
    });
    return { ok: true, request: updated, action: null };
  }

  const result = transitionRequest({
    requestId: request.id,
    to: "WAITING_FOR_CLIENT",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note,
    noteVisibility: "public",
    patch: { sla },
  });
  if (!result.ok || !result.request) return fail("conflict", "تغییر وضعیت انجام نشد.");
  postCaseMessage(request, params.actor, note);
  return { ok: true, request: result.request, action: null };
}

export function completeRequest(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  summary: string;
  documentIds?: string[];
}): CommandResult {
  const summary = params.summary.trim();
  if (summary.length < 10) {
    return fail("invalid_input", "متن نتیجهٔ کار الزامی است (حداقل ۱۰ نویسه).");
  }
  if (summary.length > 5000) return fail("invalid_input", "متن نتیجه بیش از حد طولانی است.");

  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (!["IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_FOR_LAWYER"].includes(request.state)) {
    return fail("illegal_state", "تکمیل درخواست در این وضعیت مجاز نیست.");
  }

  const documentIds = [...new Set(params.documentIds ?? [])];
  if (documentIds.length > 0) {
    const docs = readTable<V1DocumentDetail>("documents");
    const attachments = new Set(request.attachmentDocumentIds ?? []);
    for (const id of documentIds) {
      const doc = docs.find((d) => d.id === id);
      if (!doc) return fail("invalid_input", "یکی از فایل‌های نتیجه پیدا نشد.");
      if (doc.userId !== request.userId && !attachments.has(id)) {
        // A file that belongs to someone else must never be delivered.
        return fail("forbidden", "فایل انتخابی به این درخواست تعلق ندارد.");
      }
    }
  }

  const at = nowIso();
  const sla = request.sla ? markCompleted(request.sla, at) : request.sla;
  const result: LegalRequestResult = {
    summary,
    documentIds,
    deliveredAt: at,
    deliveredBy: params.actor.userId,
  };

  const transition = transitionRequest({
    requestId: request.id,
    to: "COMPLETED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: summary,
    noteVisibility: "public",
    patch: { sla, result },
  });
  if (!transition.ok || !transition.request) return fail("conflict", "تغییر وضعیت انجام نشد.");
  postCaseMessage(request, params.actor, summary);
  return { ok: true, request: transition.request, action: null };
}

/** A message to the client on the request's own thread. */
export function messageClient(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  body: string;
}): CommandResult {
  const body = params.body.trim();
  if (body.length === 0) return fail("invalid_input", "متن پیام خالی است.");
  if (body.length > 5000) return fail("invalid_input", "متن پیام بیش از حد طولانی است.");

  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (request.state === "CLOSED" || request.state === "CANCELLED") {
    return fail("illegal_state", "این درخواست بسته شده است.");
  }
  postCaseMessage(request, params.actor, body);
  return { ok: true, request, action: null };
}

/** A note for the record. `internal` notes never reach the client. */
export function addRequestNote(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  note: string;
  internal?: boolean;
}): CommandResult {
  const note = params.note.trim();
  if (note.length === 0) return fail("invalid_input", "متن یادداشت خالی است.");
  if (note.length > 3000) return fail("invalid_input", "متن یادداشت بیش از حد طولانی است.");

  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;

  const internal = params.internal ?? false;
  const action = appendRequestAction({
    requestId: request.id,
    kind: internal ? "INTERNAL_NOTE" : "NOTE",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note,
    visibility: internal ? "internal" : "public",
  });
  if (!internal) postCaseMessage(request, params.actor, note);
  return { ok: true, request, action };
}

/** Resume a paused clock manually (e.g. the client replied out of band). */
export function resumeRequestClock(params: {
  requestId: string;
  lawyerId: string;
  actor: CommandActor;
  reason?: string;
}): CommandResult {
  const loaded = loadOwnedRequest(params.requestId, params.lawyerId);
  if (isFailure(loaded)) return loaded;
  const request = loaded;
  if (!request.sla?.paused) return { ok: true, request, action: null };

  const at = nowIso();
  const sla = resumeClock(request.sla, policyFor(request), getWorkCalendar(), at);
  const updated = updateRequest(request.id, { sla }) ?? request;
  const action = appendRequestAction({
    requestId: request.id,
    kind: "SLA_RESUMED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: params.reason?.trim() || "ادامهٔ ساعت پاسخ‌گویی",
    visibility: "internal",
    at,
  });
  return { ok: true, request: updated, action };
}

// ---------------------------------------------------------------------------
// Admin SLA override + re-referral
// ---------------------------------------------------------------------------

export function overrideRequestDeadline(params: {
  requestId: string;
  actor: CommandActor;
  phase: SlaPhase;
  nextDueAt: string | null;
  reason: string;
}): CommandResult {
  const reason = params.reason.trim();
  if (reason.length < 5) return fail("invalid_input", "دلیل تغییر مهلت الزامی است.");
  if (params.nextDueAt && !Number.isFinite(Date.parse(params.nextDueAt))) {
    return fail("invalid_input", "مهلت جدید معتبر نیست.");
  }
  if (params.phase === "DONE") {
    return fail("invalid_input", "برای درخواست پایان‌یافته مهلت قابل تغییر نیست.");
  }

  const row = getRequestById(params.requestId);
  if (!row) return fail("not_found", "درخواست پیدا نشد.");
  const request = observeSla(ensureRequestSla(row));
  if (!request.sla) return fail("conflict", "این درخواست وضعیت مهلت ندارد.");

  const at = nowIso();
  const { state, override } = applyOverride({
    state: request.sla,
    phase: params.phase,
    nextDueAt: params.nextDueAt,
    actorId: params.actor.userId,
    reason,
    at,
  });
  const updated = updateRequest(request.id, { sla: state }) ?? request;
  appendRequestAction({
    requestId: request.id,
    kind: "SLA_OVERRIDDEN",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: reason,
    visibility: "internal",
    metadata: { ...override },
    at,
  });
  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "request.sla.override",
    resourceType: "legal_request",
    resourceId: request.id,
    requestId: request.id,
    reason,
    before: { phase: params.phase, previousDueAt: override.previousDueAt },
    after: { phase: params.phase, nextDueAt: params.nextDueAt },
  });
  return { ok: true, request: updated, action: null };
}

const REASSIGN_PATH: Partial<Record<LegalRequestState, LegalRequestState[]>> = {
  LAWYER_PROPOSED: ["LAWYER_SELECTED", "WAITING_FOR_ACCEPTANCE"],
  LAWYER_SELECTED: ["WAITING_FOR_ACCEPTANCE"],
  WAITING_FOR_ACCEPTANCE: ["WAITING_FOR_ACCEPTANCE"],
  DECLINED: ["LAWYER_PROPOSED", "LAWYER_SELECTED", "WAITING_FOR_ACCEPTANCE"],
};

/**
 * Re-refer a request to another lawyer. Only states that have not started
 * work can be reassigned; an in-flight engagement must be cancelled and
 * re-issued, so the original request's history is never rewritten.
 */
export function reassignRequest(params: {
  requestId: string;
  actor: CommandActor;
  lawyerId: string;
  reason: string;
}): CommandResult {
  const reason = params.reason.trim();
  if (reason.length < 5) return fail("invalid_input", "دلیل ارجاع مجدد الزامی است.");

  const row = getRequestById(params.requestId);
  if (!row) return fail("not_found", "درخواست پیدا نشد.");
  if (row.state === "CLOSED" || row.state === "CANCELLED") {
    return fail("illegal_state", "درخواست بسته‌شده قابل ارجاع مجدد نیست.");
  }
  const path = REASSIGN_PATH[row.state];
  if (!path) {
    return fail(
      "illegal_state",
      "این درخواست در حال انجام است؛ برای ارجاع مجدد ابتدا آن را لغو و درخواست تازه ثبت کنید."
    );
  }

  const assigned = assignRequestLawyer({
    requestId: row.id,
    lawyerId: params.lawyerId,
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: reason,
    noteVisibility: "public",
  });
  if (!assigned.ok) {
    return fail(
      assigned.reason === "terminal" ? "illegal_state" : "not_found",
      "ارجاع مجدد انجام نشد."
    );
  }

  // A new lawyer gets a fresh clock: the old obligation ended with the
  // previous referral.
  const at = nowIso();
  const serviceKey = row.serviceKey ?? DEFAULT_SLA_SERVICE_KEY;
  const sla = initializeSla({
    policy: getSlaPolicyForService(serviceKey),
    assignedAt: at,
    calendar: getWorkCalendar(),
  });

  let current = assigned.request;
  for (let i = 0; i < path.length; i++) {
    const to = path[i]!;
    const isLast = i === path.length - 1;
    const result = transitionRequest({
      requestId: row.id,
      to,
      actorId: params.actor.userId,
      actorRole: params.actor.role,
      note: isLast ? reason : "ارجاع مجدد توسط پشتیبانی",
      noteVisibility: "public",
      patch: isLast ? { sla, agreedRate: null, result: null } : undefined,
    });
    if (!result.ok || !result.request) return fail("conflict", "ارجاع مجدد نیمه‌کاره ماند.");
    current = result.request;
  }

  appendRequestAction({
    requestId: row.id,
    kind: "REASSIGNED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    note: reason,
    visibility: "internal",
    metadata: { lawyerId: params.lawyerId, previousLawyerId: row.selectedLawyerId ?? null },
    at,
  });
  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "request.reassign",
    resourceType: "legal_request",
    resourceId: row.id,
    requestId: row.id,
    reason,
    before: { lawyerId: row.selectedLawyerId ?? null, state: row.state },
    after: { lawyerId: params.lawyerId, state: current.state },
  });

  return { ok: true, request: current, action: null };
}

// ---------------------------------------------------------------------------
// Professional rates
// ---------------------------------------------------------------------------

interface LawyerRateRow extends LawyerServiceRate {
  lawyerId: string;
  updatedAt: string;
}

function rateRowToPublic(row: LawyerRateRow): LawyerServiceRate {
  return {
    serviceKey: row.serviceKey,
    amountToman: row.amountToman,
    unit: row.unit,
    noteFa: row.noteFa ?? null,
  };
}

export function listLawyerRates(lawyerId: string): LawyerServiceRate[] {
  return readTable<LawyerRateRow>(RATE_TABLE)
    .filter((r) => r.lawyerId === lawyerId)
    .sort((a, b) => a.serviceKey.localeCompare(b.serviceKey))
    .map(rateRowToPublic);
}

export function getLawyerRate(
  lawyerId: string,
  serviceKey: string | null | undefined
): LawyerServiceRate | null {
  if (!serviceKey) return null;
  const row = readTable<LawyerRateRow>(RATE_TABLE).find(
    (r) => r.lawyerId === lawyerId && r.serviceKey === serviceKey
  );
  return row ? rateRowToPublic(row) : null;
}

export function listLawyerRateChanges(lawyerId: string): LawyerRateChange[] {
  return (
    readTable<LawyerRateChange>(RATE_CHANGE_TABLE)
      .filter((c) => c.lawyerId === lawyerId)
      // Reverse BEFORE sorting, because the table is in append order. `sort` is
      // stable, so reversing first makes the newer of two identical-millisecond
      // rows win the tie; comparing `createdAt` alone left ties in table order,
      // which is oldest-first. That is the opposite of the newest-first contract
      // this list is read under — the admin takes `.slice(0, 30)` as "the 30 most
      // recent" — so a tie showed the history backwards and could truncate the
      // newest row. Two writes inside one millisecond is not hypothetical: it
      // flaked CI twice on 2026-10-24.
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

const RATE_UNITS: ReadonlySet<LawyerRateUnit> = new Set(["FIXED", "HOURLY", "PER_SESSION"]);

/**
 * Publish or change one service price. The change is append-only, so a
 * request accepted earlier keeps the `agreedRate` snapshot it was accepted
 * with and is never repriced.
 */
export function setLawyerRate(params: {
  lawyerId: string;
  actor: CommandActor;
  serviceKey: string;
  amountToman: number;
  unit: LawyerRateUnit;
  noteFa?: string | null;
}): { ok: true; rate: LawyerServiceRate } | { ok: false; messageFa: string } {
  if (!params.serviceKey.trim()) return { ok: false, messageFa: "شناسهٔ سرویس الزامی است." };
  if (!Number.isInteger(params.amountToman) || params.amountToman < 0) {
    return { ok: false, messageFa: "مبلغ باید عددی صحیح و نامنفی (تومان) باشد." };
  }
  if (params.amountToman > 100_000_000_000) {
    return { ok: false, messageFa: "مبلغ واردشده معتبر نیست." };
  }
  if (!RATE_UNITS.has(params.unit)) return { ok: false, messageFa: "روش محاسبه معتبر نیست." };

  const rows = readTable<LawyerRateRow>(RATE_TABLE);
  const idx = rows.findIndex(
    (r) => r.lawyerId === params.lawyerId && r.serviceKey === params.serviceKey
  );
  const previous = idx === -1 ? null : rows[idx]!;
  const next: LawyerRateRow = {
    lawyerId: params.lawyerId,
    serviceKey: params.serviceKey,
    amountToman: params.amountToman,
    unit: params.unit,
    noteFa: params.noteFa?.trim() || null,
    updatedAt: nowIso(),
  };
  if (idx === -1) rows.push(next);
  else rows[idx] = next;
  writeTable(RATE_TABLE, rows);

  const change: LawyerRateChange = {
    id: `rchg-${crypto.randomUUID()}`,
    lawyerId: params.lawyerId,
    serviceKey: params.serviceKey,
    previousAmountToman: previous?.amountToman ?? null,
    nextAmountToman: next.amountToman,
    previousUnit: previous?.unit ?? null,
    nextUnit: next.unit,
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    createdAt: next.updatedAt,
  };
  const changes = readTable<LawyerRateChange>(RATE_CHANGE_TABLE);
  changes.push(change);
  writeTable(RATE_CHANGE_TABLE, changes);

  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "lawyer.rate.update",
    resourceType: "lawyer_rate",
    resourceId: `${params.lawyerId}:${params.serviceKey}`,
    before: previous ? { amountToman: previous.amountToman, unit: previous.unit } : null,
    after: { amountToman: next.amountToman, unit: next.unit },
  });

  return { ok: true, rate: rateRowToPublic(next) };
}

export function clearLawyerRate(params: {
  lawyerId: string;
  actor: CommandActor;
  serviceKey: string;
}): { ok: true; change: LawyerRateChange } | { ok: false; reason: "not_found" } {
  const rows = readTable<LawyerRateRow>(RATE_TABLE);
  const idx = rows.findIndex(
    (r) => r.lawyerId === params.lawyerId && r.serviceKey === params.serviceKey
  );
  if (idx === -1) return { ok: false, reason: "not_found" };
  const previous = rows[idx]!;
  rows.splice(idx, 1);
  writeTable(RATE_TABLE, rows);

  const change: LawyerRateChange = {
    id: `rchg-${crypto.randomUUID()}`,
    lawyerId: params.lawyerId,
    serviceKey: params.serviceKey,
    previousAmountToman: previous.amountToman,
    nextAmountToman: null,
    previousUnit: previous.unit,
    nextUnit: null,
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    createdAt: nowIso(),
  };
  const changes = readTable<LawyerRateChange>(RATE_CHANGE_TABLE);
  changes.push(change);
  writeTable(RATE_CHANGE_TABLE, changes);
  return { ok: true, change };
}

// ---------------------------------------------------------------------------
// Settlement (bank) account
// ---------------------------------------------------------------------------

export function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) return "••••";
  return `${compact.slice(0, 4)}${"•".repeat(Math.max(4, compact.length - 8))}${compact.slice(-4)}`;
}

export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, compact.length - 4))}${compact.slice(-4)}`;
}

/** Validate the Iranian IBAN (IR + 24 digits) and return the canonical form. */
export function normalizeAndValidateIban(value: string): string | null {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return /^IR\d{24}$/.test(compact) ? compact : null;
}

/**
 * The Luhn checksum every Iranian payment card carries. Catches a mistyped
 * digit before the number is ever accepted for review.
 */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * The only card projection that is ever persisted: the BIN prefix, a fixed
 * run of bullets and the last four. The middle six digits never reach disk.
 */
export function maskCardNumber(digits: string): string {
  const compact = digits.replace(/\D/g, "");
  if (compact.length < 10) return `••••${compact.slice(-4)}`;
  return `${compact.slice(0, 6)} •••• •••• ${compact.slice(-4)}`;
}

export function getBankRecord(lawyerId: string): LawyerBankRecord {
  const row = readTable<LawyerBankRecord>(BANK_TABLE).find((r) => r.lawyerId === lawyerId);
  return (
    row ?? {
      lawyerId,
      status: "NOT_SET",
      account: null,
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      updatedAt: "1970-01-01T00:00:00.000Z",
    }
  );
}

/** The masked account — the only shape a list or a non-owner may see. */
export function maskBankAccount(account: LawyerBankAccount): LawyerBankAccount {
  return {
    holderName: account.holderName,
    bankName: account.bankName,
    iban: maskIban(account.iban),
    accountNumber: maskAccountNumber(account.accountNumber),
    cardLast4: account.cardLast4 ? `••••${account.cardLast4.slice(-4)}` : null,
    cardMasked: account.cardMasked ?? null,
  };
}

export function listBankEvents(lawyerId: string): LawyerBankEvent[] {
  return readTable<LawyerBankEvent>(BANK_EVENT_TABLE)
    .filter((e) => e.lawyerId === lawyerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function submitBankAccount(params: {
  lawyerId: string;
  actor: CommandActor;
  submission: LawyerBankSubmission;
}): { ok: true; record: LawyerBankRecord } | { ok: false; messageFa: string } {
  const holderName = params.submission.holderName.trim();
  const bankName = params.submission.bankName.trim();
  if (holderName.length < 3) return { ok: false, messageFa: "نام صاحب حساب الزامی است." };
  if (bankName.length < 2) return { ok: false, messageFa: "نام بانک الزامی است." };

  const iban = normalizeAndValidateIban(params.submission.iban);
  if (!iban) {
    return { ok: false, messageFa: "شماره شبا باید ۲۴ رقم بعد از IR باشد." };
  }

  const accountNumber = params.submission.accountNumber?.trim() || null;
  if (accountNumber && !/^\d{6,30}$/.test(accountNumber)) {
    return { ok: false, messageFa: "شمارهٔ حساب باید فقط رقم و بین ۶ تا ۳۰ رقم باشد." };
  }

  // A full card number (when given) is the authoritative card input: it is
  // checksum-validated, reduced to BIN + last four and then DISCARDED. The
  // legacy four-digit-only path stays for callers that predate the field.
  const rawCard = params.submission.cardNumber?.replace(/\D/g, "") ?? "";
  let cardLast4: string | null = null;
  let cardMasked: string | null = null;
  if (rawCard) {
    if (rawCard.length !== 16) {
      return { ok: false, messageFa: "شمارهٔ کارت باید ۱۶ رقم باشد." };
    }
    if (!luhnValid(rawCard)) {
      return { ok: false, messageFa: "شمارهٔ کارت معتبر نیست؛ ارقام را بررسی کنید." };
    }
    cardLast4 = rawCard.slice(-4);
    cardMasked = maskCardNumber(rawCard);
  } else {
    cardLast4 = params.submission.cardLast4?.replace(/\D/g, "").slice(-4) || null;
    if (cardLast4 && cardLast4.length !== 4) {
      return { ok: false, messageFa: "چهار رقم آخر کارت باید ۴ رقم باشد." };
    }
  }

  const at = nowIso();
  const account: LawyerBankAccount = {
    holderName,
    bankName,
    iban,
    accountNumber,
    cardLast4,
    cardMasked,
  };
  const record: LawyerBankRecord = {
    lawyerId: params.lawyerId,
    status: "PENDING_REVIEW",
    account,
    submittedAt: at,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    updatedAt: at,
  };

  const rows = readTable<LawyerBankRecord>(BANK_TABLE);
  const idx = rows.findIndex((r) => r.lawyerId === params.lawyerId);
  if (idx === -1) rows.push(record);
  else rows[idx] = record;
  writeTable(BANK_TABLE, rows);

  const event: LawyerBankEvent = {
    id: `bev-${crypto.randomUUID()}`,
    lawyerId: params.lawyerId,
    action: "SUBMITTED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    reason: null,
    destinationMasked: maskIban(iban),
    createdAt: at,
  };
  const events = readTable<LawyerBankEvent>(BANK_EVENT_TABLE);
  events.push(event);
  writeTable(BANK_EVENT_TABLE, events);

  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "lawyer.bank.submit",
    resourceType: "lawyer_bank_account",
    resourceId: params.lawyerId,
    after: { status: record.status, destinationMasked: event.destinationMasked, holderName },
  });

  return { ok: true, record };
}

export function reviewBankAccount(params: {
  lawyerId: string;
  actor: CommandActor;
  review: LawyerBankReview;
}): { ok: true; record: LawyerBankRecord } | { ok: false; messageFa: string } {
  const rows = readTable<LawyerBankRecord>(BANK_TABLE);
  const idx = rows.findIndex((r) => r.lawyerId === params.lawyerId);
  if (idx === -1 || !rows[idx]!.account) {
    return { ok: false, messageFa: "این وکیل هنوز حساب تسویه ثبت نکرده است." };
  }
  const current = rows[idx]!;
  const reason = params.review.reason?.trim() || null;

  if (params.review.action === "REQUEST_CORRECTION" && (!reason || reason.length < 5)) {
    return { ok: false, messageFa: "برای درخواست اصلاح، ثبت دلیل الزامی است." };
  }
  if (params.review.action !== "VERIFY" && params.review.action !== "REQUEST_CORRECTION") {
    return { ok: false, messageFa: "نوع تصمیم معتبر نیست." };
  }

  const at = nowIso();
  const status = params.review.action === "VERIFY" ? "VERIFIED" : "NEEDS_CORRECTION";
  const record: LawyerBankRecord = {
    ...current,
    status,
    reviewedAt: at,
    reviewedBy: params.actor.userId,
    reviewNote: reason,
    updatedAt: at,
  };
  rows[idx] = record;
  writeTable(BANK_TABLE, rows);

  const event: LawyerBankEvent = {
    id: `bev-${crypto.randomUUID()}`,
    lawyerId: params.lawyerId,
    action: params.review.action === "VERIFY" ? "VERIFIED" : "CORRECTION_REQUESTED",
    actorId: params.actor.userId,
    actorRole: params.actor.role,
    reason,
    destinationMasked: current.account ? maskIban(current.account.iban) : null,
    createdAt: at,
  };
  const events = readTable<LawyerBankEvent>(BANK_EVENT_TABLE);
  events.push(event);
  writeTable(BANK_EVENT_TABLE, events);

  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "lawyer.bank.review",
    resourceType: "lawyer_bank_account",
    resourceId: params.lawyerId,
    reason,
    before: { status: current.status },
    after: { status },
  });

  return { ok: true, record };
}

/**
 * An operator replacing the settlement account on the lawyer's behalf.
 *
 * Same validation as the lawyer's own submission, but the event is recorded
 * as `ADMIN_UPDATED` (so the trail distinguishes who supplied the details),
 * a reason is mandatory, and the record still lands in `PENDING_REVIEW` — an
 * admin edit is a correction, never a self-approval. The full IBAN is used
 * only to write the masked snapshot and is never returned.
 */
export function replaceBankAccountAsAdmin(params: {
  lawyerId: string;
  actor: CommandActor;
  submission: LawyerBankSubmission;
  reason: string;
}): { ok: true; record: LawyerBankRecord } | { ok: false; messageFa: string } {
  const reason = params.reason.trim();
  if (reason.length < 5) {
    return { ok: false, messageFa: "برای ویرایش اطلاعات بانکی، ثبت دلیل الزامی است." };
  }

  const previous = getBankRecord(params.lawyerId);
  const saved = submitBankAccount({
    lawyerId: params.lawyerId,
    actor: params.actor,
    submission: params.submission,
  });
  if (!saved.ok) return saved;

  // `submitBankAccount` already wrote a SUBMITTED event. Rewrite that row so
  // the trail says an operator made the change, not the lawyer — editing the
  // just-appended row keeps the log append-only (no event is ever removed).
  const events = readTable<LawyerBankEvent>(BANK_EVENT_TABLE);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.lawyerId !== params.lawyerId) continue;
    if (e.action !== "SUBMITTED") continue;
    if (e.actorId !== params.actor.userId) continue;
    events[i] = { ...e, action: "ADMIN_UPDATED", reason };
    break;
  }
  writeTable(BANK_EVENT_TABLE, events);

  recordAudit({
    actorUserId: params.actor.userId,
    actorRole: params.actor.role,
    action: "lawyer.bank.admin_update",
    resourceType: "lawyer_bank_account",
    resourceId: params.lawyerId,
    reason,
    before: { status: previous.status },
    after: { status: saved.record.status },
  });

  return saved;
}

// ---------------------------------------------------------------------------
// Referral creation hooks used by assignment paths
// ---------------------------------------------------------------------------

/**
 * Start the SLA clock for a request that has just been referred to a lawyer.
 * Called from the assignment route so a new referral never waits for the
 * first read to get a clock.
 */
export function startReferralClock(params: {
  requestId: string;
  assignedAt?: string;
}): LegalRequest | null {
  const row = getRequestById(params.requestId);
  if (!row) return null;
  if (row.sla) return row;
  const serviceKey = row.serviceKey ?? DEFAULT_SLA_SERVICE_KEY;
  const sla = initializeSla({
    policy: getSlaPolicyForService(serviceKey),
    assignedAt: params.assignedAt ?? referralInstant(row),
    calendar: getWorkCalendar(),
  });
  return updateRequest(row.id, { sla, serviceKey }) ?? row;
}
