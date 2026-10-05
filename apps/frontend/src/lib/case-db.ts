// ============================================================
// Case Management — DB Types & Operations
// ============================================================
// Persistence is the hand-rolled JSON table store in `.data/`. Schema
// evolution is ADDITIVE: every new field is optional on the row and is
// filled by a normalizer on read, so rows written before this change keep
// working and are never corrupted.
//
// The four independent concepts (lifecycle / proceeding stage / lawyer
// engagement / representation) each live in their own table. A case's
// `status` (legacy) is kept for backward compatibility but the operational
// model reads `lifecycle` + the primary proceeding's `stage`.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  CaseLifecycleStatus,
  CaseProceedingPath,
  CaseStageKey,
  CaseInfoSource,
  CaseEventVisibility,
  CaseTaskActionType,
  CaseDeadlineKind,
  CaseDeadlineBasis,
  CaseDeadlineReviewState,
  CaseDeadlineOperationalState,
  CaseMemberRole,
  CaseMemberStatus,
  CaseLegalRole,
  LawyerEngagementState,
  LawyerEngagementKind,
  CaseContractKind,
} from "@legalir/types";
import { WORKFLOW_TEMPLATE_VERSION } from "./cases/domain";

const DB_DIR = path.resolve(process.cwd(), ".data");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Tables are re-read on every call, so cache the parse keyed by
// mtime+size. All writes go through `writeTable`, which primes the
// entry — a write can never leave a stale parse behind.
const tableCache = new Map<string, { mtimeMs: number; size: number; data: unknown[] }>();

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    tableCache.delete(name);
    return [];
  }
  const cached = tableCache.get(name);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data as T[];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
    return data;
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  try {
    const stat = fs.statSync(file);
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  } catch {
    tableCache.delete(name);
  }
}

/** A short, human-facing LEGALIR case reference, e.g. LGL-CASE-7F3A2B. */
export function generateInternalRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `LGL-CASE-${suffix}`;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface DbCase {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  /** Legacy status — kept for backward compatibility. */
  status: string;
  priority: string;
  /** The internal LEGALIR lifecycle. */
  lifecycle?: CaseLifecycleStatus;
  /** The human-facing LEGALIR reference (LGL-CASE-…). */
  internal_ref?: string;
  /** Optimistic-concurrency version, bumped on every write. */
  version?: number;
  /** Idempotency key for create — a repeat create returns the same case. */
  idempotency_key?: string | null;
  /** Why the lifecycle last changed. */
  lifecycle_reason?: string | null;
  lifecycle_changed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCaseTimelineEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // --- extended ---
  proceeding_id?: string | null;
  /** When it actually happened (may be in the past). */
  occurred_at?: string;
  /** When it was entered into LEGALIR. */
  recorded_at?: string;
  recorded_by_user_id?: string;
  source?: CaseInfoSource;
  visibility?: CaseEventVisibility;
  document_id?: string | null;
  task_id?: string | null;
  deadline_id?: string | null;
  contract_id?: string | null;
  correlation_id?: string | null;
}

export interface DbCaseTask {
  id: string;
  case_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // --- extended ---
  proceeding_id?: string | null;
  stage_key?: CaseStageKey | null;
  action_type?: CaseTaskActionType;
  assignee_user_id?: string | null;
  created_by_user_id?: string;
  depends_on?: string[];
  checklist?: { id: string; label: string; done: boolean }[];
  result?: string | null;
  result_is_claim?: boolean;
  document_ids?: string[];
  completed_at?: string | null;
}

export interface DbCaseDocument {
  id: string;
  case_id: string;
  document_id: string;
  added_by_user_id: string;
  created_at: string;
}

export interface DbCaseDeadline {
  id: string;
  case_id: string;
  title: string;
  due_at: string;
  /** Where the deadline came from — never AI-invented. */
  source: "user" | "lawyer" | "legal_source" | "system";
  source_ref: string | null;
  /** True when a critical deadline still needs human confirmation. */
  needs_confirmation: boolean;
  completed: boolean;
  created_at: string;
  // --- extended ---
  proceeding_id?: string | null;
  kind?: CaseDeadlineKind;
  date_only?: boolean;
  basis?: CaseDeadlineBasis;
  review_state?: CaseDeadlineReviewState;
  operational_state?: CaseDeadlineOperationalState;
  rule_ref?: string | null;
  source_document_id?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  override_reason?: string | null;
  announced_due_at?: string | null;
  updated_at?: string;
}

