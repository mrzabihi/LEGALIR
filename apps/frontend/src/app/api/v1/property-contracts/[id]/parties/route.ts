// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/parties
// ============================================================
// GET — the parties of a contract the session user owns.
// PUT — upsert one party by role (one party per role).
//
// The role must belong to the contract type's declared roles, so a
// caller cannot invent a role the template engine does not know.
// ============================================================

import type { ContractParty, PartyCapacity, PartyRole } from "@legalir/types";
import {
  audit,
  badRequest,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { listParties, upsertParty } from "@/lib/contracts/db";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import { isEditable } from "@/lib/contracts/state-machine";

type Params = { params: Promise<{ id: string }> };

const CAPACITIES: PartyCapacity[] = ["owner", "attorney", "legal_representative"];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;
  return ok(listParties(ctx.contract.id));
}

interface PartyBody {
  role?: PartyRole;
  capacity?: PartyCapacity;
  identity?: Partial<ContractParty["identity"]>;
  ownershipShare?: ContractParty["ownershipShare"];
  powerOfAttorney?: ContractParty["powerOfAttorney"];
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  if (!isEditable(contract.state)) {
    return badRequest("این قرارداد در وضعیت فعلی قابل ویرایش نیست.", "NOT_EDITABLE");
  }

  let body: PartyBody;
  try {
    body = (await request.json()) as PartyBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  const def = getContractDefinition(contract.type);
  if (!body.role || !def.roles.includes(body.role)) {
    return badRequest("نقش انتخاب‌شده برای این قرارداد معتبر نیست", "INVALID_ROLE");
  }

  const capacity: PartyCapacity =
    body.capacity && CAPACITIES.includes(body.capacity) ? body.capacity : "owner";

  const existing = listParties(contract.id).find((p) => p.role === body.role);
  const identity = body.identity ?? {};

  const party: ContractParty = {
    id: existing?.id ?? `pty-${crypto.randomUUID()}`,
    contractId: contract.id,
    role: body.role,
    capacity,
    identity: {
      firstName: identity.firstName ?? existing?.identity.firstName ?? "",
      lastName: identity.lastName ?? existing?.identity.lastName ?? "",
      fatherName: identity.fatherName ?? existing?.identity.fatherName ?? "",
      nationalId: identity.nationalId ?? existing?.identity.nationalId ?? "",
      birthCertificateNumber:
        identity.birthCertificateNumber ?? existing?.identity.birthCertificateNumber ?? "",
      birthCertificatePlace:
        identity.birthCertificatePlace ?? existing?.identity.birthCertificatePlace ?? "",
      birthDate: identity.birthDate ?? existing?.identity.birthDate ?? null,
      mobile: identity.mobile ?? existing?.identity.mobile ?? "",
      address: identity.address ?? existing?.identity.address ?? "",
      postalCode: identity.postalCode ?? existing?.identity.postalCode ?? "",
    },
    ownershipShare:
      body.ownershipShare !== undefined ? body.ownershipShare : existing?.ownershipShare ?? null,
    powerOfAttorney:
      body.powerOfAttorney !== undefined
        ? body.powerOfAttorney
        : existing?.powerOfAttorney ?? null,
    isInitiator: existing?.isInitiator ?? body.role === contract.initiatorRole,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  const saved = upsertParty(party);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: partyRoleLabelFa(body.role),
    action: existing ? "party.updated" : "party.added",
    descriptionFa: `اطلاعات ${partyRoleLabelFa(body.role)} ذخیره شد.`,
    metadata: { role: body.role },
  });

  return ok(saved);
}
