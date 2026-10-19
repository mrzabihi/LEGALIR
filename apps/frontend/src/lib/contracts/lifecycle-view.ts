// ============================================================
// LEGALIR — Lifecycle aggregate assembly
// ============================================================
// One function that turns a contract row plus its completeness into
// the `ContractLifecycleView` the workspace renders. It is the single
// place the "can I do X right now?" questions are answered, so the UI
// never re-derives them and can never disagree with the server.
//
// The view is DERIVED, never stored: every field is read from the real
// state of the contract, its version, its signature request and its
// reviews.
// ============================================================

import type {
  ContractCompleteness,
  ContractLifecycleView,
  ContractPrintMirror,
  PropertyContract,
} from "@legalir/types";
import { latestSignatureRequest, latestSignatureRequestDetail, listInvitations } from "./signature/db";
import { activeLawyerReviewDetail, latestAiReview, listReviewComments } from "./review-db";
import { currentVersionApproval, latestAdminReview } from "./admin-review";
import { currentVersionStamp } from "./stamp-review";
import { preSignTipsForType } from "./legal-review-db";
import { getVersion, listContractDocuments } from "./db";
import { registrationForHash, resolveSigningAuthorisation } from "./registration";
import {
  contractPrintIssues,
  getAdminMessage,
  isPrintableAttachmentMime,
  planContractAnnexes,
  planSignatureImages,
} from "./admin-print";
import { loadHologram, loadReviewStamp } from "./stamp-asset";

/**
 * The owner-scoped URL of a stored document. Inlined rather than imported
 * from the API client module: this file runs on the server, and a URL is
 * the only thing both layers share.
 */
function contractDocumentUrl(contractId: string, documentId: string): string {
  return `/api/v1/property-contracts/${contractId}/documents/${documentId}`;
}
import {
  buildLifecycleSteps,
  deriveLifecycleStage,
  deriveRegistrationStatus,
  isAtSignatureStage,
  registrationStatusFa,
} from "./lifecycle";
import { canTransition, isEditable, isSignable } from "./state-machine";
import { evaluateRegistrationPolicy } from "./registration-policy";

/**
 * Assemble the lifecycle view for a contract.
 *
 * `completeness` is optional so a caller that only has the row (e.g. a
 * list projection) still gets a coherent view; without it the INFO
 * stage is never promoted to PREVIEW.
 */
