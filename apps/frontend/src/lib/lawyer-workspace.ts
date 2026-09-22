// ============================================================
// LEGALIR — Lawyer Workspace (server-only)
// ============================================================
// The lawyer's own view of the platform, assembled from real events:
//
//   inbox  ← legal_requests where selectedLawyerId === this lawyer
//   cases  ← the cases those requests produced (request.caseId)
//   stats  ← derived counts + computePerformance()
//
// Nothing here is fabricated. A lawyer with no assigned requests sees
// zeros. Client names come from the client's profile display name, never
// the raw user id.
// ============================================================

import { getProfile } from "./db";
import { getLawyerProfileByUserId, computePerformance } from "./lawyer-db";
import { listRequestsForLawyer } from "./legal-request-db";
import { getCaseById, getCaseDeadlines, getCaseTasks } from "./case-db";
import {
  ACTIVE_LEGAL_REQUEST_STATES,
  type LawyerCaseItem,
  type LawyerInboxItem,
  type LawyerWorkspace,
  type LegalRequestState,
} from "@legalir/types";

/** States in which the lawyer is the party who must act next. */
const AWAITING_LAWYER_STATES: ReadonlySet<LegalRequestState> = new Set([
  "LAWYER_SELECTED",
  "WAITING_FOR_ACCEPTANCE",
  "WAITING_FOR_LAWYER",
]);

const ACTIVE_STATES: ReadonlySet<LegalRequestState> = new Set(ACTIVE_LEGAL_REQUEST_STATES);

/** How many days ahead a deadline still counts as "upcoming". */
export const UPCOMING_DEADLINE_DAYS = 7;

/** Whole days from `from` to `to`, ignoring the time of day. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** The client's display name, falling back to a neutral label. */
function clientDisplayName(userId: string): string {
  const name = getProfile(userId).displayName?.trim();
  return name && name.length > 0 ? name : "موکل";
}

/**
 * Build the lawyer workspace for the user behind `userId`. Returns a
 * workspace with a null profile when the user has no lawyer profile —
 * the caller decides whether that is an error (403) or an onboarding state.
 */
export function buildLawyerWorkspace(userId: string, now: Date = new Date()): LawyerWorkspace {
  const profile = getLawyerProfileByUserId(userId) ?? null;
  const lawyerId = profile?.id ?? null;

  const requests = lawyerId ? listRequestsForLawyer(lawyerId) : [];

  const inbox: LawyerInboxItem[] = requests
    .filter((r) => ACTIVE_STATES.has(r.state))
    .map((r) => ({
      requestId: r.id,
      title: r.title,
      category: r.category,
      state: r.state,
      clientName: clientDisplayName(r.userId),
      awaitingLawyer: AWAITING_LAWYER_STATES.has(r.state),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Cases are reached through the request that produced them — a lawyer
  // only ever sees cases their own accepted requests created.
  const caseIds = requests.map((r) => r.caseId).filter((id): id is string => Boolean(id));
  const cases: LawyerCaseItem[] = [];
  let upcomingDeadlines = 0;

  for (const caseId of caseIds) {
    const row = getCaseById(caseId);
    if (!row) continue;

    const openDeadlines = getCaseDeadlines(caseId).filter((d) => !d.completed);
    const nextDeadline = openDeadlines[0] ?? null;
    for (const d of openDeadlines) {
      const days = daysBetween(now, new Date(d.due_at));
      if (days >= 0 && days <= UPCOMING_DEADLINE_DAYS) upcomingDeadlines += 1;
    }

    cases.push({
      caseId: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      priority: row.priority,
      nextDeadlineAt: nextDeadline?.due_at ?? null,
      openTasks: getCaseTasks(caseId).filter((t) => t.status !== "done").length,
      updatedAt: row.updated_at,
    });
  }
  cases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    profile,
    stats: {
      activeRequests: inbox.length,
      awaitingResponse: inbox.filter((i) => i.awaitingLawyer).length,
      activeCases: cases.filter((c) => c.status === "ACTIVE").length,
      upcomingDeadlines,
      performance: lawyerId
        ? computePerformance(lawyerId)
        : {
            acceptedRequests: 0,
            completedCases: 0,
            medianResponseMinutes: null,
            averageRating: null,
            reviewCount: 0,
          },
    },
    inbox,
    cases,
  };
}
