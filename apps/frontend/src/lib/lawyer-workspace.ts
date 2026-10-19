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
import {
  getCaseById,
  getCaseDeadlines,
  getCaseRepresentations,
  getCaseTasks,
  listReferredCases,
} from "./case-db";
import { getContractById } from "./contracts/db";
import { listLiveLawyerReviewsForLawyer } from "./contracts/review-db";
import { caseMemberAccountIds } from "./cases/access";
import {
  ACTIVE_LEGAL_REQUEST_STATES,
  LAWYER_REVIEW_STATE_FA,
  LEGAL_REQUEST_STATE_FA,
  type LawyerCaseItem,
  type LawyerInboxItem,
  type LawyerReferralItem,
  type LawyerReferralSurface,
  type LawyerWorkspace,
  type LegalRequest,
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
 * Every referral assigned to this lawyer, unified across the four product
 * surfaces. One row per referral, tagged with all the surfaces it belongs
 * to, so a case referral that also carries a power of attorney is listed
 * once and never twice.
 *
 * Visibility is scoped to what was actually referred:
 *   • contract      ← contract-lawyer-reviews.lawyerId === profile id
 *   • consultation  ← legal_requests.selectedLawyerId === profile id
 *   • case          ← an accepted case_members row for this account
 *   • representation← a case_representations row naming this lawyer
 * Non-referred items never appear, and nothing here is fabricated: a lawyer
 * with no referrals gets an empty list.
 */
export function buildReferrals(
  userId: string,
  lawyerProfileId: string | null,
  requests: LegalRequest[]
): LawyerReferralItem[] {
  // De-duplicate by the referral identity — a single referral must render
  // exactly once even when several sources describe it.
  const byId = new Map<string, LawyerReferralItem>();

  const add = (item: LawyerReferralItem, surface: LawyerReferralSurface) => {
    const existing = byId.get(item.id);
    if (existing) {
      if (!existing.surfaces.includes(surface)) existing.surfaces.push(surface);
      // Keep the freshest timestamp — the row is the same referral.
      if (item.updatedAt > existing.updatedAt) existing.updatedAt = item.updatedAt;
      return;
    }
    byId.set(item.id, { ...item, surfaces: [surface] });
  };

  // --- قراردادها: contract reviews assigned to this lawyer ---------------
  if (lawyerProfileId) {
    // Keyed by CONTRACT, not by review: resubmitting the same contract to
    // the same lawyer opens a second review row, and that is one referral
    // to the lawyer, not two. Newest-first order means the first row seen
    // for a contract is the one that describes it.
    for (const review of listLiveLawyerReviewsForLawyer(lawyerProfileId)) {
      const contract = getContractById(review.contractId);
      const titleFa = contract?.title ?? "قرارداد";
      add(
        {
          id: `contract:${review.contractId}`,
          kind: "contract",
          refId: review.contractId,
          surfaces: [],
          titleFa,
          clientNameFa: contract ? clientDisplayName(contract.userId) : null,
          state: review.state,
          stateFa: LAWYER_REVIEW_STATE_FA[review.state] ?? review.state,
          caseId: null,
          href: `/contracts/${review.contractId}`,
          updatedAt: review.updatedAt,
        },
        "contract"
      );
    }
  }

  // --- مشاوره‌ها: consultations routed to this lawyer ---------------------
  for (const request of requests) {
    add(
      {
        id: `consultation:${request.id}`,
        kind: "consultation",
        refId: request.id,
        surfaces: [],
        titleFa: request.title,
        clientNameFa: clientDisplayName(request.userId),
        state: request.state,
        stateFa: LEGAL_REQUEST_STATE_FA[request.state] ?? request.state,
        caseId: request.caseId,
        href: `/consultations/${request.id}`,
        updatedAt: request.updatedAt,
      },
      "consultation"
    );
  }

  // --- پرونده‌ها / وکالت: cases shared by an accepted engagement ----------
  const accountIds = caseMemberAccountIds(userId);
  for (const row of listReferredCases(accountIds)) {
    const hasPowerOfAttorney = getCaseRepresentations(row.id).some(
      (rep) =>
        (lawyerProfileId !== null && rep.lawyer_profile_id === lawyerProfileId) ||
        rep.lawyer_user_id === userId
    );
    const item: LawyerReferralItem = {
      id: `case:${row.id}`,
      kind: "case",
      refId: row.id,
      surfaces: [],
      titleFa: row.title,
      clientNameFa: clientDisplayName(row.user_id),
      state: row.status,
      stateFa: row.status,
      caseId: row.id,
      href: `/cases/${row.id}`,
      updatedAt: row.updated_at,
    };
    add(item, "case");
    if (hasPowerOfAttorney) add(item, "representation");
  }

  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

  // Cases are reached either through a request that produced them, or —
  // for a case referral — through the accepted engagement membership row.
  // Both sources are merged and de-duplicated by case id.
  const caseIds = [
    ...new Set([
      ...requests.map((r) => r.caseId).filter((id): id is string => Boolean(id)),
      ...listReferredCases(caseMemberAccountIds(userId)).map((c) => c.id),
    ]),
  ];
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
    referrals: buildReferrals(userId, lawyerId, requests),
  };
}
