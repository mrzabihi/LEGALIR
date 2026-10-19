// ============================================================
// LEGALIR — Judicial admin review & order projections (server-only)
// ============================================================
// The operator surfaces read through this module so the admin panel never
// reaches into the owner tables directly:
//
//   • the queue is a list projection — ONE row per review/order with the
//     labels and counters a triage table needs, never a full draft body;
//   • the detail projection is the operator workspace: everything the
//     reviewer needs (submitted text, answers, drafts, attachments, the
//     COMPLETE timeline including internal notes) plus the owner identity;
//   • owner data is scoped by the review id, and no function here accepts a
//     caller-supplied user id — an operator can only see what a review
//     actually points at.
//
// Nothing here decides legality; it only reports. Every mutation goes
// through `review-db` (`applyAdminReviewAction`, `updateOrderByAdmin`).
// ============================================================

import { findUserById } from "@/lib/db";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import { listStaff } from "@/lib/admin/staff";
import {
  JUDICIAL_ATTACHMENT_ROLE_FA,
  JUDICIAL_DOCUMENT_TYPE_FA,
  JUDICIAL_ORDER_STATUS_FA,
  JUDICIAL_REQUEST_STATUS_FA,
  JUDICIAL_REVIEW_KIND_FA,
  JUDICIAL_REVIEW_STATUS_FA,
  roleHasPermission,
  type JudicialAdminAnswerRow,
  type JudicialAdminOwnerBadge as OwnerBadge,
  type JudicialOrder,
  type JudicialOrderQueueFilters,
  type JudicialOrderQueuePage,
  type JudicialOrderQueueRow,
  type JudicialOrderStatus,
  type JudicialReview,
  type JudicialReviewQueueFilters,
  type JudicialReviewQueuePage,
  type JudicialReviewQueueRow,
  type JudicialReviewStatus,
  type JudicialReviewDetailView,
} from "@legalir/types";

// The projections live in `@legalir/types` so the admin panel decodes the
// exact shape this module builds — one definition, no client-side copy.
export type {
  JudicialAdminAnswerRow,
  JudicialAdminOwnerBadge,
  JudicialOrderQueueFilters,
  JudicialOrderQueuePage,
  JudicialOrderQueueRow,
  JudicialReviewQueueFilters,
  JudicialReviewQueuePage,
  JudicialReviewQueueRow,
  JudicialReviewDetailView,
} from "@legalir/types";
import {
  getOwnedRequest,
  listAnswers,
  listAttachments,
  listDrafts,
} from "./db";
import {
  adminReviewEvents,
  getFinalDocumentForRequest,
  getReviewById,
  listAllOrders,
  listAllReviews,
  reviewEventCount,
} from "./review-db";
import { getQuestionnaireVersion, visibleQuestions } from "./questionnaires";
import { optionLabel } from "./schemas";
import { serviceTitleFa } from "./pdf";

function ownerBadge(userId: string): OwnerBadge {
  const user = findUserById(userId);
  if (!user) return { labelFa: "کاربر ناشناس", mobile: null, email: null };
  return {
    labelFa: user.displayName?.trim() || maskMobileMiddle(user.mobile),
    mobile: user.mobile ?? null,
    email: user.email ?? null,
  };
}

// ============================================================
// Review queue
// ============================================================

const TERMINAL: readonly JudicialReviewStatus[] = [
  "approved",
  "rejected",
  "cancelled",
] as const;

