// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/lifecycle
// ============================================================
// GET — the whole lifecycle view in one call: the derived stage, the
// stepper, the registration status, the active signature request, the
// active lawyer review, the latest AI review, the review comments and
// the three "can I do X right now?" booleans.
//
// The workspace renders from this single payload so the UI can never
// disagree with the server about what is possible.
// ============================================================

import { isErrorResponse, ok, requireContract } from "@/lib/contracts/api-helpers";
import { listContractDocuments, listParties } from "@/lib/contracts/db";
import { computeCompleteness } from "@/lib/contracts/completeness";
import { buildLifecycleView } from "@/lib/contracts/lifecycle-view";
import { contractFeatureFlags } from "@/lib/contracts/feature-flags";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { contract } = ctx;
  const completeness = computeCompleteness(
    contract,
    listParties(contract.id),
    listContractDocuments(contract.id)
  );

  const view = buildLifecycleView(contract, completeness);

  // A disabled capability removes the option, never the permission —
  // the server still authorizes every action independently.
  const flags = contractFeatureFlags();
  if (!flags.CONTRACT_SIGNING_ENABLED) {
    view.canPrepareForSignature = false;
    view.canSign = false;
  }
  if (!flags.LAWYER_REVIEW_ENABLED) {
    view.lawyerReview = null;
  }
  if (!flags.AI_CONTRACT_REVIEW_ENABLED) {
    view.aiReview = null;
  }

  return ok({ ...view, flags });
}
