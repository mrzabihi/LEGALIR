// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]
// ============================================================
// GET  — the full context an operator needs to judge one contract:
//        the rendered clauses, the parties, completeness, the current
//        version + hash, the admin-review history and whether a
//        valid, bound approval currently exists.
// POST — the review DECISION. Staff-only (`admin:contracts:review`),
//        and the ONLY four actions an admin may take:
//
//          approve       تأیید برای صدور نهایی
//          reject        رد و بازگرداندن همراه با دلیل
//          request_info  درخواست اطلاعات یا اصلاح مشخص
//          cancel        لغو بررسی با علت
//
// Every action is bound to the review's exact version hash and writes
// an immutable event + the platform audit trail (actor, before → after,
// reason). A decision can never be recorded without the required reason,
// and can only be made against the ONE open (PENDING) review.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  AdminContractReviewActionRequest,
  ContractAdminReviewAction,
  ContractAdminReviewStatus,
  ContractParty,
  PropertyContractState,
} from "@legalir/types";
import {
  CONTRACT_ADMIN_REVIEW_STATUS_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
  SIGNATURE_PARTICIPANT_STATUS_FA,
  SIGNATURE_REQUEST_STATUS_FA,
} from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, mapDataError, readJson, requestMeta } from "@/lib/admin/http";
import {
  appendAdminReviewEvent,
  currentVersionApproval,
  latestAdminReview,
  listAdminReviewEvents,
  openAdminReview,
  updateAdminReview,
} from "@/lib/contracts/admin-review";
import {
  getContractById,
  getVersion,
  listApprovals,
  listContractDocuments,
  listParties,
  listPayments,
  listVersions,
  updateContractForUser,
} from "@/lib/contracts/db";
import { computeCompleteness } from "@/lib/contracts/completeness";
import { listReviewComments } from "@/lib/contracts/review-db";
import {
  latestSignatureRequestDetail,
  listAttestations,
  listInvitations,
  listSignatureRequests,
} from "@/lib/contracts/signature/db";
import { renderContract } from "@/lib/contracts/template";
import { legalBasisReportFor, legalReviewTypeSummary } from "@/lib/contracts/legal-review-db";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import {
  assertTransition,
  IllegalTransitionError,
  stateLabelFa,
} from "@/lib/contracts/state-machine";

interface Params {
  params: Promise<{ id: string }>;
}

/** The review status each action sets, and the contract state it drives. */
const ACTION_OUTCOME: Record<
  ContractAdminReviewAction,
  {
    reviewStatus: ContractAdminReviewStatus;
    contractState: PropertyContractState;
    needsReason: boolean;
  }
> = {
  approve: { reviewStatus: "APPROVED", contractState: "ADMIN_APPROVED", needsReason: false },
  reject: { reviewStatus: "REJECTED", contractState: "REJECTED", needsReason: true },
  request_info: {
    reviewStatus: "CHANGES_REQUESTED",
    contractState: "CHANGES_REQUESTED",
    needsReason: true,
  },
  cancel: { reviewStatus: "CANCELLED", contractState: "CANCELLED", needsReason: true },
};

/** Public-safe reviewer initials, e.g. «م.م» — never the full name. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LG";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join(".");
}

/** Short party summary, e.g. «مریم محمدی و رضا کریمی». */
function partySummaryFa(typeId: string, parties: ContractParty[]): string {
  const def = getContractDefinition(typeId as never);
  const names = def.roles
    .map((role) => parties.find((p) => p.role === role))
    .filter((p): p is ContractParty => !!p)
    .map((p) => `${p.identity.firstName} ${p.identity.lastName}`.trim())
    .filter((n) => n.length > 0);
  return names.length > 0 ? names.join(" و ") : "طرفین ثبت نشده‌اند";
}

