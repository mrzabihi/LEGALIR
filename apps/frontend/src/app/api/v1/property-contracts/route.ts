// ============================================================
// LEGALIR — /api/v1/property-contracts (collection)
// ============================================================
// GET  — list the session user's property contracts (filter + page)
// POST — create a new contract from a registered definition
//
// Authorization is enforced here: the list is scoped to the session
// user, and creation always stamps the session user as the owner.
// ============================================================

import { NextResponse } from "next/server";
import type {
  ContractParty,
  PropertyContract,
  PropertyContractCreateRequest,
  PropertyContractListResponse,
  PropertyContractListItem,
  PropertyKind,
} from "@legalir/types";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { recordActivity } from "@/lib/db";
import {
  buildReferenceCode,
  countContractsOfType,
  insertContract,
  listContractsForUser,
  upsertParty,
} from "@/lib/contracts/db";
import {
  findContractDefinition,
  isImplementedContractType,
  partyRoleLabelFa,
} from "@/lib/contracts/registry";
import { computeCompleteness } from "@/lib/contracts/completeness";
import { todayJalali } from "@/lib/contracts/dates";
import { audit, badRequest, ok, toListItem, unauthorized } from "@/lib/contracts/api-helpers";

const VALID_KINDS: PropertyKind[] = ["apartment", "house", "villa"];

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20)
  );
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const type = url.searchParams.get("type") ?? "";
  const state = url.searchParams.get("state") ?? "";

  let items: PropertyContractListItem[] = listContractsForUser(userId).map(toListItem);

  if (search) {
    items = items.filter(
      (c) =>
        c.title.toLowerCase().includes(search) ||
        c.referenceCode.toLowerCase().includes(search) ||
        c.partySummaryFa.toLowerCase().includes(search)
    );
  }
  if (type) items = items.filter((c) => c.type === type);
  if (state) items = items.filter((c) => c.state === state);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  const body: PropertyContractListResponse = {
    items: paged,
    pagination: { page, pageSize, total, totalPages },
  };
  return ok(body);
}

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return unauthorized();

  let body: Partial<PropertyContractCreateRequest>;
  try {
    body = (await request.json()) as Partial<PropertyContractCreateRequest>;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  const typeId = body.type;
  if (!typeId || !isImplementedContractType(typeId)) {
    return badRequest("نوع قرارداد پشتیبانی نمی‌شود", "UNSUPPORTED_TYPE");
  }

  const def = findContractDefinition(typeId);
  if (!def) return badRequest("نوع قرارداد پشتیبانی نمی‌شود", "UNSUPPORTED_TYPE");

  const propertyKind: PropertyKind =
    body.propertyKind && VALID_KINDS.includes(body.propertyKind) ? body.propertyKind : "apartment";

  const initiatorRole =
    body.initiatorRole && def.roles.includes(body.initiatorRole)
      ? body.initiatorRole
      : def.defaultInitiatorRole;

  const now = new Date().toISOString();
  const jy = todayJalali().jy;
  const sequence = countContractsOfType(typeId) + 1;
  const firstStep = def.wizardSteps[0]?.id ?? "parties";

  const contract: PropertyContract = {
    id: `cnt-${crypto.randomUUID()}`,
    referenceCode: buildReferenceCode(typeId, jy, sequence),
    userId,
    domain: def.domain,
    type: typeId,
    typeFa: def.typeFa,
    state: "DRAFT",
    initiatorRole,
    title: body.title?.trim() || def.typeFa,
    currentStep: firstStep,
    progress: 0,
    templateVersion: def.templateVersion,
    schemaVersion: def.schemaVersion,
    data: def.createDefaultData(propertyKind),
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    createdAt: now,
    updatedAt: now,
  };

  insertContract(contract);

  // Seed the initiator's party row so the wizard opens with their role
  // already present (identity fields still empty until they fill them).
  const initiatorParty: ContractParty = {
    id: `pty-${crypto.randomUUID()}`,
    contractId: contract.id,
    role: initiatorRole,
    capacity: "owner",
    identity: {
      firstName: "",
      lastName: "",
      fatherName: "",
      nationalId: "",
      birthCertificateNumber: "",
      birthCertificatePlace: "",
      birthDate: null,
      mobile: "",
      address: "",
      postalCode: "",
    },
    ownershipShare: null,
    powerOfAttorney: null,
    isInitiator: true,
    createdAt: now,
  };
  upsertParty(initiatorParty);

  const progress = computeCompleteness(contract, [initiatorParty], []).overall;
  const withProgress: PropertyContract = { ...contract, progress };

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: partyRoleLabelFa(initiatorRole),
    action: "contract.created",
    descriptionFa: `قرارداد «${contract.title}» ایجاد شد.`,
    metadata: { type: typeId, referenceCode: contract.referenceCode },
  });

  recordActivity({
    userId,
    type: "contract",
    title: contract.title,
    status: contract.state,
    statusFa: "پیش‌نویس",
    description: `ایجاد ${def.typeFa}`,
    category: def.categoryFa,
    categoryFa: def.categoryFa,
    sourceId: contract.id,
  });

  return NextResponse.json(
    {
      data: {
        id: withProgress.id,
        referenceCode: withProgress.referenceCode,
        type: withProgress.type,
        state: withProgress.state,
        currentStep: withProgress.currentStep,
        createdAt: withProgress.createdAt,
        progress: withProgress.progress,
      },
    },
    { status: 201 }
  );
}
