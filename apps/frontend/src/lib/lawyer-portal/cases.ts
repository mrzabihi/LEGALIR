// ============================================================
// LEGALIR — Lawyer portal · caseload projection (server-only)
// ============================================================
// The lawyer's own caseload: the cases they were referred (an accepted
// `case_members` row) plus any they happen to own. Every field is read from
// the case store — nothing is counted twice and nothing is invented.
//
//   · `nextDeadlineAt` is the earliest OPEN deadline, `overdueAt` the earliest
//     one already in the past. A case with no deadline reports `null`, which
//     the list renders as «بدون اقدام زمان‌دار» rather than a fake date.
//   · `openTasks` / `blockedTasks` come from the task rows, and only tasks in
//     a non-terminal state count.
//   · The relation is the lawyer's OWN membership role, so the list can say
//     «ارجاع‌شده به شما» vs «همکاری محدود» instead of implying full access.
//
// Authorization lives in the route: it resolves the session's lawyer profile
// and passes the user id here. A case the lawyer has no active membership on
// never enters the result.
// ============================================================

import {
  getCaseById,
  getCaseDeadlines,
  getCaseDocuments,
  getCaseMembers,
  getCaseProceedings,
  getCaseTasks,
  listCases,
} from "../case-db";
import { caseMemberAccountIds } from "../cases/access";
import { listAcceptedReferralCaseIds } from "../legal-request-db";
import { getProfile } from "../db";
import { getLawyerProfileByUserId } from "../lawyer-db";
import {
  CASE_CATEGORY_FA,
  CASE_LIFECYCLE_FA,
  CASE_STAGE_FA,
  type CaseCategory,
  type CaseLifecycleStatus,
  type CaseStageKey,
  type LawyerCaseFilters,
  type LawyerCaseListItem,
  type LawyerCaseListResponse,
  type LawyerCaseRelation,
} from "@legalir/types";

/** Tasks in these states are finished; they never count as open work. */
const TERMINAL_TASK_STATES = new Set(["done", "cancelled"]);

function relationFor(memberRole: string | undefined, isOwner: boolean): LawyerCaseRelation {
  if (isOwner) return "owner";
  if (memberRole === "limited") return "limited";
  if (memberRole === "viewer") return "viewer";
  return "assigned";
}

function categoryLabel(category: string): string {
  return CASE_CATEGORY_FA[category as CaseCategory] ?? category;
}

function lifecycleLabel(lifecycle: string): string {
  return CASE_LIFECYCLE_FA[lifecycle as CaseLifecycleStatus] ?? lifecycle;
}

function stageLabel(stage: string | null): string | null {
  if (!stage || stage === "unknown") return null;
  return CASE_STAGE_FA[stage as CaseStageKey] ?? null;
}

/** The client's display name, falling back to a neutral label. */
function clientName(userId: string): string {
  const profile = getProfile(userId);
  return profile?.displayName?.trim() || "موکل";
}