// ------------------------------------------------------------
// GET — the review context
// ------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const parties = listParties(contract.id);
  const documents = listContractDocuments(contract.id);
  const payments = listPayments(contract.id);
  const completeness = computeCompleteness(contract, parties, documents);

  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, currentVersion?.documentHash ?? null);
  // Prefer the OPEN review for the decision panel; fall back to the
  // newest review of any status so a past decision stays visible.
  const review = openAdminReview(contract.id) ?? latestAdminReview(contract.id);

  // The rendered document the admin is asked to judge — the SAME renderer
  // the preview and the PDF use, so what is approved is what the owner sees.
  const rendered = renderContract(contract, parties, payments);
  const owner = findUserById(contract.userId);

  // §2.4 — the reviewer records the whole lifecycle, not just the rendered
  // text: what the owner asked to change, the note they confirmed, every
  // version that ever existed, the party approvals and the signature
  // request with each party's own status. All of it is read from the same
  // tables the owner-facing routes use, so the two can never disagree.
  const def = getContractDefinition(contract.type);
  const sectionTitleFa = (ref: string | undefined): string | null => {
    if (!ref) return null;
    return def.wizardSteps.find((s) => s.id === ref)?.titleFa ?? ref;
  };
  const versions = listVersions(contract.id);
  const approvals = listApprovals(contract.id);
  const signatureRequest = latestSignatureRequestDetail(contract.id);

  return NextResponse.json({
    data: {
      contract: {
        id: contract.id,
        referenceCode: contract.referenceCode,
        type: contract.type,
        typeFa: contract.typeFa,
        title: contract.title,
        state: contract.state,
        stateFa: stateLabelFa(contract.state),
        progress: contract.progress,
        ownerLabelFa: owner?.displayName?.trim() || "کاربر لیگالیر",
        partySummaryFa: partySummaryFa(contract.type, parties),
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        // §2.7 — the dev sample must be recognisable inside the drawer too.
        isSample: contract.isSample === true,
      },
      completeness,
      parties: parties.map((p) => ({
        id: p.id,
        role: p.role,
        roleFa: partyRoleLabelFa(p.role),
        nameFa: `${p.identity.firstName} ${p.identity.lastName}`.trim(),
        isInitiator: p.isInitiator,
      })),
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            documentHash: currentVersion.documentHash,
            createdAt: currentVersion.createdAt,
          }
        : null,
      // Every version ever frozen, newest first, each marked as the current
      // one and/or the FINAL one. Nothing is collapsed or overwritten: the
      // list is the record that proves no version was lost.
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        documentHash: v.documentHash,
        templateVersion: v.templateVersion,
        createdAt: v.createdAt,
        isCurrent: v.id === contract.currentVersionId,
        isFinal: v.id === contract.finalVersionId,
      })),
      // §2.2 — the note that prints at the end of the document, with the
      // exact moment the owner confirmed it. Kept out of the clauses, as
      // it is not a term of the contract.
      supplementary: {
        notes: contract.data.supplementary?.notes ?? "",
        noteConfirmedAt: contract.data.supplementary?.noteConfirmedAt ?? null,
        // §2.5 — files the owner registered as part of the agreement. The
        // operator must see them next to the note, never merged into it.
        attachments: contract.data.supplementary?.attachments ?? [],
        attachmentsConfirmedAt: contract.data.supplementary?.attachmentsConfirmedAt ?? null,
        confirmedAt: contract.data.supplementary?.confirmedAt ?? null,
      },
      // §2.1 — clauses the owner added, and the changes they asked for.
      // Two distinct kinds; a change request is never mistaken for an
      // agreed term.
      customClauses: (contract.data.customClauses ?? []).map((c) => ({
        id: c.id,
        kind: c.kind ?? "agreement",
        title: c.title,
        body: c.body,
        sectionRef: c.sectionRef ?? null,
        sectionTitleFa: sectionTitleFa(c.sectionRef),
        createdAt: c.createdAt,
      })),
      // Party approvals of the current version, with their exact times.
      approvals: approvals.map((a) => {
        const party = parties.find((p) => p.id === a.partyId);
        return {
          id: a.id,
          contractVersionId: a.contractVersionId,
          partyId: a.partyId,
          partyRoleFa: party ? partyRoleLabelFa(party.role) : "",
          partyNameFa: party
            ? `${party.identity.firstName} ${party.identity.lastName}`.trim()
            : "",
          status: a.status,
          comment: a.comment,
          method: a.method,
          approvedAt: a.approvedAt,
          createdAt: a.createdAt,
        };
      }),
      // The latest signature request (including a COMPLETED one — it is
      // the audit record, not a transient state), each party's own status
      // and the delivery outcome of every invitation.
      signatureRequest: signatureRequest
        ? {
            ...signatureRequest,
            statusFa: SIGNATURE_REQUEST_STATUS_FA[signatureRequest.status],
            participants: signatureRequest.participants.map((p) => ({
              ...p,
              statusFa: SIGNATURE_PARTICIPANT_STATUS_FA[p.status],
            })),
            invitations: listInvitations(signatureRequest.id).map((i) => ({
              id: i.id,
              participantId: i.participantId,
              recipientMasked: i.recipientMasked,
              status: i.status,
              deliveryChannel: i.deliveryChannel ?? null,
              deliveryStatus: i.deliveryStatus ?? null,
              lastSentAt: i.lastSentAt ?? null,
              expiresAt: i.expiresAt,
              usedAt: i.usedAt,
              revokedAt: i.revokedAt,
            })),
          }
        : null,
      // Admin attestations: evidence ABOUT a signature the party gave
      // (how it was verified), never a signature itself. Kept separate
      // from `signatureRequest` so the two origins — the party's own
      // confirmation via its link vs. an admin's verification — can
      // never be confused.
      attestations: listAttestations(contract.id),
      // Every request ever issued for this contract, so a superseded one
      // is still on record.
      signatureRequests: listSignatureRequests(contract.id).map((r) => ({
        id: r.id,
        contractVersionId: r.contractVersionId,
        status: r.status,
        statusFa: SIGNATURE_REQUEST_STATUS_FA[r.status],
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      rendered: {
        titleFa: rendered.titleFa,
        preambleFa: rendered.preambleFa,
        clauses: rendered.clauses,
        footerFa: rendered.footerFa,
      },
      // §2/§7 — the non-binding legal-basis annex, read from the merged
      // catalog so a reviewer's stored correction is what the operator
      // judges against. Uncited clauses are flagged, never omitted silently.
      legalBasis: legalBasisReportFor(contract, rendered),
      // §7 — the retained legal-review report for this contract TYPE: every
      // clause with its source, content version and review state, so the
      // operator can see which parts still need legal revision.
      legalReview: legalReviewTypeSummary(contract.type),
      // The review thread, in full. An operator holds `admin:contracts:read`
      // and must see `internal` notes too — those are exactly the notes a
      // party never receives, and the decision depends on them. Comments are
      // bound to a version, so the reviewer can tell which remarks still
      // apply to the content on screen.
      comments: listReviewComments(contract.id),
      adminReview: review
        ? {
            ...review,
            statusFa: CONTRACT_ADMIN_REVIEW_STATUS_FA[review.status],
            events: listAdminReviewEvents(review.id),
          }
        : null,
      approved: approval !== null,
      stamp: {
        applied: approval !== null,
        text: CONTRACT_REVIEW_STAMP_TEXT,
        disclaimerFa: CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
      },
    },
  });
}

