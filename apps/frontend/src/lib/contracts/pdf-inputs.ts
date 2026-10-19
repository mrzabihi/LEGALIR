// ============================================================
// LEGALIR — One assembly of the PDF inputs (server-only)
// ============================================================
// The owner PDF route, the token-scoped invitation PDF route and the
// final-artifact writer must all produce byte-consistent documents.
// This module is the ONLY place that resolves:
//
//   • which registration path authorises the version (review vs
//     self-final) — and therefore which mark is drawn;
//   • the official seal/hologram binding;
//   • the parties' uploaded signature scans;
//   • the annex files to append, in registration order;
//   • the admin message and the authenticity facts.
//
// Callers pass a contract + version and get render params back; the
// renderer itself never reads storage.
// ============================================================

import fs from "node:fs";
import type { PropertyContract, PropertyContractVersion } from "@legalir/types";
import {
  SIGNATURE_PARTICIPANT_STATUS_FA,
  SIGNATURE_SIGN_METHOD_FA,
} from "@legalir/types";
import { listContractDocuments } from "./db";
import { currentVersionApproval } from "./admin-review";
import { currentVersionStamp } from "./stamp-review";
import { registrationForHash, resolveSigningAuthorisation } from "./registration";
import { getAdminMessage, planContractAnnexes, planSignatureImages } from "./admin-print";
import { latestSignatureRequestDetail, signatureMarksForVersion } from "./signature/db";
import { mergedLegalBasisCatalog, preSignTipsForType } from "./legal-review-db";
import { stateLabelFa } from "./state-machine";
import { loadHologram, loadReviewStamp } from "./stamp-asset";
import type {
  AuthenticityInfo,
  ContractAnnexInput,
  ContractSignatureImage,
  RenderPdfParams,
} from "./pdf";

/** Public-safe initials, e.g. «م.م» — never the full name. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LG";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join(".");
}

export type ContractPdfInputs = Omit<RenderPdfParams, "contract" | "version" | "baseUrl">;

/**
 * Resolve every input `renderContractPdf` needs for THIS version.
 *
 * An unreadable annex/signature file is OMITTED here (the renderer would
 * otherwise reject the whole document); `contractPrintIssues` reports the
 * same omission to the UI, and finalisation is blocked while any issue
 * remains, so a contract can never silently ship without its annexes.
 */
