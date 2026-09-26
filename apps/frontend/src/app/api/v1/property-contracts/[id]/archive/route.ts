// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/archive
// ============================================================
// POST — archive a finalized or cancelled contract. Archiving is
// the only transition out of a terminal state; it never deletes the
// record, because a signed contract is a legal document.
// ============================================================

import {
  audit,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { updateContractForUser } from "@/lib/contracts/db";
import { assertTransition, IllegalTransitionError } from "@/lib/contracts/state-machine";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  try {
    assertTransition(contract.state, "ARCHIVED");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return conflict(err.message, "ILLEGAL_TRANSITION");
    throw err;
  }

  const updated = updateContractForUser(userId, contract.id, { state: "ARCHIVED" });
  if (!updated) return conflict("بایگانی ناموفق بود.", "ARCHIVE_FAILED");

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "contract.archived",
    descriptionFa: "قرارداد بایگانی شد.",
    metadata: { from: contract.state },
  });

  return ok(updated);
}