// ------------------------------------------------------------
// POST — the decision
// ------------------------------------------------------------

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as AdminContractReviewActionRequest | null;
  if (!body || !body.action) return adminError(400, "ACTION_REQUIRED", "عملیات بررسی الزامی است");

  const outcome = ACTION_OUTCOME[body.action];
  if (!outcome) return mapDataError("UNKNOWN_ACTION");

  const reason = (body.reason ?? "").trim();
  if (outcome.needsReason && reason.length < 3) {
    return adminError(400, "REASON_REQUIRED", "ثبت دلیل برای این اقدام الزامی است");
  }

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  // Only the single OPEN review can be decided. Once it is terminal the
  // contract must be re-submitted, which creates a fresh review bound to
  // a fresh version hash — a decision can never be replayed onto a newer
  // version.
  const review = openAdminReview(contract.id);
  if (!review) return mapDataError("ALREADY_DECIDED");

  // The decision is bound to the version the review was opened against.
  // If the contract's current version has moved on, this review is stale
  // and must not authorise anything.
  if (review.contractVersionId && review.contractVersionId !== contract.currentVersionId) {
    return adminError(
      409,
      "STALE_REVIEW",
      "این نسخه از قرارداد تغییر کرده است؛ بررسی باید دوباره ارسال شود."
    );
  }

  try {
    assertTransition(contract.state, outcome.contractState);
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return adminError(409, "ILLEGAL_TRANSITION", err.message);
    }
    throw err;
  }

  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName?.trim() || "مدیر بررسی لیگالیر";
  const now = new Date().toISOString();

  const updatedReview = updateAdminReview(review.id, {
    status: outcome.reviewStatus,
    reviewerId: auth.ctx.userId,
    reviewerLabelFa: actorName,
    reviewerInitials: initialsFrom(actorName),
    reasonFa: reason || review.reasonFa,
    decidedAt: now,
  });
  if (!updatedReview) return mapDataError("NOT_FOUND");

  appendAdminReviewEvent({
    reviewId: review.id,
    action: body.action,
    actorId: auth.ctx.userId,
    actorLabel: actorName,
    reasonFa: reason,
    contractVersionId: review.contractVersionId,
    documentHash: review.documentHash,
  });

  const updated = updateContractForUser(contract.userId, contract.id, {
    state: outcome.contractState,
  });

  // The platform admin audit trail records the decision (actor, before →
  // after, reason). The owner-facing contract audit records the state
  // change so the contract's own timeline shows it too.
  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: `contract.admin_review.${body.action}`,
    resourceType: "property_contract",
    resourceId: contract.id,
    reason: reason || null,
    before: { state: contract.state, reviewStatus: "PENDING" },
    after: { state: outcome.contractState, reviewStatus: outcome.reviewStatus },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      contract: updated,
      review: {
        ...updatedReview,
        statusFa: CONTRACT_ADMIN_REVIEW_STATUS_FA[updatedReview.status],
        events: listAdminReviewEvents(review.id),
      },
      approved: outcome.reviewStatus === "APPROVED",
    },
  });
}