export function buildContractPdfInputs(params: {
  contract: PropertyContract;
  version: PropertyContractVersion;
}): ContractPdfInputs {
  const { contract, version } = params;
  const documents = listContractDocuments(contract.id);

  const approval = currentVersionApproval(contract, version.documentHash);
  const registration = registrationForHash(contract.id, version.documentHash);
  const authorisation = resolveSigningAuthorisation({
    contract,
    documentHash: version.documentHash,
    approval,
  });
  const official = currentVersionStamp(contract, version.documentHash);

  // The seal master is byte-checked inside the renderer; here we only
  // decide WHICH binding authorises drawing it. The reviewed path needs a
  // Super-Admin stamp request; the self-final path uses the current
  // master, because LEGALIR itself issued an unreviewed final document
  // and its marks must appear exactly like on any other final copy —
  // while the amber notice states plainly that no review happened.
  const sealAsset = loadReviewStamp();
  const stampBinding = official
    ? {
        sha256: official.stampAssetSha256 ?? "",
        version: official.stampAssetVersion,
        approvedAt: official.appliedAt,
        approvedByInitials: official.approvedByLabelFa
          ? initialsFrom(official.approvedByLabelFa)
          : null,
      }
    : registration?.path === "self_final" && sealAsset
      ? {
          sha256: sealAsset.sha256,
          version: sealAsset.version,
          approvedAt: registration.createdAt,
          approvedByInitials: null,
        }
      : null;

  const stamp = approval
    ? {
        applied: true,
        path: "legalir_review" as const,
        reviewId: approval.id,
        reviewedAt: approval.decidedAt ?? undefined,
        reviewingOfficeFa: approval.reviewingOfficeFa,
        reviewerInitials: approval.reviewerInitials,
        officialStamp: stampBinding,
      }
    : registration?.path === "self_final"
      ? {
          applied: true,
          path: "self_final" as const,
          selfFinal: {
            actorLabelFa: registration.actorLabelFa,
            registeredAt: registration.createdAt,
            reasonFa: registration.reasonFa,
          },
          officialStamp: stampBinding,
        }
      : { applied: false };

  // Signature scans — only the request bound to THIS version counts.
  const request = latestSignatureRequestDetail(contract.id);
  const participants =
    request && request.contractVersionId === version.id ? request.participants : [];
  const signaturePlan = planSignatureImages({ participants, documents });
  const signatureImages: ContractSignatureImage[] = [];
  for (const planned of signaturePlan.images) {
    if (!planned.absolutePath) continue;
    if (planned.mime !== "image/png" && planned.mime !== "image/jpeg") continue;
    try {
      signatureImages.push({
        roleFa: planned.participant.roleFa,
        mime: planned.mime,
        bytes: fs.readFileSync(planned.absolutePath),
      });
    } catch {
      // Unreadable now — surfaced as a print issue by the lifecycle view.
    }
  }

  // Annexes — registration order, printable files only.
  const annexPlan = planContractAnnexes({ contract, documents });
  const annexes: ContractAnnexInput[] = [];
  for (const planned of annexPlan.annexes) {
    if (!planned.absolutePath) continue;
    if (
      planned.mime !== "application/pdf" &&
      planned.mime !== "image/png" &&
      planned.mime !== "image/jpeg"
    ) {
      continue;
    }
    try {
      annexes.push({
        titleFa: planned.titleFa,
        fileName: planned.document.fileName,
        mime: planned.mime,
        bytes: fs.readFileSync(planned.absolutePath),
      });
    } catch {
      // Unreadable now — surfaced as a print issue by the lifecycle view.
    }
  }

  const hologram = loadHologram();

  // The certificate attests to a REGISTRATION. Until the version carries
  // one (a bound LEGALIR approval or a self-final registration) there is
  // nothing to attest to, and printing the page would state a path the
  // record does not hold. So it is omitted — not printed half-empty.
  const authenticity: AuthenticityInfo | null = authorisation
    ? {
        path: authorisation.kind === "self_final" ? "self_final" : "legalir_review",
        reviewedByLegalir: approval !== null,
        registeredAt:
          authorisation.kind === "self_final"
            ? authorisation.registration.createdAt
            : (approval?.decidedAt ?? null),
        registeredByLabelFa:
          authorisation.kind === "self_final"
            ? authorisation.registration.actorLabelFa
            : (approval?.reviewerInitials ?? approval?.reviewingOfficeFa ?? null),
        reviewId: approval?.id ?? null,
        reviewedAt: approval?.decidedAt ?? null,
        participants: participants.map((p) => ({
          roleFa: p.roleFa,
          nameFa: p.nameFa,
          statusFa: SIGNATURE_PARTICIPANT_STATUS_FA[p.status],
          signedAt: p.signedAt,
          methodFa: p.signedMethod ? SIGNATURE_SIGN_METHOD_FA[p.signedMethod] : null,
        })),
        stampApplied: stamp.applied && stampBinding !== null,
        stampSha256: stampBinding?.sha256 ?? null,
        hologramApplied: stamp.applied && hologram !== null,
      }
    : null;

  const adminMessage = getAdminMessage(contract.id);

  return {
    legalBasisCatalog: mergedLegalBasisCatalog(),
    preSignTips: preSignTipsForType(contract.type),
    stateFa: stateLabelFa(contract.state),
    signatureMarks: signatureMarksForVersion(contract.id, version.id),
    signatureImages,
    annexes,
    adminMessage: adminMessage ? { messageFa: adminMessage.messageFa } : null,
    authenticity,
    stamp,
  };
}
