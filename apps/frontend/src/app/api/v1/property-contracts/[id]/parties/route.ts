// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/parties
// ============================================================
// GET — the parties of a contract the session user owns.
// PUT — upsert one party by role (one party per role).
//
// The role must belong to the contract type's declared roles, so a
// caller cannot invent a role the template engine does not know.
// ============================================================

import type {
  ContractParty,
  PartyCapacity,
  PartyNationality,
  PartyPersonKind,
  PartyRole,
} from "@legalir/types";
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
import {
  normalizeIranMobile,
  validateBanking,
  validatePartyIdentity,
} from "@legalir/validation";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ id: string }>;
}

const CAPACITIES: PartyCapacity[] = ["owner", "attorney", "legal_representative"];
const PERSON_KINDS: PartyPersonKind[] = ["natural", "legal"];
const NATIONALITIES: PartyNationality[] = ["iranian", "foreign"];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;
  return ok(listParties(ctx.contract.id));
}

interface PartyBody {
  /** Existing party id — the stable key the form/preview/signature bind to. */
  id?: string;
  role?: PartyRole;
  capacity?: PartyCapacity;
  personKind?: PartyPersonKind;
  nationality?: PartyNationality;
  identity?: Partial<ContractParty["identity"]>;
  banking?: ContractParty["banking"];
  /** Set only on a legal entity's authorized representative row. */
  representativeOfPartyId?: string | null;
  representativePositionFa?: string;
  ownershipShare?: ContractParty["ownershipShare"];
  powerOfAttorney?: ContractParty["powerOfAttorney"];
  /**
   * When true, incomplete branch data is rejected with per-field issues
   * (used when the user advances a step). A plain save persists the
   * intermediate state so nothing typed is ever lost.
   */
  requireComplete?: boolean;
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
  const all = listParties(contract.id);

  // A legal entity's authorized representative is a SEPARATE person row.
  // It is not part of `def.roles` (which describes the deal sides), so it
  // is authorized here only when it points at an existing legal entity of
  // this same contract.
  const isRepresentative = body.role === "legal_representative";
  if (!body.role) {
    return badRequest("نقش انتخاب‌شده برای این قرارداد معتبر نیست", "INVALID_ROLE");
  }
  if (!isRepresentative && !def.roles.includes(body.role)) {
    return badRequest("نقش انتخاب‌شده برای این قرارداد معتبر نیست", "INVALID_ROLE");
  }

  let existing = isRepresentative
    ? all.find(
        (p) =>
          p.role === "legal_representative" &&
          !!body.id &&
          p.id === body.id
      ) ??
      all.find(
        (p) =>
          p.role === "legal_representative" &&
          !!body.representativeOfPartyId &&
          p.representativeOfPartyId === body.representativeOfPartyId
      )
    : body.id
      ? all.find((p) => p.id === body.id && p.role === body.role)
      : all.find((p) => p.role === body.role);

  if (isRepresentative) {
    const entity = all.find((p) => p.id === body.representativeOfPartyId);
    if (!entity || entity.personKind !== "legal" || entity.role === "legal_representative") {
      return badRequest(
        "نمایندهٔ قانونی باید به یک شخص حقوقی همین قرارداد متصل باشد",
        "INVALID_REPRESENTATIVE"
      );
    }
    if (!body.representativePositionFa?.trim()) {
      return badRequest("سمت نمایندهٔ قانونی الزامی است", "REPRESENTATIVE_POSITION_REQUIRED");
    }
  }

  const capacity: PartyCapacity =
    body.capacity && CAPACITIES.includes(body.capacity) ? body.capacity : "owner";

  const personKind: PartyPersonKind =
    body.personKind && PERSON_KINDS.includes(body.personKind)
      ? body.personKind
      : existing?.personKind ?? "natural";
  const nationality: PartyNationality =
    body.nationality && NATIONALITIES.includes(body.nationality)
      ? body.nationality
      : existing?.nationality ?? "iranian";
  if (isRepresentative && personKind !== "natural") {
    return badRequest("نمایندهٔ قانونی یک شخص حقیقی است", "INVALID_REPRESENTATIVE_KIND");
  }

  // Switching the branch (natural↔legal, Iranian↔foreign) starts the
  // identity from a clean slate so fields that belong to the abandoned
  // branch can never leak into the saved person.
  const branchChanged =
    !!existing && (existing.personKind !== personKind || existing.nationality !== nationality);
  const base = branchChanged ? undefined : existing;
  const identity = body.identity ?? {};