export interface DbCaseMember {
  id: string;
  case_id: string;
  account_id: string;
  role: CaseMemberRole;
  scopes: string[];
  status: CaseMemberStatus;
  granted_at: string;
  granted_by_user_id: string;
  revoked_at: string | null;
}

export interface DbCaseParty {
  id: string;
  case_id: string;
  proceeding_id: string | null;
  kind: "person" | "entity" | "contact";
  name: string;
  legal_role: CaseLegalRole;
  national_id: string | null;
  phone: string | null;
  account_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DbCaseProceeding {
  id: string;
  case_id: string;
  path: CaseProceedingPath;
  stage: CaseStageKey;
  template_version: number;
  authority: string | null;
  province: string | null;
  city: string | null;
  branch: string | null;
  judicial_number: string | null;
  archive_number: string | null;
  tracking_code: string | null;
  judgment_id: string | null;
  filed_at: string | null;
  stage_source: CaseInfoSource;
  stage_recorded_at: string;
  parent_proceeding_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLawyerEngagement {
  id: string;
  case_id: string;
  lawyer_profile_id: string;
  lawyer_user_id: string | null;
  kind: LawyerEngagementKind;
  state: LawyerEngagementState;
  shared_scopes: string[];
  owner_consent_at: string | null;
  requested_by_user_id: string;
  requested_at: string;
  responded_at: string | null;
  note: string | null;
}

export interface DbRepresentation {
  id: string;
  case_id: string;
  lawyer_profile_id: string | null;
  lawyer_user_id: string | null;
  document_type: string;
  document_id: string | null;
  reference_number: string | null;
  issued_at: string | null;
  covered_proceeding_ids: string[];
  authority_limits: string | null;
  valid_until: string | null;
  terminated_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCaseContractLink {
  id: string;
  case_id: string;
  contract_id: string;
  kind: CaseContractKind;
  added_by_user_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Normalizers — fill defaults for rows written before this change
// ---------------------------------------------------------------------------

export function normalizeCase(row: DbCase): DbCase {
  return {
    ...row,
    lifecycle: row.lifecycle ?? "ACTIVE",
    internal_ref: row.internal_ref ?? generateInternalRef(),
    version: row.version ?? 1,
    idempotency_key: row.idempotency_key ?? null,
    lifecycle_reason: row.lifecycle_reason ?? null,
    lifecycle_changed_at: row.lifecycle_changed_at ?? null,
  };
}

export function normalizeEvent(row: DbCaseTimelineEvent): DbCaseTimelineEvent {
  return {
    ...row,
    proceeding_id: row.proceeding_id ?? null,
    occurred_at: row.occurred_at ?? row.created_at,
    recorded_at: row.recorded_at ?? row.created_at,
    recorded_by_user_id: row.recorded_by_user_id ?? "",
    source: row.source ?? "user",
    visibility: row.visibility ?? "shared",
    document_id: row.document_id ?? null,
    task_id: row.task_id ?? null,
    deadline_id: row.deadline_id ?? null,
    contract_id: row.contract_id ?? null,
    correlation_id: row.correlation_id ?? null,
  };
}

export function normalizeTask(row: DbCaseTask): DbCaseTask {
  return {
    ...row,
    proceeding_id: row.proceeding_id ?? null,
    stage_key: row.stage_key ?? null,
    action_type: row.action_type ?? "general",
    assignee_user_id: row.assignee_user_id ?? null,
    created_by_user_id: row.created_by_user_id ?? "",
    depends_on: row.depends_on ?? [],
    checklist: row.checklist ?? [],
    result: row.result ?? null,
    result_is_claim: row.result_is_claim ?? false,
    document_ids: row.document_ids ?? [],
    completed_at: row.completed_at ?? null,
  };
}

export function normalizeDeadline(row: DbCaseDeadline): DbCaseDeadline {
  const kind: CaseDeadlineKind = row.kind ?? "legal";
  const basis: CaseDeadlineBasis = row.basis ?? (row.source === "legal_source" ? "computed" : "manual");
  const reviewState: CaseDeadlineReviewState =
    row.review_state ??
    (row.needs_confirmation ? "needs_review" : row.source === "legal_source" ? "proposed" : "user_entered");
  const operationalState: CaseDeadlineOperationalState =
    row.operational_state ?? (row.completed ? "action_done" : "open");
  return {
    ...row,
    proceeding_id: row.proceeding_id ?? null,
    kind,
    date_only: row.date_only ?? true,
    basis,
    review_state: reviewState,
    operational_state: operationalState,
    rule_ref: row.rule_ref ?? row.source_ref ?? null,
    source_document_id: row.source_document_id ?? null,
    reviewed_by_user_id: row.reviewed_by_user_id ?? null,
    reviewed_at: row.reviewed_at ?? null,
    override_reason: row.override_reason ?? null,
    announced_due_at: row.announced_due_at ?? null,
    updated_at: row.updated_at ?? row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Case CRUD
// ---------------------------------------------------------------------------

export function listCases(
  userId: string,
  params?: { status?: string; category?: string; priority?: string; search?: string; page?: number; pageSize?: number }
): { items: DbCase[]; total: number } {
  let rows = readTable<DbCase>("cases")
    .filter((c) => c.user_id === userId)
    .map(normalizeCase);
  if (params?.status) rows = rows.filter((c) => c.status === params.status);
  if (params?.category) rows = rows.filter((c) => c.category === params.category);
  if (params?.priority) rows = rows.filter((c) => c.priority === params.priority);
  if (params?.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = rows.length;
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total };
}

export function getCaseById(caseId: string): DbCase | undefined {
  const row = readTable<DbCase>("cases").find((c) => c.id === caseId);
  return row ? normalizeCase(row) : undefined;
}

/** Find a case by its idempotency key for a user (repeat-create guard). */
export function findCaseByIdempotencyKey(userId: string, key: string): DbCase | undefined {
  const row = readTable<DbCase>("cases").find((c) => c.user_id === userId && c.idempotency_key === key);
  return row ? normalizeCase(row) : undefined;
}

export function createCase(data: {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  idempotencyKey?: string | null;
}): DbCase {
  const now = new Date().toISOString();
  const row: DbCase = {
    id: data.id,
    user_id: data.userId,
    title: data.title,
    description: data.description,
    category: data.category,
    status: "ACTIVE",
    priority: data.priority,
    lifecycle: "ACTIVE",
    internal_ref: generateInternalRef(),
    version: 1,
    idempotency_key: data.idempotencyKey ?? null,
    lifecycle_reason: null,
    lifecycle_changed_at: null,
    created_at: now,
    updated_at: now,
  };
  const cases = readTable<DbCase>("cases");
  cases.push(row);
  writeTable("cases", cases);
  return row;
}

/**
 * Update a case. When `expectedVersion` is supplied, the write is rejected
 * (returns `{ conflict: true }`) if the stored version differs — this is the
 * optimistic-concurrency guard so a silent last-write-wins cannot clobber
 * another user's edit.
 */
export function updateCase(
  caseId: string,
  data: Record<string, unknown>,
  expectedVersion?: number
): { case: DbCase } | { conflict: true } | undefined {
  const cases = readTable<DbCase>("cases");
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return undefined;
  const current = normalizeCase(cases[idx]!);
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    return { conflict: true };
  }
  const next: DbCase = {
    ...current,
    ...(data as Partial<DbCase>),
    version: (current.version ?? 1) + 1,
    updated_at: new Date().toISOString(),
  };
  cases[idx] = next;
  writeTable("cases", cases);
  return { case: next };
}

/**
 * Permanently delete a case and every row that belongs to it. Owner-scoped:
 * a case owned by another user is never touched. Returns true when removed.
 *
 * Linked documents/contracts are NOT deleted — they are independent records
 * that merely reference the case.
 */
export function deleteCase(userId: string, caseId: string): boolean {
  const cases = readTable<DbCase>("cases");
  const target = cases.find((c) => c.id === caseId && c.user_id === userId);
  if (!target) return false;
  writeTable("cases", cases.filter((c) => c.id !== caseId));
  const cascadeTables = [
    "case_tasks",
    "case_timeline",
    "case_documents",
    "case_deadlines",
    "case_members",
    "case_parties",
    "case_proceedings",
    "case_engagements",
    "case_representations",
    "case_contract_links",
  ];
  for (const table of cascadeTables) {
    writeTable(
      table,
      readTable<{ case_id: string }>(table).filter((r) => r.case_id !== caseId)
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Case Timeline
// ---------------------------------------------------------------------------

export function getCaseTimeline(caseId: string): DbCaseTimelineEvent[] {
  return readTable<DbCaseTimelineEvent>("case_timeline")
    .filter((e) => e.case_id === caseId)
    .map(normalizeEvent)
    .sort((a, b) => (b.occurred_at ?? b.created_at).localeCompare(a.occurred_at ?? a.created_at));
}

export function addCaseTimelineEvent(data: {
  id: string;
  caseId: string;
  eventType: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  proceedingId?: string | null;
  occurredAt?: string;
  recordedByUserId?: string;
  source?: CaseInfoSource;
  visibility?: CaseEventVisibility;
  documentId?: string | null;
  taskId?: string | null;
  deadlineId?: string | null;
  contractId?: string | null;
  correlationId?: string | null;
}): DbCaseTimelineEvent {
  const now = new Date().toISOString();
  const event: DbCaseTimelineEvent = {
    id: data.id,
    case_id: data.caseId,
    event_type: data.eventType,
    title: data.title,
    description: data.description,
    metadata: data.metadata ?? {},
    created_at: now,
    proceeding_id: data.proceedingId ?? null,
    occurred_at: data.occurredAt ?? now,
    recorded_at: now,
    recorded_by_user_id: data.recordedByUserId ?? "",
    source: data.source ?? "user",
    visibility: data.visibility ?? "shared",
    document_id: data.documentId ?? null,
    task_id: data.taskId ?? null,
    deadline_id: data.deadlineId ?? null,
    contract_id: data.contractId ?? null,
    correlation_id: data.correlationId ?? null,
  };
  const events = readTable<DbCaseTimelineEvent>("case_timeline");
  events.push(event);
  writeTable("case_timeline", events);
  return event;
}

// ---------------------------------------------------------------------------
// Case Tasks
// ---------------------------------------------------------------------------

export function getCaseTasks(caseId: string): DbCaseTask[] {
  return readTable<DbCaseTask>("case_tasks")
    .filter((t) => t.case_id === caseId)
    .map(normalizeTask)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getCaseTask(caseId: string, taskId: string): DbCaseTask | undefined {
  const row = readTable<DbCaseTask>("case_tasks").find((t) => t.id === taskId && t.case_id === caseId);
  return row ? normalizeTask(row) : undefined;
}

export function createCaseTask(data: {
  id: string;
  caseId: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  proceedingId?: string | null;
  stageKey?: CaseStageKey | null;
  actionType?: CaseTaskActionType;
  assigneeUserId?: string | null;
  createdByUserId?: string;
  dependsOn?: string[];
  checklist?: { id: string; label: string; done: boolean }[];
  documentIds?: string[];
}): DbCaseTask {
  const now = new Date().toISOString();
  const task: DbCaseTask = {
    id: data.id,
    case_id: data.caseId,
    title: data.title,
    description: data.description,
    status: "todo",
    priority: data.priority,
    due_date: data.dueDate,
    created_at: now,
    updated_at: now,
    proceeding_id: data.proceedingId ?? null,
    stage_key: data.stageKey ?? null,
    action_type: data.actionType ?? "general",
    assignee_user_id: data.assigneeUserId ?? null,
    created_by_user_id: data.createdByUserId ?? "",
    depends_on: data.dependsOn ?? [],
    checklist: data.checklist ?? [],
    result: null,
    result_is_claim: false,
    document_ids: data.documentIds ?? [],
    completed_at: null,
  };
  const tasks = readTable<DbCaseTask>("case_tasks");
  tasks.push(task);
  writeTable("case_tasks", tasks);
  return task;
}

export function updateCaseTask(caseId: string, taskId: string, data: Record<string, unknown>): DbCaseTask | undefined {
  const tasks = readTable<DbCaseTask>("case_tasks");
  const idx = tasks.findIndex((t) => t.id === taskId && t.case_id === caseId);
  if (idx === -1) return undefined;
  const current = normalizeTask(tasks[idx]!);
  const next: DbCaseTask = {
    ...current,
    ...(data as Partial<DbCaseTask>),
    updated_at: new Date().toISOString(),
  };
  // Completing a task stamps completed_at; reopening clears it.
  if (next.status === "done" && !next.completed_at) next.completed_at = new Date().toISOString();
  if (next.status !== "done") next.completed_at = null;
  tasks[idx] = next;
  writeTable("case_tasks", tasks);
  return next;
}

/**
 * True when adding `dependsOn` to `taskId` would create a dependency cycle.
 * Walks the existing dependency graph from each proposed dependency.
 */
export function wouldCreateDependencyCycle(caseId: string, taskId: string, dependsOn: string[]): boolean {
  const tasks = getCaseTasks(caseId);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [...dependsOn];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const t = byId.get(current);
    if (t) stack.push(...(t.depends_on ?? []));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Case Documents
// ---------------------------------------------------------------------------
//
// A case document is a LINK, not a copy: the file itself lives in the
// documents table (owned by its uploader), and this table records which
// case it belongs to. Ownership is therefore checked twice — the case
// must belong to the caller, and the document must too.

export function getCaseDocuments(caseId: string): DbCaseDocument[] {
  return readTable<DbCaseDocument>("case_documents")
    .filter((d) => d.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function linkCaseDocument(data: {
  id: string;
  caseId: string;
  documentId: string;
  addedByUserId: string;
}): DbCaseDocument {
  const links = readTable<DbCaseDocument>("case_documents");
  const existing = links.find((d) => d.case_id === data.caseId && d.document_id === data.documentId);
  if (existing) return existing;

  const link: DbCaseDocument = {
    id: data.id,
    case_id: data.caseId,
    document_id: data.documentId,
    added_by_user_id: data.addedByUserId,
    created_at: new Date().toISOString(),
  };
  links.push(link);
  writeTable("case_documents", links);
  return link;
}

export function unlinkCaseDocument(caseId: string, documentId: string): boolean {
  const links = readTable<DbCaseDocument>("case_documents");
  const next = links.filter((d) => !(d.case_id === caseId && d.document_id === documentId));
  if (next.length === links.length) return false;
  writeTable("case_documents", next);
  return true;
}

// ---------------------------------------------------------------------------
// Case Deadlines
// ---------------------------------------------------------------------------

export function getCaseDeadlines(caseId: string): DbCaseDeadline[] {
  return readTable<DbCaseDeadline>("case_deadlines")
    .filter((d) => d.case_id === caseId)
    .map(normalizeDeadline)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

export function getCaseDeadline(caseId: string, deadlineId: string): DbCaseDeadline | undefined {
  const row = readTable<DbCaseDeadline>("case_deadlines").find((d) => d.id === deadlineId && d.case_id === caseId);
  return row ? normalizeDeadline(row) : undefined;
}

export function createCaseDeadline(data: {
  id: string;
  caseId: string;
  title: string;
  dueAt: string;
  source: DbCaseDeadline["source"];
  sourceRef: string | null;
  needsConfirmation: boolean;
  proceedingId?: string | null;
  kind?: CaseDeadlineKind;
  dateOnly?: boolean;
  basis?: CaseDeadlineBasis;
  reviewState?: CaseDeadlineReviewState;
  ruleRef?: string | null;
  sourceDocumentId?: string | null;
  announcedDueAt?: string | null;
}): DbCaseDeadline {
  const now = new Date().toISOString();
  const basis: CaseDeadlineBasis = data.basis ?? (data.source === "legal_source" ? "computed" : "manual");
  const reviewState: CaseDeadlineReviewState =
    data.reviewState ??
    (data.needsConfirmation ? "needs_review" : data.source === "legal_source" ? "proposed" : "user_entered");
  const deadline: DbCaseDeadline = {
    id: data.id,
    case_id: data.caseId,
    title: data.title,
    due_at: data.dueAt,
    source: data.source,
    source_ref: data.sourceRef,
    needs_confirmation: data.needsConfirmation,
    completed: false,
    created_at: now,
    proceeding_id: data.proceedingId ?? null,
    kind: data.kind ?? "legal",
    date_only: data.dateOnly ?? true,
    basis,
    review_state: reviewState,
    operational_state: "open",
    rule_ref: data.ruleRef ?? data.sourceRef ?? null,
    source_document_id: data.sourceDocumentId ?? null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    override_reason: null,
    announced_due_at: data.announcedDueAt ?? null,
    updated_at: now,
  };
  const deadlines = readTable<DbCaseDeadline>("case_deadlines");
  deadlines.push(deadline);
  writeTable("case_deadlines", deadlines);
  return deadline;
}

export function updateCaseDeadline(
  caseId: string,
  deadlineId: string,
  data: Record<string, unknown>
): DbCaseDeadline | undefined {
  const deadlines = readTable<DbCaseDeadline>("case_deadlines");
  const idx = deadlines.findIndex((d) => d.id === deadlineId && d.case_id === caseId);
  if (idx === -1) return undefined;
  const current = normalizeDeadline(deadlines[idx]!);
  const next: DbCaseDeadline = {
    ...current,
    ...(data as Partial<DbCaseDeadline>),
    updated_at: new Date().toISOString(),
  };
  // Keep the legacy `completed` flag in sync with the operational state.
  if (next.operational_state === "action_done") next.completed = true;
  if (next.operational_state === "open") next.completed = false;
  deadlines[idx] = next;
  writeTable("case_deadlines", deadlines);
  return next;
}

export function deleteCaseDeadline(caseId: string, deadlineId: string): boolean {
  const deadlines = readTable<DbCaseDeadline>("case_deadlines");
  const next = deadlines.filter((d) => !(d.id === deadlineId && d.case_id === caseId));
  if (next.length === deadlines.length) return false;
  writeTable("case_deadlines", next);
  return true;
}

// ---------------------------------------------------------------------------
// Case Members
// ---------------------------------------------------------------------------

export function getCaseMembers(caseId: string): DbCaseMember[] {
  return readTable<DbCaseMember>("case_members").filter((m) => m.case_id === caseId);
}

export function getActiveCaseMember(caseId: string, accountId: string): DbCaseMember | undefined {
  return readTable<DbCaseMember>("case_members").find(
    (m) => m.case_id === caseId && m.account_id === accountId && m.status === "active"
  );
}

export function addCaseMember(data: {
  id: string;
  caseId: string;
  accountId: string;
  role: CaseMemberRole;
  scopes?: string[];
  grantedByUserId: string;
}): DbCaseMember {
  const members = readTable<DbCaseMember>("case_members");
  const existing = members.find(
    (m) => m.case_id === data.caseId && m.account_id === data.accountId && m.status === "active"
  );
  if (existing) return existing;
  const member: DbCaseMember = {
    id: data.id,
    case_id: data.caseId,
    account_id: data.accountId,
    role: data.role,
    scopes: data.scopes ?? [],
    status: "active",
    granted_at: new Date().toISOString(),
    granted_by_user_id: data.grantedByUserId,
    revoked_at: null,
  };
  members.push(member);
  writeTable("case_members", members);
  return member;
}

/**
 * Promote an existing active member to a new role (and scopes). Used when a
 * `pending` lawyer accepts an engagement and becomes a collaborating
 * `lawyer`. Returns the updated row, or undefined when no active member
 * exists for that account.
 */
export function updateCaseMemberRole(
  caseId: string,
  accountId: string,
  role: CaseMemberRole,
  scopes?: string[]
): DbCaseMember | undefined {
  const members = readTable<DbCaseMember>("case_members");
  const idx = members.findIndex(
    (m) => m.case_id === caseId && m.account_id === accountId && m.status === "active"
  );
  if (idx === -1) return undefined;
  members[idx] = {
    ...members[idx]!,
    role,
    scopes: scopes ?? members[idx]!.scopes,
  };
  writeTable("case_members", members);
  return members[idx];
}

export function revokeCaseMember(caseId: string, accountId: string): boolean {
  const members = readTable<DbCaseMember>("case_members");
  let changed = false;
  const now = new Date().toISOString();
  for (const m of members) {
    if (m.case_id === caseId && m.account_id === accountId && m.status === "active") {
      m.status = "revoked";
      m.revoked_at = now;
      changed = true;
    }
  }
  if (changed) writeTable("case_members", members);
  return changed;
}

// ---------------------------------------------------------------------------
// Case Parties
// ---------------------------------------------------------------------------

export function getCaseParties(caseId: string): DbCaseParty[] {
  return readTable<DbCaseParty>("case_parties")
    .filter((p) => p.case_id === caseId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createCaseParty(data: {
  id: string;
  caseId: string;
  proceedingId?: string | null;
  kind: "person" | "entity" | "contact";
  name: string;
  legalRole: CaseLegalRole;
  nationalId?: string | null;
  phone?: string | null;
  accountId?: string | null;
  note?: string | null;
}): DbCaseParty {
  const party: DbCaseParty = {
    id: data.id,
    case_id: data.caseId,
    proceeding_id: data.proceedingId ?? null,
    kind: data.kind,
    name: data.name,
    legal_role: data.legalRole,
    national_id: data.nationalId ?? null,
    phone: data.phone ?? null,
    account_id: data.accountId ?? null,
    note: data.note ?? null,
    created_at: new Date().toISOString(),
  };
  const parties = readTable<DbCaseParty>("case_parties");
  parties.push(party);
  writeTable("case_parties", parties);
  return party;
}

export function deleteCaseParty(caseId: string, partyId: string): boolean {
  const parties = readTable<DbCaseParty>("case_parties");
  const next = parties.filter((p) => !(p.id === partyId && p.case_id === caseId));
  if (next.length === parties.length) return false;
  writeTable("case_parties", next);
  return true;
}

// ---------------------------------------------------------------------------
// Case Proceedings
// ---------------------------------------------------------------------------

export function getCaseProceedings(caseId: string): DbCaseProceeding[] {
  return readTable<DbCaseProceeding>("case_proceedings")
    .filter((p) => p.case_id === caseId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getCaseProceeding(caseId: string, proceedingId: string): DbCaseProceeding | undefined {
  return readTable<DbCaseProceeding>("case_proceedings").find(
    (p) => p.id === proceedingId && p.case_id === caseId
  );
}

export function createCaseProceeding(data: {
  id: string;
  caseId: string;
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
  stageSource?: CaseInfoSource;
  parentProceedingId?: string | null;
}): DbCaseProceeding {
  const now = new Date().toISOString();
  const proceeding: DbCaseProceeding = {
    id: data.id,
    case_id: data.caseId,
    path: data.path,
    stage: data.stage,
    template_version: WORKFLOW_TEMPLATE_VERSION,
    authority: data.authority ?? null,
    province: data.province ?? null,
    city: data.city ?? null,
    branch: data.branch ?? null,
    judicial_number: data.judicialNumber ?? null,
    archive_number: data.archiveNumber ?? null,
    tracking_code: data.trackingCode ?? null,
    judgment_id: data.judgmentId ?? null,
    filed_at: data.filedAt ?? null,
    stage_source: data.stageSource ?? "user",
    stage_recorded_at: now,
    parent_proceeding_id: data.parentProceedingId ?? null,
    created_at: now,
    updated_at: now,
  };
  const proceedings = readTable<DbCaseProceeding>("case_proceedings");
  proceedings.push(proceeding);
  writeTable("case_proceedings", proceedings);
  return proceeding;
}

export function updateCaseProceeding(
  caseId: string,
  proceedingId: string,
  data: Record<string, unknown>
): DbCaseProceeding | undefined {
  const proceedings = readTable<DbCaseProceeding>("case_proceedings");
  const idx = proceedings.findIndex((p) => p.id === proceedingId && p.case_id === caseId);
  if (idx === -1) return undefined;
  proceedings[idx] = {
    ...proceedings[idx],
    ...(data as Partial<DbCaseProceeding>),
    updated_at: new Date().toISOString(),
  } as DbCaseProceeding;
  writeTable("case_proceedings", proceedings);
  return proceedings[idx];
}

// ---------------------------------------------------------------------------
// Lawyer Engagements
// ---------------------------------------------------------------------------

export function getCaseEngagements(caseId: string): DbLawyerEngagement[] {
  return readTable<DbLawyerEngagement>("case_engagements")
    .filter((e) => e.case_id === caseId)
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
}

export function getCaseEngagement(caseId: string, engagementId: string): DbLawyerEngagement | undefined {
  return readTable<DbLawyerEngagement>("case_engagements").find(
    (e) => e.id === engagementId && e.case_id === caseId
  );
}

export function createCaseEngagement(data: {
  id: string;
  caseId: string;
  lawyerProfileId: string;
  lawyerUserId: string | null;
  kind: LawyerEngagementKind;
  sharedScopes: string[];
  ownerConsentAt: string | null;
  requestedByUserId: string;
  note?: string | null;
}): DbLawyerEngagement {
  const engagement: DbLawyerEngagement = {
    id: data.id,
    case_id: data.caseId,
    lawyer_profile_id: data.lawyerProfileId,
    lawyer_user_id: data.lawyerUserId,
    kind: data.kind,
    state: "requested",
    shared_scopes: data.sharedScopes,
    owner_consent_at: data.ownerConsentAt,
    requested_by_user_id: data.requestedByUserId,
    requested_at: new Date().toISOString(),
    responded_at: null,
    note: data.note ?? null,
  };
  const engagements = readTable<DbLawyerEngagement>("case_engagements");
  engagements.push(engagement);
  writeTable("case_engagements", engagements);
  return engagement;
}

export function updateCaseEngagement(
  caseId: string,
  engagementId: string,
  data: Record<string, unknown>
): DbLawyerEngagement | undefined {
  const engagements = readTable<DbLawyerEngagement>("case_engagements");
  const idx = engagements.findIndex((e) => e.id === engagementId && e.case_id === caseId);
  if (idx === -1) return undefined;
  engagements[idx] = { ...engagements[idx], ...(data as Partial<DbLawyerEngagement>) } as DbLawyerEngagement;
  writeTable("case_engagements", engagements);
  return engagements[idx];
}

// ---------------------------------------------------------------------------
// Representation records
// ---------------------------------------------------------------------------

export function getCaseRepresentations(caseId: string): DbRepresentation[] {
  return readTable<DbRepresentation>("case_representations")
    .filter((r) => r.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createCaseRepresentation(data: {
  id: string;
  caseId: string;
  lawyerProfileId?: string | null;
  lawyerUserId?: string | null;
  documentType: string;
  documentId?: string | null;
  referenceNumber?: string | null;
  issuedAt?: string | null;
  coveredProceedingIds?: string[];
  authorityLimits?: string | null;
  validUntil?: string | null;
  note?: string | null;
}): DbRepresentation {
  const now = new Date().toISOString();
  const rep: DbRepresentation = {
    id: data.id,
    case_id: data.caseId,
    lawyer_profile_id: data.lawyerProfileId ?? null,
    lawyer_user_id: data.lawyerUserId ?? null,
    document_type: data.documentType,
    document_id: data.documentId ?? null,
    reference_number: data.referenceNumber ?? null,
    issued_at: data.issuedAt ?? null,
    covered_proceeding_ids: data.coveredProceedingIds ?? [],
    authority_limits: data.authorityLimits ?? null,
    valid_until: data.validUntil ?? null,
    terminated_at: null,
    note: data.note ?? null,
    created_at: now,
    updated_at: now,
  };
  const reps = readTable<DbRepresentation>("case_representations");
  reps.push(rep);
  writeTable("case_representations", reps);
  return rep;
}

export function updateCaseRepresentation(
  caseId: string,
  representationId: string,
  data: Record<string, unknown>
): DbRepresentation | undefined {
  const reps = readTable<DbRepresentation>("case_representations");
  const idx = reps.findIndex((r) => r.id === representationId && r.case_id === caseId);
  if (idx === -1) return undefined;
  reps[idx] = {
    ...reps[idx],
    ...(data as Partial<DbRepresentation>),
    updated_at: new Date().toISOString(),
  } as DbRepresentation;
  writeTable("case_representations", reps);
  return reps[idx];
}

// ---------------------------------------------------------------------------
// Case contract links (typed)
// ---------------------------------------------------------------------------

export function getCaseContractLinks(caseId: string): DbCaseContractLink[] {
  return readTable<DbCaseContractLink>("case_contract_links")
    .filter((l) => l.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function linkCaseContract(data: {
  id: string;
  caseId: string;
  contractId: string;
  kind: CaseContractKind;
  addedByUserId: string;
}): DbCaseContractLink {
  const links = readTable<DbCaseContractLink>("case_contract_links");
  const existing = links.find((l) => l.case_id === data.caseId && l.contract_id === data.contractId);
  if (existing) return existing;
  const link: DbCaseContractLink = {
    id: data.id,
    case_id: data.caseId,
    contract_id: data.contractId,
    kind: data.kind,
    added_by_user_id: data.addedByUserId,
    created_at: new Date().toISOString(),
  };
  links.push(link);
  writeTable("case_contract_links", links);
  return link;
}

export function unlinkCaseContract(caseId: string, contractId: string): boolean {
  const links = readTable<DbCaseContractLink>("case_contract_links");
  const next = links.filter((l) => !(l.case_id === caseId && l.contract_id === contractId));
  if (next.length === links.length) return false;
  writeTable("case_contract_links", next);
  return true;
}