function project(
  caseId: string,
  ownerUserId: string,
  accountIds: readonly string[],
  /** Cases this account was granted by an accepted referral (legacy grants). */
  acceptedCaseIds: ReadonlySet<string>
) {
  const row = getCaseById(caseId);
  if (!row) return null;

  const member = getCaseMembers(caseId).find(
    (m) => m.status === "active" && accountIds.includes(m.account_id)
  );
  const isOwner = row.user_id === ownerUserId;
  // An accepted referral that predates the explicit membership insert is
  // still evidence of access — the same rule `resolveCaseAccess` applies, so
  // the list and the detail page can never disagree about who may open what.
  const grantedByReferral = acceptedCaseIds.has(caseId);

  if (!member && !isOwner && !grantedByReferral) return null;

  const now = Date.now();
  const deadlines = getCaseDeadlines(caseId).filter((d) => !d.completed);
  const sortedDue = deadlines
    .map((d) => d.due_at)
    .filter((d): d is string => Boolean(d))
    .sort();
  const nextDeadlineAt = sortedDue[0] ?? null;
  const overdueAt = sortedDue.find((d) => Date.parse(d) < now) ?? null;

  const tasks = getCaseTasks(caseId);
  const openTasks = tasks.filter((t) => !TERMINAL_TASK_STATES.has(t.status)).length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;

  // The stage lives on the proceeding, not the case row. The first proceeding
  // is the primary matter; extra proceedings hang off it as sub-matters.
  const stage = getCaseProceedings(caseId)[0]?.stage ?? null;

  const item: LawyerCaseListItem = {
    caseId: row.id,
    title: row.title,
    category: row.category,
    categoryLabelFa: categoryLabel(row.category),
    lifecycle: row.lifecycle ?? "ACTIVE",
    lifecycleLabelFa: lifecycleLabel(row.lifecycle ?? "ACTIVE"),
    stage,
    stageLabelFa: stageLabel(stage),
    // A membership row wins; a legacy accepted referral reads as «assigned».
    relation: relationFor(member?.role ?? (grantedByReferral ? "lawyer" : undefined), isOwner),
    clientNameFa: clientName(row.user_id),
    priority: row.priority,
    nextDeadlineAt,
    openTasks,
    blockedTasks,
    documentCount: getCaseDocuments(caseId).length,
    overdueAt,
    updatedAt: row.updated_at,
    href: `/lawyer/cases/${row.id}`,
  };
  return item;
}

/**
 * Every case this lawyer may open, filtered and paginated. `summary` is
 * computed over the WHOLE caseload so a filtered list still shows the true
 * shape of the workload.
 */
export function listLawyerCases(
  userId: string,
  filters: LawyerCaseFilters = {}
): LawyerCaseListResponse {
  const profile = getLawyerProfileByUserId(userId);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 20));
  if (!profile) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      summary: { total: 0, active: 0, onHold: 0, closed: 0, overdue: 0, withOpenTasks: 0 },
    };
  }

  const accountIds = caseMemberAccountIds(userId);
  const acceptedCaseIds = new Set(listAcceptedReferralCaseIds(accountIds));
  // `listCases` returns BOTH owned rows and shared rows; the projection then
  // drops anything without an active membership for this account.
  const all = listCases(userId, { includeAssigned: accountIds, page: 1, pageSize: 5_000 }).items;

  const projected: LawyerCaseListItem[] = [];
  for (const c of all) {
    const item = project(c.id, userId, accountIds, acceptedCaseIds);
    if (item) projected.push(item);
  }

  const now = Date.now();
  const isOpen = (c: LawyerCaseListItem) => c.lifecycle !== "CLOSED" && c.lifecycle !== "ARCHIVED";
  const summary = {
    total: projected.length,
    active: projected.filter((c) => c.lifecycle === "ACTIVE").length,
    onHold: projected.filter((c) => c.lifecycle === "ON_HOLD").length,
    closed: projected.filter((c) => !isOpen(c)).length,
    overdue: projected.filter((c) => c.overdueAt !== null && isOpen(c)).length,
    withOpenTasks: projected.filter((c) => c.openTasks > 0).length,
  };

  let rows = projected;

  if (filters.lifecycle) rows = rows.filter((c) => c.lifecycle === filters.lifecycle);
  if (filters.overdueOnly) {
    rows = rows.filter((c) => c.overdueAt !== null && Date.parse(c.overdueAt!) < now);
  }
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (c) =>
        c.title.toLowerCase().includes(search) ||
        c.clientNameFa.toLowerCase().includes(search) ||
        c.categoryLabelFa.includes(search)
    );
  }

  const sort = filters.sort ?? "deadline";
  rows = [...rows].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "fa");
    if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
    // Default: overdue first, then nearest deadline, then most recently moved.
    const aDue = a.overdueAt ? 0 : a.nextDeadlineAt ? Date.parse(a.nextDeadlineAt) : Infinity;
    const bDue = b.overdueAt ? 0 : b.nextDeadlineAt ? Date.parse(b.nextDeadlineAt) : Infinity;
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const page = Math.max(1, filters.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
    summary,
  };
}
