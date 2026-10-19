// ============================================================
// LEGALIR — Finalization (server-only)
// ============================================================
// The single implementation of "freeze the signed content as the FINAL
// version". Two callers share it so the two acts can never diverge:
//
//   • the owner route  POST /api/v1/property-contracts/[id]/finalize
//   • the admin route  POST /api/v1/admin/contracts/[id]/stamp  (apply)
//
// Finalizing is gated on three real states, all read from the store:
//
//   1. the contract is fully signed (state SIGNED and every party has an
//      `approved` approval bound to the CURRENT version);
//   2. the signed version carries a valid LEGALIR admin approval whose
//      recorded hash matches — a content change voids it;
//   3. the state transition to the registration-policy state is legal.
//
// The frozen version keeps every prior version untouched (§4): nothing
// is deleted or overwritten, so the change history survives. A second
// finalization call is idempotent — it returns the SAME final version
// and never creates another one. When the admin applies the official
// seal AFTER the owner already finalized, the caller passes
// `refreshArtifact` so the stored PDF is re-rendered with the seal and
// hologram on every page (the draft watermark is absent by construction
// once `stamp.applied` is true — the renderer's two marks are mutually
// exclusive).
// ============================================================

import crypto from "node:crypto";
import type {
  ContractAdminReview,
  ContractDocument,
  ContractStampRequest,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import {
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import {
  appendAudit,
  deleteContractDocument,
  getContractById,
  getVersion,
  insertContractDocument,
  listApprovals,
  listContractDocuments,
  listParties,
  updateContractById,
} from "./db";
import { createVersion } from "./snapshot";
import { currentVersionApproval } from "./admin-review";
import { currentVersionStamp } from "./stamp-review";
import { evaluateRegistrationPolicy } from "./registration-policy";
import { assertTransition, IllegalTransitionError } from "./state-machine";
import { renderContractPdf } from "./pdf";
import { buildContractPdfInputs } from "./pdf-inputs";
import { contractPrintIssues } from "./admin-print";
import { latestSignatureRequestDetail } from "./signature/db";
import { registrationForHash, resolveSigningAuthorisation } from "./registration";
import { writeContractFile } from "./storage";

/** The review mark recorded on the final version's metadata. */
export interface FinalStampMetadata {
  applied: true;
  /**
   * Which registration path authorised the final document. A
   * `self_final` record NEVER claims a review happened: its metadata
   * carries `reviewId: null` and the actor label instead.
   */
  path: "legalir_review" | "self_final";
  text: string;
  disclaimerFa: string;
  reviewId: string | null;
  reviewedAt: string | null;
  reviewingOfficeFa: string;
  reviewerId: string | null;
  reviewerInitials: string | null;
  /** The self-final record's actor and reason (null on the reviewed path). */
  selfFinal: {
    registrationId: string;
    actorLabelFa: string;
    registeredAt: string;
    reasonFa: string;
  } | null;
  /**
   * The OFFICIAL seal, present only when a Super-Admin stamp is validly
   * bound to the FINAL version's hash and the stamp master is still
   * byte-identical. `null` means the document carries the text review
   * mark only — never a drawn seal it is not entitled to.
   */
  officialStamp: {
    sha256: string;
    version: string;
    approvedAt: string | null;
    approvedByInitials: string | null;
  } | null;
}

/** The stored final A4 artifact. */
export interface FinalArtifact {
  documentId: string;
  storageKey: string;
  hash: string;
  sizeBytes: number;
  fileName: string;
}

export type FinalizeFailureCode =
  | "NOT_SIGNED"
  | "NOT_ALL_SIGNED"
  | "ADMIN_APPROVAL_REQUIRED"
  | "ILLEGAL_TRANSITION"
  | "PRINT_UNFAITHFUL"
  | "FINALIZE_FAILED";

export type FinalizeOutcome =
  | {
      ok: true;
      /** The contract row AFTER the state + finalVersionId patch. */
      contract: PropertyContract;
      version: PropertyContractVersion;
      finalizedAt: string;
      stamp: FinalStampMetadata;
      artifact: FinalArtifact | null;
      registration: {
        headlineFa: string;
        bodyFa: string;
        requiresNotaryVisit: boolean;
      };
      /** True when the version already existed and was returned as-is. */
      alreadyFinalized: boolean;
    }
  | { ok: false; code: FinalizeFailureCode; messageFa: string };

export interface FinalizeInput {
  contract: PropertyContract;
  /** The acting user id (owner or admin). */
  actorId: string;
  /** Display label written to the contract audit trail. */
  actorLabel: string;
  /** Absolute origin for the verification link printed in the PDF. */
  baseUrl: string;
  /**
   * Re-render and replace the stored final PDF. Used by the admin seal
   * path: the owner may have finalized BEFORE the seal was applied, in
   * which case the stored artifact predates the seal.
   */
  refreshArtifact?: boolean;
}

/**
 * Build the metadata mark from the REAL authorisation row. On the
 * reviewed path that is the admin approval; on the self-final path it is
 * the registration record, printed with `reviewId: null` so nothing in
 * the metadata can ever read as a review that did not happen.
 */
function buildStamp(
  contractId: string,
  documentHash: string,
  approval: ContractAdminReview | null,
  official: ContractStampRequest | null
): FinalStampMetadata {
  const registration = registrationForHash(contractId, documentHash);
  const seal = official
    ? {
        sha256: official.stampAssetSha256 ?? "",
        version: official.stampAssetVersion,
        approvedAt: official.appliedAt,
        approvedByInitials: official.approvedByLabelFa ?? null,
      }
    : null;

  if (approval) {
    return {
      applied: true,
      path: "legalir_review",
      text: CONTRACT_REVIEW_STAMP_TEXT,
      disclaimerFa: CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
      reviewId: approval.id,
      reviewedAt: approval.decidedAt,
      reviewingOfficeFa: approval.reviewingOfficeFa,
      reviewerId: approval.reviewerId,
      reviewerInitials: approval.reviewerInitials,
      selfFinal: null,
      officialStamp: seal,
    };
  }

  return {
    applied: true,
    path: "self_final",
    text: "ثبت نهایی بدون بررسی لیگالیر",
    disclaimerFa: "این سند بدون بررسی واحد حقوقی لیگالیر ثبت نهایی شده و «بررسی‌شده» محسوب نمی‌شود.",
    reviewId: null,
    reviewedAt: null,
    reviewingOfficeFa: "بررسی لیگالیر انجام نشده است",
    reviewerId: null,
    reviewerInitials: null,
    selfFinal: registration
      ? {
          registrationId: registration.id,
          actorLabelFa: registration.actorLabelFa,
          registeredAt: registration.createdAt,
          reasonFa: registration.reasonFa,
        }
      : null,
    officialStamp: seal,
  };
}

/** The stored `final_pdf` document as the artifact shape, or null. */
function existingArtifact(contractId: string): FinalArtifact | null {
  const doc = listContractDocuments(contractId).find((d) => d.category === "final_pdf");
  if (!doc) return null;
  return {
    documentId: doc.id,
    storageKey: doc.storageKey,
    hash: doc.hash,
    sizeBytes: doc.sizeBytes,
    fileName: doc.fileName,
  };
}

/**
 * Render the final A4 PDF from the frozen snapshot and store it as a
 * PRIVATE contract document (`final_pdf`). Returns null — never throws —
 * when rendering or storage fails, so finalization is never blocked; the
 * /pdf route re-renders from the same snapshot on demand.
 */
async function storeFinalArtifact(params: {
  baseUrl: string;
  contract: PropertyContract;
  version: PropertyContractVersion;
  actorId: string;
  finalizedAt: string;
  stamp: FinalStampMetadata;
  replaceExisting: boolean;
}): Promise<FinalArtifact | null> {
  const { baseUrl, contract, version, actorId, finalizedAt, replaceExisting } = params;
  try {
    // The stored artifact is rendered from the SAME input assembly the
    // /pdf routes use, so a downloaded PDF and the archived one can
    // never disagree about marks, uploaded signatures or annexed pages.
    // The registration path is re-derived here too, so the amber
    // unreviewed notice (or the blue reviewed mark) always matches the
    // authorisation row recorded for this hash.
    const bytes = await renderContractPdf({
      contract,
      version,
      baseUrl,
      ...buildContractPdfInputs({ contract, version }),
    });

    // A refresh replaces the previous derived artifact — the document is
    // not a source of truth, so keeping a stale unsealed copy would only
    // let two "final" PDFs disagree.
    if (replaceExisting) {
      for (const doc of listContractDocuments(contract.id)) {
        if (doc.category === "final_pdf") deleteContractDocument(contract.id, doc.id);
      }
    }

    const documentId = `doc-${crypto.randomUUID()}`;
    const fileName = `${contract.referenceCode}-final.pdf`;
    const stored = writeContractFile({
      contractId: contract.id,
      documentId,
      fileName,
      bytes: Buffer.from(bytes),
    });

    const doc: ContractDocument = {
      id: documentId,
      contractId: contract.id,
      category: "final_pdf",
      fileName,
      mime: "application/pdf",
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      hash: stored.hash,
      description: "نسخهٔ نهایی قرارداد (PDF مهرشده)",
      photoCategory: null,
      uploadedBy: actorId,
      uploadedAt: finalizedAt,
    };
    insertContractDocument(doc);

    return {
      documentId,
      storageKey: stored.storageKey,
      hash: stored.hash,
      sizeBytes: stored.sizeBytes,
      fileName,
    };
  } catch {
    return null;
  }
}

/**
 * Freeze the signed content as the final immutable version.
 *
 * Idempotent: when the contract already has a final version, that SAME
 * version is returned and no new one is created. The caller's
 * `refreshArtifact` only controls whether the stored PDF is re-rendered
 * (used after the official seal is applied).
 */
export async function finalizeSignedContract(input: FinalizeInput): Promise<FinalizeOutcome> {
  const { actorId, actorLabel, baseUrl } = input;
  const contract = getContractById(input.contract.id) ?? input.contract;
  const registration = evaluateRegistrationPolicy(contract.type);

  // ----------------------------------------------------------
  // Already finalized — return the frozen version, never a new one
  // ----------------------------------------------------------
  if (contract.finalVersionId) {
    const version = getVersion(contract.id, contract.finalVersionId);
    if (!version) {
      return { ok: false, code: "FINALIZE_FAILED", messageFa: "نسخهٔ نهایی یافت نشد." };
    }
    const approval = currentVersionApproval(contract, version.documentHash);
    const authorisation = resolveSigningAuthorisation({
      contract,
      documentHash: version.documentHash,
      approval,
    });
    if (!authorisation) {
      return {
        ok: false,
        code: "ADMIN_APPROVAL_REQUIRED",
        messageFa:
          "نسخهٔ نهایی نه تأیید واحد بررسی حقوقی لیگالیر را دارد و نه ثبت نهایی بی‌بررسی معتبری برای همین محتوا.",
      };
    }
    const stamp = buildStamp(
      contract.id,
      version.documentHash,
      approval,
      currentVersionStamp(contract, version.documentHash)
    );
    const artifact = input.refreshArtifact
      ? await storeFinalArtifact({
          baseUrl,
          contract,
          version,
          actorId,
          finalizedAt: contract.finalizedAt ?? new Date().toISOString(),
          stamp,
          replaceExisting: true,
        })
      : existingArtifact(contract.id);

    return {
      ok: true,
      contract,
      version,
      finalizedAt: contract.finalizedAt ?? version.createdAt,
      stamp,
      artifact,
      registration: {
        headlineFa: registration.headlineFa,
        bodyFa: registration.bodyFa,
        requiresNotaryVisit: registration.requiresNotaryVisit,
      },
      alreadyFinalized: true,
    };
  }

  // ----------------------------------------------------------
  // Gate 1 — fully signed
  // ----------------------------------------------------------
  if (contract.state !== "SIGNED") {
    return {
      ok: false,
      code: "NOT_SIGNED",
      messageFa: "تنها قرارداد امضاشده قابل نهایی‌سازی است.",
    };
  }

  const parties = listParties(contract.id);
  const signedPartyIds = new Set(
    listApprovals(contract.id)
      .filter(
        (a) => a.contractVersionId === contract.currentVersionId && a.status === "approved"
      )
      .map((a) => a.partyId)
  );
  if (parties.length === 0 || !parties.every((p) => signedPartyIds.has(p.id))) {
    return {
      ok: false,
      code: "NOT_ALL_SIGNED",
      messageFa: "همه طرفین باید قرارداد را امضا کنند.",
    };
  }

  // ----------------------------------------------------------
  // Gate 2 — the signed content carries a valid authorisation:
  //          a bound LEGALIR approval, OR a hash-bound self-final
  //          registration (which explicitly means "no review happened")
  // ----------------------------------------------------------
  const signedVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, signedVersion?.documentHash ?? null);
  const authorisation = resolveSigningAuthorisation({
    contract,
    documentHash: signedVersion?.documentHash ?? null,
    approval,
  });
  if (!authorisation) {
    return {
      ok: false,
      code: "ADMIN_APPROVAL_REQUIRED",
      messageFa:
        "نسخه امضاشده باید تأیید واحد بررسی حقوقی لیگالیر یا ثبت نهایی بی‌بررسی معتبر برای همین محتوا داشته باشد.",
    };
  }

  // ----------------------------------------------------------
  // Gate 2.5 — nothing in the document is unprintable
  //
  // An annex in DOCX/WEBP, or a signature scan that is missing or
  // unreadable, would leave the stored PDF incomplete. The user is told
  // BEFORE the final act, never after: a contract must not claim to be
  // final while one of its parts silently failed to print.
  // ----------------------------------------------------------
  const printRequest = latestSignatureRequestDetail(contract.id);
  const printIssues = contractPrintIssues({
    contract,
    documents: listContractDocuments(contract.id),
    participants:
      printRequest && printRequest.contractVersionId === signedVersion?.id
        ? printRequest.participants
        : [],
  });
  if (printIssues.length > 0) {
    return {
      ok: false,
      code: "PRINT_UNFAITHFUL",
      messageFa: printIssues.map((issue) => issue.messageFa).join(" "),
    };
  }

  // ----------------------------------------------------------
  // Gate 3 — the state transition is legal
  // ----------------------------------------------------------
  try {
    assertTransition(contract.state, registration.postSignState);
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return { ok: false, code: "ILLEGAL_TRANSITION", messageFa: err.message };
    }
    throw err;
  }

  // The version the parties signed BECOMES the final version. Its content
  // is already frozen and its hash is the one the admin approved, so
  // re-snapshotting would merely mint a byte-identical document under a
  // new id — and would invalidate the party approvals, which are bound to
  // the signed version's id. Keeping the same row also means the final
  // version's id is exactly the one on the signature record.
  const fresh = getContractById(contract.id) ?? contract;
  const version = signedVersion ?? createVersion(fresh, actorId).version;
  const finalizedAt = new Date().toISOString();

  const updated = updateContractById(contract.id, {
    state: registration.postSignState,
    finalVersionId: version.id,
    finalizedAt,
  });
  if (!updated) {
    return { ok: false, code: "FINALIZE_FAILED", messageFa: "نهایی‌سازی ناموفق بود." };
  }

  const stamp = buildStamp(
    updated.id,
    version.documentHash,
    approval,
    currentVersionStamp(updated, version.documentHash)
  );
  const artifact = await storeFinalArtifact({
    baseUrl,
    contract: updated,
    version,
    actorId,
    finalizedAt,
    stamp,
    replaceExisting: false,
  });

  appendAudit({
    id: `aud-${crypto.randomUUID()}`,
    contractId: contract.id,
    actorId,
    actorLabel,
    action: "contract.finalized",
    descriptionFa: registration.headlineFa,
    metadata: {
      finalVersionId: version.id,
      documentHash: version.documentHash,
      postSignState: registration.postSignState,
      requiresNotaryVisit: registration.requiresNotaryVisit,
      stamp,
      finalArtifact: artifact,
    },
    createdAt: finalizedAt,
  });

  return {
    ok: true,
    contract: updated,
    version,
    finalizedAt,
    stamp,
    artifact,
    registration: {
      headlineFa: registration.headlineFa,
      bodyFa: registration.bodyFa,
      requiresNotaryVisit: registration.requiresNotaryVisit,
    },
    alreadyFinalized: false,
  };
}

