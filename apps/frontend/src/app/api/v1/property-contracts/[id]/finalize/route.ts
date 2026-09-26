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

import type { ContractFinalizeResponse } from "@legalir/types";
import {
  audit,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { getVersion, listApprovals, listParties, updateContractForUser } from "@/lib/contracts/db";
import { createVersion } from "@/lib/contracts/snapshot";
import { assertTransition, IllegalTransitionError } from "@/lib/contracts/state-machine";
import { evaluateRegistrationPolicy } from "@/lib/contracts/registration-policy";

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
