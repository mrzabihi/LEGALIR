// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/versions
// ============================================================
// GET  — the immutable version history (newest first).
// POST — snapshot the current working state as a new version.
//
// Snapshotting is the moment content is frozen: every approval tied
// to an older version is invalidated, so no approval can survive a
// content change.
// ============================================================

import {
  audit,
  badRequest,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { listVersions } from "@/lib/contracts/db";
import { createVersion } from "@/lib/contracts/snapshot";
import { isEditable } from "@/lib/contracts/state-machine";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;
  return ok(listVersions(ctx.contract.id));
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  if (!isEditable(contract.state)) {
    return badRequest("در وضعیت فعلی امکان ایجاد نسخه جدید نیست.", "NOT_EDITABLE");
  }

  const { version, invalidatedApprovals } = createVersion(contract, userId);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "version.created",
    descriptionFa: `نسخه ${version.versionNumber} قرارداد ثبت شد.`,
    metadata: {
      versionId: version.id,
      versionNumber: version.versionNumber,
      documentHash: version.documentHash,
      invalidatedApprovals,
    },
  });

  return ok({ version, invalidatedApprovals }, 201);
}