// ------------------------------------------------------------
// T7 — regenerate the stored final PDF after a late change
// ------------------------------------------------------------
// The printed document depends on more than the frozen clauses: the
// uploaded signature scans, the annexed pages, the seal/hologram, the
// admin's red message. When one of those changes AFTER finalization, the
// stored artifact would otherwise keep showing the old version while the
// preview and the /pdf route show the new one — two "final" documents that
// disagree.
//
// This helper is the ONE regeneration entry point: it renders from the
// same input assembly as the preview and the on-demand route, and replaces
// the previous derived artifact (never keeps a stale second copy).
//
// Returns null when there is nothing to refresh — the contract is not
// finalized, its final version is gone, or rendering failed. A failed
// refresh must never corrupt the existing artifact: the write happens
// only after a successful render.
export async function refreshFinalArtifact(params: {
  contractId: string;
  actorId: string;
  baseUrl: string;
}): Promise<FinalArtifact | null> {
  const contract = getContractById(params.contractId);
  if (!contract?.finalVersionId) return null;

  const version = getVersion(contract.id, contract.finalVersionId);
  if (!version) return null;

  const approval = currentVersionApproval(contract, version.documentHash);
  const stamp = buildStamp(
    contract.id,
    version.documentHash,
    approval,
    currentVersionStamp(contract, version.documentHash)
  );

  const artifact = await storeFinalArtifact({
    baseUrl: params.baseUrl,
    contract,
    version,
    actorId: params.actorId,
    finalizedAt: contract.finalizedAt ?? new Date().toISOString(),
    stamp,
    replaceExisting: true,
  });

  if (artifact) {
    appendAudit({
      id: `aud-${crypto.randomUUID()}`,
      contractId: contract.id,
      actorId: params.actorId,
      actorLabel: "سیستم",
      action: "contract.final_artifact.regenerated",
      descriptionFa: "نسخهٔ نهایی PDF پس از تغییر ورودی‌های چاپ (پیام ادمین/امضا/مهر) بازتولید شد.",
      metadata: {
        finalVersionId: version.id,
        documentHash: version.documentHash,
        finalArtifact: artifact,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return artifact;
}
