// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]
// ============================================================
// GET    — the full contract aggregate (parties, payments,
//          documents, versions, approvals, audit)
// PATCH  — autosave: title / currentStep / domain data / state
// DELETE — remove a draft the user owns
//
// Every handler resolves the contract through `requireContract`,
// which is owner-scoped: another user's id returns 404, never 403.
// ============================================================

import { NextResponse } from "next/server";
import type {
  ContractCompleteness,
  PropertyContract,
  PropertyContractDetail,
  PropertyContractUpdateRequest,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";

/** A contract detail plus the server-computed completeness. */
type ContractDetail = PropertyContractDetail & { completeness: ContractCompleteness };
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  notFound,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  deleteContractForUser,
  listApprovals,
  listAudit,
  listContractDocuments,
  listParties,
  listPayments,
  listVersions,
  mergeContractData,
  updateContractForUser,
} from "@/lib/contracts/db";
import { deleteContractFile } from "@/lib/contracts/storage";
import { removeActivity } from "@/lib/db";
import { computeCompleteness } from "@/lib/contracts/completeness";
import { assertTransition, IllegalTransitionError, isEditable } from "@/lib/contracts/state-machine";
import { getWizardStep } from "@/lib/contracts/registry";

type Params = { params: Promise<{ id: string }> };

/**
 * Assemble the full detail aggregate for a contract.
 *
 * Both GET and PATCH must return this exact shape: the client writes the
 * response straight into the detail cache, so a partial body (e.g. a bare
 * `{...contract, completeness}`) would leave `documents`/`parties`/… as
 * `undefined` in the cache and crash any consumer that reads them.
 */
function buildDetail(contract: PropertyContract): ContractDetail {
  const parties = listParties(contract.id);
  const documents = listContractDocuments(contract.id);
  return {
    ...contract,
    parties,
    payments: listPayments(contract.id),
    documents,
    versions: listVersions(contract.id),
    approvals: listApprovals(contract.id),
    auditLog: listAudit(contract.id),
    completeness: computeCompleteness(contract, parties, documents),
  };
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  return ok(buildDetail(ctx.contract));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  let body: PropertyContractUpdateRequest;
  try {
    body = (await request.json()) as PropertyContractUpdateRequest;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  // Content edits are only allowed while the contract is editable.
  const touchesContent = body.data !== undefined || body.title !== undefined;
  if (touchesContent && !isEditable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل ویرایش نیست.", "NOT_EDITABLE");
  }

  // A state change must be a declared transition.
  if (body.state && body.state !== contract.state) {
    try {
      assertTransition(contract.state, body.state);
    } catch (err) {
      if (err instanceof IllegalTransitionError) {
        return conflict(err.message, "ILLEGAL_TRANSITION");
      }
      throw err;
    }
  }

  // A step change must reference a real step for this contract type.
  if (body.currentStep && !getWizardStep(contract.type, body.currentStep)) {
    return badRequest("مرحله انتخاب‌شده معتبر نیست", "INVALID_STEP");
  }

  let updated = contract;
  if (body.data) {
    const merged = mergeContractData(
      userId,
      contract.id,
      body.data as Partial<PropertyRentData> | Partial<PropertySaleData>
    );
    if (!merged) return notFound();
    updated = merged;
  }

  const patch: Parameters<typeof updateContractForUser>[2] = {};
  if (body.title !== undefined) patch.title = body.title.trim() || contract.title;
  if (body.currentStep !== undefined) patch.currentStep = body.currentStep;
  if (body.state !== undefined) patch.state = body.state;

  if (Object.keys(patch).length > 0) {
    const next = updateContractForUser(userId, contract.id, patch);
    if (!next) return notFound();
    updated = next;
  }

  // Recompute progress from the real required fields after any edit.
  const parties = listParties(contract.id);
  const documents = listContractDocuments(contract.id);
  const completeness = computeCompleteness(updated, parties, documents);
  const withProgress = updateContractForUser(userId, contract.id, {
    progress: completeness.overall,
  });
  if (withProgress) updated = withProgress;

  if (body.state && body.state !== contract.state) {
    audit({
      contractId: contract.id,
      actorId: userId,
      actorLabel: "کاربر",
      action: "contract.state_changed",
      descriptionFa: `وضعیت قرارداد به «${body.state}» تغییر کرد.`,
      metadata: { from: contract.state, to: body.state },
    });
  }

  // Return the same full aggregate as GET — the client caches this response
  // verbatim, so a partial body would drop the related collections.
  return ok(buildDetail(updated));
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  // Only drafts may be deleted — a signed contract is a legal record.
  if (contract.state !== "DRAFT" && contract.state !== "CANCELLED") {
    return conflict("فقط پیش‌نویس‌ها قابل حذف هستند.", "NOT_DELETABLE");
  }

  // Capture the stored document keys before the rows are cascaded away,
  // so the bytes on disk can be unlinked too (no orphaned files).
  const storedKeys = listContractDocuments(contract.id).map((d) => d.storageKey);

  const removed = deleteContractForUser(userId, contract.id);
  if (!removed) return notFound();

  // Clean up resources that live outside the contract tables: the
  // mirrored activity row and the private document files.
  removeActivity(userId, contract.id);
  for (const key of storedKeys) deleteContractFile(key);

  return NextResponse.json({ data: { id: contract.id, deleted: true } });
}
