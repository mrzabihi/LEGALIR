// ============================================================
// LEGALIR — Contract completeness scorer
// ============================================================
// Progress is computed from the REAL required fields declared by the
// contract definition's sections — never from "how many wizard steps
// did the user click through". A step can be visited and still be
// incomplete; a section can be complete without ever being visited.
//
// The scorer is pure: it takes the contract aggregate and returns a
// `ContractCompleteness` with per-section percentages, the missing
// field labels, and the blocking issues that prevent signing.
// ============================================================

import type {
  ContractCompleteness,
  ContractCompletenessSection,
  ContractDocument,
  ContractParty,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { getContractDefinition, type ContractSectionDefinition } from "./registry";

/** Persian labels for the dotted paths used in section definitions. */
const PATH_LABELS: Record<string, string> = {
  "data.address.province": "استان",
  "data.address.city": "شهر",
  "data.address.street": "خیابان",
  "data.general.area": "متراژ",
  "data.propertyKind": "نوع ملک",
  "data.deed.deedType": "نوع سند",
  "data.deed.ownerName": "نام مالک در سند",
  "data.legalStatus.inMortgage": "وضعیت رهن",
  "data.legalStatus.seized": "وضعیت بازداشت",
  "data.legalStatus.hasLoan": "وضعیت وام",
  "data.legalStatus.occupiedByTenant": "وضعیت تصرف مستأجر",
  "data.terms.agreementKind": "نوع توافق",
  "data.terms.totalPrice": "ثمن معامله",
  "data.durations.startDate": "تاریخ شروع اجاره",
  "data.durations.endDate": "تاریخ پایان اجاره",
  "data.costs.water": "پرداخت‌کننده آب",
  "data.usageRules.residentialOnly": "کاربری مسکونی",
  "data.registration.agreedDate": "تاریخ حضور در دفترخانه",
  "data.registration.notaryCity": "شهر دفترخانه",
  "data.obligations.priorDebtsBearer": "مسئول بدهی‌های قبلی",
  "data.handover.items": "وضعیت تحویل ملک",
  parties: "طرفین قرارداد",
  documents: "مدارک",
};

/** Required identity fields for a party to count as complete. */
const REQUIRED_IDENTITY_FIELDS = [
  "firstName",
  "lastName",
  "nationalId",
  "mobile",
] as const;

/** Resolve a dotted path against the contract aggregate. */
function resolvePath(
  contract: PropertyContract,
  parties: ContractParty[],
  documents: ContractDocument[],
  path: string
): unknown {
  if (path === "parties") return parties;
  if (path === "documents") return documents;
  if (!path.startsWith("data.")) return undefined;

  const segments = path.slice("data.".length).split(".");
  let cursor: unknown = contract.data;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** True when a resolved value counts as "filled in". */
function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    // A Money value is filled when its amount is non-zero.
    const maybeMoney = value as { amount?: unknown; currency?: unknown };
    if (typeof maybeMoney.amount === "number" && maybeMoney.currency === "IRR") {
      return maybeMoney.amount > 0;
    }
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
}

/** True when the parties section is satisfied for this contract type. */
function partiesComplete(contract: PropertyContract, parties: ContractParty[]): boolean {
  const def = getContractDefinition(contract.type);
  return def.roles.every((role) => {
    const party = parties.find((p) => p.role === role);
    if (!party) return false;
    return REQUIRED_IDENTITY_FIELDS.every((field) => {
      const v = party.identity[field];
      return typeof v === "string" && v.trim().length > 0;
    });
  });
}

/** True when every required document category has at least one upload. */
function documentsComplete(contract: PropertyContract, documents: ContractDocument[]): boolean {
  const def = getContractDefinition(contract.type);
  return def.requiredDocuments
    .filter((d) => d.required)
    .every((d) => documents.some((doc) => doc.category === d.category));
}

/** Score a single section. */
function scoreSection(
  contract: PropertyContract,
  parties: ContractParty[],
  documents: ContractDocument[],
  section: ContractSectionDefinition
): ContractCompletenessSection {
  const missing: string[] = [];

  for (const path of section.requiredPaths) {
    if (path === "parties") {
      if (!partiesComplete(contract, parties)) missing.push(PATH_LABELS["parties"] ?? "طرفین قرارداد");
      continue;
    }
    if (path === "documents") {
      if (!documentsComplete(contract, documents)) missing.push(PATH_LABELS["documents"] ?? "مدارک");
      continue;
    }
    const value = resolvePath(contract, parties, documents, path);
    if (!isFilled(value)) missing.push(PATH_LABELS[path] ?? path);
  }

  const total = section.requiredPaths.length;
  const percent = total === 0 ? 100 : Math.round(((total - missing.length) / total) * 100);

  return {
    key: section.key,
    labelFa: section.labelFa,
    percent,
    missing,
  };
}

/**
 * Compute the completeness of a contract from its real required
 * fields. `overall` is the mean of the section percentages, so a
 * contract with one empty section cannot read as 100%.
 */
export function computeCompleteness(
  contract: PropertyContract,
  parties: ContractParty[],
  documents: ContractDocument[]
): ContractCompleteness {
  const def = getContractDefinition(contract.type);
  const sections = def.sections.map((s) => scoreSection(contract, parties, documents, s));

  const overall =
    sections.length === 0
      ? 0
      : Math.round(sections.reduce((acc, s) => acc + s.percent, 0) / sections.length);

  const blockers = sections
    .filter((s) => s.percent < 100)
    .map((s) => {
      const sectionDef = def.sections.find((d) => d.key === s.key)!;
      return {
        sectionKey: s.key,
        labelFa: s.labelFa,
        stepId: sectionDef.stepId,
      };
    });

  return { overall, sections, blockers };
}

/** True when every section is complete and the contract may be signed. */
export function isReadyForReview(completeness: ContractCompleteness): boolean {
  return completeness.blockers.length === 0;
}

/** The first incomplete step id, used to resume the wizard. */
export function firstIncompleteStepId(completeness: ContractCompleteness): string | null {
  return completeness.blockers[0]?.stepId ?? null;
}

/** Narrow the domain data to rent or sale for callers that know the type. */
export function asRentData(data: PropertyRentData | PropertySaleData): PropertyRentData {
  return data as PropertyRentData;
}

export function asSaleData(data: PropertyRentData | PropertySaleData): PropertySaleData {
  return data as PropertySaleData;
}