  // Normalize the contact mobile to canonical E.164 when present. This is
  // a contact field, not an identity key, so it is normalized but never
  // uniqueness-constrained. An invalid value is rejected rather than stored.
  const rawMobile = identity.mobile ?? base?.identity.mobile ?? "";
  let mobile = "";
  if (rawMobile.trim()) {
    const normalized = normalizeIranMobile(rawMobile);
    if (!normalized) {
      return badRequest("شماره موبایل معتبر وارد کنید؛ مانند 09123456789", "INVALID_MOBILE");
    }
    mobile = normalized;
  }

  const mergedIdentity: ContractParty["identity"] = {
    firstName: identity.firstName ?? base?.identity.firstName ?? "",
    lastName: identity.lastName ?? base?.identity.lastName ?? "",
    fatherName: identity.fatherName ?? base?.identity.fatherName ?? "",
    nationalId: identity.nationalId ?? base?.identity.nationalId ?? "",
    birthCertificateNumber:
      identity.birthCertificateNumber ?? base?.identity.birthCertificateNumber ?? "",
    birthCertificatePlace:
      identity.birthCertificatePlace ?? base?.identity.birthCertificatePlace ?? "",
    birthDate: identity.birthDate ?? base?.identity.birthDate ?? null,
    mobile,
    address: identity.address ?? base?.identity.address ?? "",
    postalCode: identity.postalCode ?? base?.identity.postalCode ?? "",
    companyName: identity.companyName ?? base?.identity.companyName ?? "",
    companyRegistrationNumber:
      identity.companyRegistrationNumber ?? base?.identity.companyRegistrationNumber ?? "",
    companyNationalId: identity.companyNationalId ?? base?.identity.companyNationalId ?? "",
    economicCode: identity.economicCode ?? base?.identity.economicCode ?? "",
    nationalityCountryFa:
      identity.nationalityCountryFa ?? base?.identity.nationalityCountryFa ?? "",
    passportNumber: identity.passportNumber ?? base?.identity.passportNumber ?? "",
    passportExpiry: identity.passportExpiry ?? base?.identity.passportExpiry ?? null,
    birthPlace: identity.birthPlace ?? base?.identity.birthPlace ?? "",
    birthDateGregorian:
      identity.birthDateGregorian ?? base?.identity.birthDateGregorian ?? null,
    workPermitNumber: identity.workPermitNumber ?? base?.identity.workPermitNumber ?? "",
    workPermitExpiry: identity.workPermitExpiry ?? base?.identity.workPermitExpiry ?? null,
  };

  const normalizeDigits = (v: string | undefined | null): string =>
    (v ?? "")
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/\D/g, "");

  const rawBanking = body.banking !== undefined ? body.banking : base?.banking ?? null;
  const mergedBanking = rawBanking
    ? {
        bankName: rawBanking.bankName?.trim() ?? "",
        accountNumber: normalizeDigits(rawBanking.accountNumber),
        iban: (rawBanking.iban ?? "").replace(/\s/g, "").toUpperCase(),
        cardNumber: normalizeDigits(rawBanking.cardNumber),
      }
    : null;

  // Strict saves are the step-advance gate: every branch field must be
  // valid and the Persian message is attached to the exact input.
  if (body.requireComplete) {
    const issues = [
      ...validatePartyIdentity({ personKind, nationality, identity: mergedIdentity }),
      ...(mergedBanking ? validateBanking(mergedBanking) : []),
    ];
    if (issues.length > 0) {
      return NextResponse.json(
        {
          code: "VALIDATION_FAILED",
          message: issues[0]!.messageFa,
          retryable: false,
          fieldErrors: issues.map((i) => ({ path: i.field, reason: i.messageFa })),
        },
        { status: 400 }
      );
    }
  }

  const party: ContractParty = {
    id: existing?.id ?? `pty-${crypto.randomUUID()}`,
    contractId: contract.id,
    role: body.role,
    capacity: isRepresentative ? "legal_representative" : capacity,
    personKind,
    nationality,
    representativeOfPartyId: isRepresentative ? body.representativeOfPartyId ?? null : null,
    representativePositionFa: isRepresentative
      ? body.representativePositionFa?.trim() ?? ""
      : "",
    identity: mergedIdentity,
    banking: mergedBanking,
    ownershipShare:
      body.ownershipShare !== undefined ? body.ownershipShare : base?.ownershipShare ?? null,
    powerOfAttorney:
      body.powerOfAttorney !== undefined ? body.powerOfAttorney : base?.powerOfAttorney ?? null,
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
    metadata: { role: body.role, personKind, nationality },
  });

  return ok(saved);
}