export function buildLifecycleView(
  contract: PropertyContract,
  completeness?: ContractCompleteness
): ContractLifecycleView {
  const stage = deriveLifecycleStage(contract.state, completeness);
  // The LATEST request, not only an in-flight one: after the last
  // signature the request is COMPLETED, and the participant list plus
  // the event trail must stay visible as the record of what happened.
  const signatureRequest = latestSignatureRequestDetail(contract.id);
  // Invitations belong to the request, not to the contract: an invitation
  // for an older request must never surface under a newer one.
  const latestRequest = latestSignatureRequest(contract.id);
  const invitations = latestRequest ? listInvitations(latestRequest.id) : [];
  const lawyerReview = activeLawyerReviewDetail(contract.id);
  const aiReview = latestAiReview(contract.id);
  const comments = listReviewComments(contract.id);

  const policy = evaluateRegistrationPolicy(contract.type);
  const registrationStatus = deriveRegistrationStatus(
    contract.state,
    policy.policy.officialRegistrationRequired
  );

  // The admin-review axis. `adminReview` is the newest review of any
  // status (so a decision stays visible); `adminApproved` is true only
  // when the CURRENT version still carries a valid, bound approval.
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const adminReview = latestAdminReview(contract.id);
  const approved = currentVersionApproval(contract, currentVersion?.documentHash ?? null);

  // The official seal is the SECOND, stronger gate: a Super-Admin stamp
  // request applied to the current version hash whose stamp master is still
  // byte-identical. A content change or a swapped asset voids it here too.
  const seal = currentVersionStamp(contract, currentVersion?.documentHash ?? null);

  // A contract may be submitted to the admin queue once its content is
  // frozen as a version and it is not already in flight, in the queue,
  // or freshly approved. The legal-transition table is the SAME source
  // the submit route asserts against, so the UI can never offer a call
  // the server would reject — and can never hide one it would allow.
  const canSubmitForAdminReview =
    !!contract.currentVersionId &&
    !approved &&
    !signatureRequest &&
    canTransition(contract.state, "PENDING_ADMIN_REVIEW");

  // The registration path chosen for this exact version hash. A
  // `self_final` record is an authorisation that NEVER claims a review
  // happened — every surface must branch on `kind`.
  const currentHash = currentVersion?.documentHash ?? null;
  const registration = registrationForHash(contract.id, currentHash);
  const authorisation = resolveSigningAuthorisation({
    contract,
    documentHash: currentHash,
    approval: approved,
  });
  const reviewedByLegalir = approved !== null;

  // The compulsory gate: a signature may only be PREPARED once the
  // current version carries an authorisation — either a bound admin
  // approval (reviewed path) or a hash-bound self-final registration
  // (unreviewed path). This is the UI's read of the same invariant the
  // sign route enforces server-side.
  const canPrepareForSignature =
    !signatureRequest &&
    !!authorisation &&
    (contract.state === "ADMIN_APPROVED" ||
      contract.state === "READY_FOR_REVIEW" ||
      contract.state === "COUNTERPARTY_REVIEW" ||
      contract.state === "READY_TO_SIGN") &&
    !isEditable(contract.state);

  // «ثبت نهایی» — the unreviewed route into party signing. Offered only
  // when no registration exists for this hash and the legal-transition
  // table actually allows READY_TO_SIGN from here (it does not from
  // PENDING_ADMIN_REVIEW, so a contract already in the review queue can
  // never be silently pulled out of it).
  const canSelfFinalize =
    !!contract.currentVersionId &&
    !approved &&
    !registration &&
    !signatureRequest &&
    canTransition(contract.state, "READY_TO_SIGN");


  // A signature may be given only while the contract is signable and a
  // request is in flight. A BLOCKING lawyer review that is not complete
  // holds the signature back.
  const lawyerBlocks = !!lawyerReview && lawyerReview.blocksSigning;
  const canSign = isSignable(contract.state) && !!signatureRequest && !lawyerBlocks;

  // Finalization is the last step: every party has signed the current
  // version, the contract has reached SIGNED, AND the signed version
  // carries an authorisation — a bound approval OR a hash-bound
  // self-final registration. The finalize route enforces the same
  // conditions, so the UI never offers a call the server would reject.
  const canFinalize = contract.state === "SIGNED" && authorisation !== null;

  // The print plan is DERIVED from the real files on disk. Anything the
  // PDF cannot reproduce faithfully is reported BEFORE finalisation so a
  // contract never silently ships without one of its annexes/signatures.
  const documents = listContractDocuments(contract.id);
  const participants = signatureRequest?.participants ?? [];
  const printIssues = contractPrintIssues({ contract, documents, participants });
  const adminMessage = getAdminMessage(contract.id);

  // §T7 — the on-screen sheet mirrors the STORED PDF. The plan below is
  // the same one `buildContractPdfInputs` feeds the renderer, resolved
  // from the same files, so the preview can never show a different set
  // or order of signatures/annexes than the printed copy. A file that
  // cannot be embedded stays listed with `unprintable: true` — the
  // preview names it instead of silently dropping it, and `printIssues`
  // blocks finalisation until it is fixed.
  const annexPlan = planContractAnnexes({ contract, documents });
  const signaturePlan = planSignatureImages({ participants, documents });
  const signatureByRole = new Map(
    signaturePlan.images.map((i) => [i.participant.roleFa, i])
  );
  const sealAsset = loadReviewStamp();
  const hologram = loadHologram();
  const stampBinding = seal
    ? { sha256: seal.stampAssetSha256 ?? sealAsset?.sha256 ?? null, applied: true }
    : registration?.path === "self_final" && sealAsset
      ? { sha256: sealAsset.sha256, applied: true }
      : null;
  const printMirror: ContractPrintMirror = {
    signatures: participants
      .filter((p) => p.proofDocumentId !== null || p.signedMethod !== null)
      .map((p) => {
        const planned = signatureByRole.get(p.roleFa);
        return {
          roleFa: p.roleFa,
          nameFa: p.nameFa,
          href: p.proofDocumentId
            ? contractDocumentUrl(contract.id, p.proofDocumentId)
            : null,
          unprintable: p.proofDocumentId !== null && !planned,
        };
      }),
    annexes: annexPlan.annexes.map((annex) => ({
      documentId: annex.document.id,
      titleFa: annex.titleFa,
      fileName: annex.document.fileName,
      mime: annex.mime,
      href:
        annex.document.id && annex.mime
          ? contractDocumentUrl(contract.id, annex.document.id)
          : null,
      unprintable: !!annex.mime && !isPrintableAttachmentMime(annex.mime),
    })),
    adminMessage: adminMessage?.messageFa ?? null,
    // The sheet prints the certificate only when this version really
    // carries a registration — the same rule `buildContractPdfInputs`
    // applies, so the preview can never show an attestation the stored
    // PDF omits (or claim a path the record does not hold).
    authenticity: authorisation
      ? {
          path: registration?.path ?? "legalir_review",
          reviewedByLegalir,
          registeredAt: registration?.createdAt ?? approved?.decidedAt ?? null,
          registeredByLabelFa:
            registration?.actorLabelFa ??
            approved?.reviewerInitials ??
            approved?.reviewingOfficeFa ??
            null,
          reviewId: approved?.id ?? null,
          reviewedAt: approved?.decidedAt ?? null,
          stampApplied: stampBinding !== null,
          stampSha256: stampBinding?.sha256 ?? null,
          hologramApplied: stampBinding !== null && hologram !== null,
        }
      : null,
    selfFinal:
      registration?.path === "self_final"
        ? {
            actorLabelFa: registration.actorLabelFa,
            registeredAt: registration.createdAt,
            reasonFa: registration.reasonFa,
          }
        : null,
  };

  return {
    stage,
    steps: buildLifecycleSteps(stage),
    registrationStatus,
    registrationStatusFa: registrationStatusFa(registrationStatus),
    signatureRequest,
    invitations,
    lawyerReview,
    aiReview,
    adminReview,
    adminApproved: approved !== null,
    stamped: seal !== null,
    officialStamp: seal
      ? {
          approvedByLabelFa: seal.approvedByLabelFa,
          approvedAt: seal.appliedAt,
          reasonFa: seal.reasonFa,
          documentHash: seal.documentHash,
        }
      : null,
    comments,
    // §7 — the type-level «before you sign» tips. Stored reviewer rows win
    // over the seed; they live OUTSIDE the contract text and are never a
    // condition for proceeding.
    preSignTips: preSignTipsForType(contract.type),
    canPrepareForSignature,
    canSign,
    canFinalize,
    canSubmitForAdminReview,
    registration,
    reviewedByLegalir,
    canSelfFinalize,
    printIssues,
    adminMessage,
    printMirror,
  };
}

/** True when the contract is at the signature stage right now. */
export function isContractAtSignatureStage(contract: PropertyContract): boolean {
  return isAtSignatureStage(contract.state);
}
