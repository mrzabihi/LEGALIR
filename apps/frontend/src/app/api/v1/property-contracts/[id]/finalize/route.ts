// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/finalize
// ============================================================
// POST — finalize a fully signed contract.
//
// Finalizing freezes the signed content as the final immutable
// version and moves the contract to the state the registration
// policy declares:
//
//   rent → FINALIZED
//   sale → READY_FOR_OFFICIAL_REGISTRATION
//
// A sale contract is NEVER marked as "ownership transferred". The
// policy layer owns that decision, not this route.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractDocument,
  ContractFinalizeResponse,
  PropertyContractVersion,
} from "@legalir/types";
import {
  audit,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  getContractById,
  getVersion,
  insertContractDocument,
  listApprovals,
  listParties,
  updateContractForUser,
} from "@/lib/contracts/db";
import { writeContractFile } from "@/lib/contracts/storage";
import { renderContractPdf } from "@/lib/contracts/pdf";
import { currentVersionApproval } from "@/lib/contracts/admin-review";
import { currentVersionStamp } from "@/lib/contracts/stamp-review";
import { createVersion } from "@/lib/contracts/snapshot";
import { assertTransition, IllegalTransitionError } from "@/lib/contracts/state-machine";
import { evaluateRegistrationPolicy } from "@/lib/contracts/registration-policy";
import {
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  // Only a fully signed contract may be finalized.
  if (contract.state !== "SIGNED") {
    return conflict("تنها قرارداد امضاشده قابل نهایی‌سازی است.", "NOT_SIGNED");
  }

  // Every party must have signed the current version.
  const parties = listParties(contract.id);
  const signedPartyIds = new Set(
    listApprovals(contract.id)
      .filter((a) => a.contractVersionId === contract.currentVersionId && a.status === "approved")
      .map((a) => a.partyId)
  );
  const allSigned = parties.length > 0 && parties.every((p) => signedPartyIds.has(p.id));
  if (!allSigned) {
    return conflict("همه طرفین باید قرارداد را امضا کنند.", "NOT_ALL_SIGNED");
  }

  // THE COMPULSORY GATE: the signed content must carry a valid LEGALIR
  // admin approval before a final version is stamped or issued. Because
  // a snapshot is a deterministic function of the content, the approved
  // hash and the signed version's hash must match; if the content moved
  // on after approval the approval no longer holds.
  const signedVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approval = currentVersionApproval(contract, signedVersion?.documentHash ?? null);
  if (!approval) {
    return conflict(
      "نسخه امضاشده باید تأیید واحد بررسی حقوقی لیگالیر را داشته باشد.",
      "ADMIN_APPROVAL_REQUIRED"
    );
  }

  const outcome = evaluateRegistrationPolicy(contract.type);

  try {
    assertTransition(contract.state, outcome.postSignState);
  } catch (err) {
    if (err instanceof IllegalTransitionError) return conflict(err.message, "ILLEGAL_TRANSITION");
    throw err;
  }

  // Freeze the signed content as the final immutable version.
  const { version } = createVersion(contract, userId);
  const finalizedAt = new Date().toISOString();

  const updated = updateContractForUser(userId, contract.id, {
    state: outcome.postSignState,
    finalVersionId: version.id,
    finalizedAt,
  });
  if (!updated) return conflict("نهایی‌سازی ناموفق بود.", "FINALIZE_FAILED");

  // The review stamp is now part of the final document's metadata: the
  // admin approval that authorised this exact version is recorded with
  // the reviewer, the date and the disclaimer, so the stamp is never
  // mistaken for a court/notary/registry seal.
  //
  // The OFFICIAL LEGALIR stamp (Super-Admin authorised) is recorded
  // alongside it when a valid approval is still bound to this version
  // hash AND the stamp master is byte-identical — the same gate the PDF
  // renderer uses, so the metadata and the drawn mark never disagree.
  const official = currentVersionStamp(contract, version.documentHash);
  const stamp = {
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

  // The final A4 artifact is rendered ONCE, here, from the frozen
  // snapshot — the single source of truth — and stored as a PRIVATE
  // contract document so the delivered PDF is byte-stable and its hash is
  // recorded. Best-effort: a render/storage failure must never block
  // finalization, because the /pdf route can always render from the same
  // snapshot on demand.
  const artifact = await storeFinalArtifact({
    request,
    contractId: contract.id,
    referenceCode: contract.referenceCode,
    userId,
    finalizedAt,
    version,
    stamp,
  });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "contract.finalized",
    descriptionFa: outcome.headlineFa,
    metadata: {
      finalVersionId: version.id,
      documentHash: version.documentHash,
      postSignState: outcome.postSignState,
      requiresNotaryVisit: outcome.requiresNotaryVisit,
      stamp,
      finalArtifact: artifact,
    },
  });

  const body: ContractFinalizeResponse = {
    id: updated.id,
    state: updated.state,
    finalVersionId: version.id,
    finalizedAt,
    documentHash: version.documentHash,
    publicVerificationId: updated.publicVerificationId,
  };

  return ok({
    ...body,
    registration: {
      headlineFa: outcome.headlineFa,
      bodyFa: outcome.bodyFa,
      requiresNotaryVisit: outcome.requiresNotaryVisit,
    },
    stamp,
    finalArtifact: artifact,
  });
}

