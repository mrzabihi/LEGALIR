// ============================================================
// LEGALIR — /api/v1/property-contracts/verify/[publicVerificationId]
// ============================================================
// GET — the PUBLIC verification endpoint behind the QR code.
//
// This route is intentionally unauthenticated: anyone holding the
// printed contract can confirm it is genuine. It therefore returns
// ONLY the fields declared in `ContractVerificationInfo` — the
// reference code, type, version, hash, date, status and the parties'
// DISPLAY NAMES. National ids, addresses, mobile numbers and the
// contract body are never exposed here.
// ============================================================

import type { ContractVerificationInfo } from "@legalir/types";
import { notFound, ok } from "@/lib/contracts/api-helpers";
import { getContractByPublicId, getVersion, listParties } from "@/lib/contracts/db";
import { verificationStatusFa } from "@/lib/contracts/registration-policy";

type Params = { params: Promise<{ publicVerificationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { publicVerificationId } = await params;

  const contract = getContractByPublicId(publicVerificationId);
  if (!contract) return notFound("سندی با این شناسه یافت نشد");

  // Only a finalized contract has a verifiable document.
  const versionId = contract.finalVersionId ?? contract.currentVersionId;
  if (!versionId) return notFound("این قرارداد هنوز نهایی نشده است");
  const version = getVersion(contract.id, versionId);
  if (!version) return notFound("نسخه سند یافت نشد");

  const partyNames = listParties(contract.id)
    .map((p) => `${p.identity.firstName} ${p.identity.lastName}`.trim())
    .filter((n) => n.length > 0);

  const info: ContractVerificationInfo = {
    referenceCode: contract.referenceCode,
    typeFa: contract.typeFa,
    versionNumber: version.versionNumber,
    documentHash: version.documentHash,
    finalizedAt: contract.finalizedAt ?? version.createdAt,
    statusFa: verificationStatusFa(contract.type, contract.state),
    partyNames,
  };

  return ok(info);
}