function matchesQuery(row: JudicialReviewQueueRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    row.titleFa,
    row.owner.labelFa,
    row.owner.mobile ?? "",
    row.id,
    row.requestId,
    row.serviceFa,
    row.documentTypeFa ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function reviewQueueRow(review: JudicialReview): JudicialReviewQueueRow {
  const request = getOwnedRequest(review.userId, review.requestId);
  const finalDoc = getFinalDocumentForRequest(review.requestId);
  const documentType = review.documentType ?? request?.documentType ?? null;
  return {
    id: review.id,
    requestId: review.requestId,
    kind: review.kind,
    kindFa: JUDICIAL_REVIEW_KIND_FA[review.kind] ?? review.kind,
    status: review.status,
    statusFa: JUDICIAL_REVIEW_STATUS_FA[review.status] ?? review.status,
    serviceId: review.serviceId,
    serviceFa: serviceTitleFa(review.serviceId),
    documentType,
    documentTypeFa: documentType ? JUDICIAL_DOCUMENT_TYPE_FA[documentType] : null,
    titleFa: request?.titleFa?.trim() || "بدون عنوان",
    owner: ownerBadge(review.userId),
    requestStatusFa: request
      ? JUDICIAL_REQUEST_STATUS_FA[request.status] ?? request.status
      : "—",
    submittedVersionNumber: review.submittedVersionNumber,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    decidedAt: review.decidedAt,
    assignedToLabelFa: review.assignedToLabelFa,
    open: !TERMINAL.includes(review.status),
    eventCount: reviewEventCount(review.id),
    hasFinalDocument: finalDoc !== null,
  };
}

/** The triage list. Counts are computed BEFORE filtering so tabs stay stable. */
export function listReviewQueue(
  filters: JudicialReviewQueueFilters = {}
): JudicialReviewQueuePage {
  const all = listAllReviews();
  const rows = all.map(reviewQueueRow);

  const byStatus: Record<JudicialReviewStatus, number> = {
    pending: 0,
    in_progress: 0,
    waiting_user: 0,
    changes_requested: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };
  for (const row of rows) byStatus[row.status] += 1;
  const open = rows.filter((r) => r.open).length;

  const status = filters.status ?? "open";
  let items = rows;
  if (status === "open") items = items.filter((r) => r.open);
  else if (status === "closed") items = items.filter((r) => !r.open);
  else if (status !== "all") items = items.filter((r) => r.status === status);

  const kind = filters.kind ?? "all";
  if (kind !== "all") items = items.filter((r) => r.kind === kind);

  if (filters.assigned) {
    items = items.filter((r) => r.assignedToLabelFa === filters.assigned);
  }
  if (filters.q) items = items.filter((r) => matchesQuery(r, filters.q!));

  return {
    items,
    total: items.length,
    counts: {
      all: rows.length,
      open,
      closed: rows.length - open,
      byStatus,
    },
  };
}

// ============================================================
// Review detail (operator workspace)
// ============================================================

export function getReviewDetail(reviewId: string): JudicialReviewDetailView | null {
  const review = getReviewById(reviewId);
  if (!review) return null;

  const request = getOwnedRequest(review.userId, review.requestId);
  const events = adminReviewEvents(review.id);

  let answers: JudicialAdminAnswerRow[] = [];
  if (request?.documentType && request.questionnaireVersion > 0) {
    const questionnaire = getQuestionnaireVersion(
      request.documentType,
      request.questionnaireVersion
    );
    if (questionnaire) {
      const raw: Record<string, string> = {};
      for (const response of listAnswers(review.userId, review.requestId)) {
        raw[response.questionId] = response.value;
      }
      answers = visibleQuestions(questionnaire, raw)
        .map(({ step, question }) => ({
          questionId: question.id,
          labelFa: question.labelFa,
          valueFa: optionLabel(questionnaire, question.id, raw[question.id] ?? ""),
          stepTitleFa: step.titleFa,
          sensitive: question.sensitive === true,
        }))
        .filter((row) => row.valueFa.trim() !== "");
    }
  }

  const documentType = review.documentType ?? request?.documentType ?? null;

  return {
    review,
    owner: ownerBadge(review.userId),
    serviceFa: serviceTitleFa(review.serviceId),
    documentTypeFa: documentType ? JUDICIAL_DOCUMENT_TYPE_FA[documentType] : null,
    request: request
      ? {
          id: request.id,
          titleFa: request.titleFa,
          statusFa: JUDICIAL_REQUEST_STATUS_FA[request.status] ?? request.status,
          currentStep: request.currentStep,
          updatedAt: request.updatedAt,
          narrative: request.narrative,
        }
      : null,
    answers,
    drafts: listDrafts(review.userId, review.requestId),
    attachments: listAttachments(review.userId, review.requestId).map((a) => ({
      id: a.id,
      nameFa: a.name,
      roleFa: JUDICIAL_ATTACHMENT_ROLE_FA[a.role] ?? a.role,
      mime: a.mime ?? null,
      sizeBytes: a.sizeBytes ?? null,
    })),
    events,
    internalEvents: events.filter((e) => !e.visibleToOwner),
    finalDocument: getFinalDocumentForRequest(review.requestId),
    assignableStaff: assignableOperators(),
  };
}

/**
 * Every staff member whose ROLE holds `admin:judicial:read`. Assignment is a
 * promise that a colleague can open the review, so a role without the queue
 * permission is never offered — the server would refuse their access too.
 */
function assignableOperators(): {
  userId: string;
  labelFa: string;
  roleFa: string;
}[] {
  return listStaff()
    .filter((s) => roleHasPermission(s.role, "admin:judicial:read"))
    .map((s) => ({
      userId: s.id,
      labelFa: s.displayName?.trim() || s.mobileMasked,
      roleFa: s.roleFa,
    }));
}

// ============================================================
// Order queue (the two provider services)
// ============================================================

const ORDER_OPEN: readonly JudicialOrderStatus[] = [
  "draft",
  "submitted",
  "in_progress",
  "waiting_user",
  "ready",
] as const;

export function orderQueueRow(order: JudicialOrder): JudicialOrderQueueRow {
  return {
    id: order.id,
    serviceId: order.serviceId,
    serviceFa: serviceTitleFa(order.serviceId),
    status: order.status,
    statusFa: JUDICIAL_ORDER_STATUS_FA[order.status] ?? order.status,
    titleFa: order.titleFa,
    owner: ownerBadge(order.userId),
    answers: order.answers,
    noteFa: order.noteFa,
    purposeFa: order.purposeFa,
    attachmentIds: order.attachmentIds,
    assignedToLabelFa: order.assignedToLabelFa,
    operatorNoteFa: order.operatorNoteFa,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    submittedAt: order.submittedAt,
    deliveredAt: order.deliveredAt,
    deliveryNameFa: order.deliveryNameFa,
  };
}

export function listOrderQueue(
  filters: JudicialOrderQueueFilters = {}
): JudicialOrderQueuePage {
  const rows = listAllOrders().map(orderQueueRow);
  const open = rows.filter((r) => ORDER_OPEN.includes(r.status)).length;

  let items = rows;
  const status = filters.status ?? "open";
  if (status === "open") items = items.filter((r) => ORDER_OPEN.includes(r.status));
  else if (status !== "all") items = items.filter((r) => r.status === status);
  if (filters.serviceId) items = items.filter((r) => r.serviceId === filters.serviceId);
  if (filters.q) {
    const needle = filters.q.trim().toLowerCase();
    items = items.filter((r) =>
      [r.titleFa, r.owner.labelFa, r.owner.mobile ?? "", r.id, r.serviceFa]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }

  return { items, total: items.length, counts: { all: rows.length, open } };
}