/** The private final-PDF document, or null when it could not be stored. */
interface FinalArtifact {
  documentId: string;
  storageKey: string;
  hash: string;
  sizeBytes: number;
  fileName: string;
}

/**
 * Render the final A4 PDF from the frozen snapshot and store it as a
 * PRIVATE contract document (`final_pdf`). Returns null — never throws —
 * when rendering or storage fails, so finalization is never blocked; the
 * /pdf route re-renders from the same snapshot on demand.
 */
async function storeFinalArtifact(params: {
  request: Request;
  contractId: string;
  referenceCode: string;
  userId: string;
  finalizedAt: string;
  version: PropertyContractVersion;
  stamp: {
    officialStamp: { sha256: string; version: string } | null;
    reviewedAt?: string | null;
    reviewingOfficeFa?: string;
    reviewerInitials?: string | null;
  };
}): Promise<FinalArtifact | null> {
  const { request, contractId, referenceCode, userId, finalizedAt, version, stamp } = params;
  try {
    const contract = getContractById(contractId);
    if (!contract) return null;

    const baseUrl = new URL(request.url).origin;
    const bytes = await renderContractPdf({
      contract,
      version,
      baseUrl,
      stamp: {
        applied: true,
        reviewedAt: stamp.reviewedAt ?? undefined,
        reviewingOfficeFa: stamp.reviewingOfficeFa,
        reviewerInitials: stamp.reviewerInitials,
        officialStamp: stamp.officialStamp,
      },
    });

    const documentId = `doc-${crypto.randomUUID()}`;
    const fileName = `${referenceCode}-final.pdf`;
    const stored = writeContractFile({
      contractId,
      documentId,
      fileName,
      bytes: Buffer.from(bytes),
    });

    const doc: ContractDocument = {
      id: documentId,
      contractId,
      category: "final_pdf",
      fileName,
      mime: "application/pdf",
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      hash: stored.hash,
      description: "نسخهٔ نهایی قرارداد (PDF مهرشده)",
      photoCategory: null,
      uploadedBy: userId,
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

/** GET — the final version metadata, for the final page. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { contract } = ctx;
  if (!contract.finalVersionId) {
    return conflict("این قرارداد هنوز نهایی نشده است.", "NOT_FINALIZED");
  }
  const version = getVersion(contract.id, contract.finalVersionId);
  if (!version) return conflict("نسخه نهایی یافت نشد.", "NOT_FINALIZED");

  const outcome = evaluateRegistrationPolicy(contract.type);
  return ok({
    state: contract.state,
    finalizedAt: contract.finalizedAt,
    finalVersionId: version.id,
    versionNumber: version.versionNumber,
    documentHash: version.documentHash,
    publicVerificationId: contract.publicVerificationId,
    registration: {
      headlineFa: outcome.headlineFa,
      bodyFa: outcome.bodyFa,
      requiresNotaryVisit: outcome.requiresNotaryVisit,
    },
  });
}
