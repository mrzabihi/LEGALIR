// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/finalize
// ============================================================
// POST — finalize a fully signed contract.
//
// The gates and the freeze itself live in `lib/contracts/finalization`
// so the owner path and the admin's final approval share ONE
// implementation. This route only resolves the session + the HTTP
// envelope. See `finalizeSignedContract` for the three gates.
//
//   rent → FINALIZED
//   sale → READY_FOR_OFFICIAL_REGISTRATION
//
// A sale contract is NEVER marked as "ownership transferred". The
// policy layer owns that decision, not this route.
// ============================================================

import type { ContractFinalizeResponse } from "@legalir/types";
import {
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { getVersion } from "@/lib/contracts/db";
import { finalizeSignedContract } from "@/lib/contracts/finalization";
import { evaluateRegistrationPolicy } from "@/lib/contracts/registration-policy";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  const outcome = await finalizeSignedContract({
    contract,
    actorId: userId,
    actorLabel: "کاربر",
    baseUrl: new URL(request.url).origin,
  });

  if (!outcome.ok) return conflict(outcome.messageFa, outcome.code);

  const body: ContractFinalizeResponse = {
    id: outcome.contract.id,
    state: outcome.contract.state,
    finalVersionId: outcome.version.id,
    finalizedAt: outcome.finalizedAt,
    documentHash: outcome.version.documentHash,
    publicVerificationId: outcome.contract.publicVerificationId,
  };

  return ok({
    ...body,
    registration: outcome.registration,
    stamp: outcome.stamp,
    finalArtifact: outcome.artifact,
  });
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
