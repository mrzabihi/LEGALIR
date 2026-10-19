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
import { assertTransition, IllegalTransitionError, stateLabelFa } from "./state-machine";
import { renderContractPdf } from "./pdf";
import { mergedLegalBasisCatalog, preSignTipsForType } from "./legal-review-db";
import { signatureMarksForVersion } from "./signature/db";
import { writeContractFile } from "./storage";

/** The review mark recorded on the final version's metadata. */
export interface FinalStampMetadata {
  applied: true;
  text: string;
  disclaimerFa: string;
  reviewId: string;
  reviewedAt: string | null;
  reviewingOfficeFa: string;
  reviewerId: string | null;
  reviewerInitials: string | null;
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

/** Build the metadata mark from the real approval + stamp rows. */
function buildStamp(
  approval: ContractAdminReview,
  official: ContractStampRequest | null
): FinalStampMetadata {
  return {
    applied: true,
    text: CONTRACT_REVIEW_STAMP_TEXT,
    disclaimerFa: CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
    reviewId: approval.id,
    reviewedAt: approval.decidedAt,
    reviewingOfficeFa: approval.reviewingOfficeFa,
    reviewerId: approval.reviewerId,
    reviewerInitials: approval.reviewerInitials,
    officialStamp: official
      ? {
          sha256: official.stampAssetSha256 ?? "",
          version: official.stampAssetVersion,
          approvedAt: official.appliedAt,
          approvedByInitials: official.approvedByLabelFa ?? null,
        }
      : null,
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
  const { baseUrl, contract, version, actorId, finalizedAt, stamp, replaceExisting } = params;
  try {
    const bytes = await renderContractPdf({
      contract,
      version,
      baseUrl,
      // The sealed final PDF carries the reviewer-corrected legal annex and
      // the type's non-compulsory pre-sign tips, exactly like a draft.
      legalBasisCatalog: mergedLegalBasisCatalog(),
      preSignTips: preSignTipsForType(contract.type),
      stateFa: stateLabelFa(contract.state),
      // The sealed final PDF records what each party really signed, for
      // THIS version and no other.
      signatureMarks: signatureMarksForVersion(contract.id, version.id),
      stamp: {
        applied: true,
        reviewedAt: stamp.reviewedAt ?? undefined,
        reviewingOfficeFa: stamp.reviewingOfficeFa,
        reviewerInitials: stamp.reviewerInitials,
        officialStamp: stamp.officialStamp,
      },
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
    if (!approval) {
      return {
        ok: false,
        code: "ADMIN_APPROVAL_REQUIRED",
        messageFa: "نسخهٔ نهایی دیگر تأیید واحد بررسی حقوقی لیگالیر را ندارد.",
      };
    }
    const stamp = buildStamp(approval, currentVersionStamp(contract, version.documentHash));
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
  // Gate 2 — the signed content carries a bound LEGALIR approval
  // ----------------------------------------------------------
  const signedVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, signedVersion?.documentHash ?? null);
  if (!approval) {
    return {
      ok: false,
      code: "ADMIN_APPROVAL_REQUIRED",
      messageFa: "نسخه امضاشده باید تأیید واحد بررسی حقوقی لیگالیر را داشته باشد.",
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

  const stamp = buildStamp(approval, currentVersionStamp(updated, version.documentHash));
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
