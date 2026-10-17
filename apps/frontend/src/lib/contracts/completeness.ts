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
import { validateBanking, validatePartyIdentity } from "@legalir/validation";
import {
  fieldConditionHolds,
  getContractDefinition,
  partyRoleLabelFa,
  type ContractSectionDefinition,
} from "./registry";

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
  banking: "اطلاعات بانکی دریافت‌کننده",
};

/**
 * The Persian label for a required path. Property paths are looked up
 * in the static map; schema-driven paths (`values.<key>`) resolve to
 * the field descriptor's own label, so a new contract type needs no
 * entry here.
 */
function pathLabelFa(contract: PropertyContract, path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  if (path.startsWith("banking.")) {
    const role = path.slice("banking.".length);
    return `${PATH_LABELS["banking"]} (${partyRoleLabelFa(role as ContractParty["role"])})`;
  }
  if (path.startsWith("values.")) {
    const key = path.slice("values.".length);
    const field = getContractDefinition(contract.type).fields.find((f) => f.key === key);
    if (field) return field.labelFa;
  }
  return path;
}

/**
 * The identity requirements for a party depend on the branch the user
 * actually chose — an Iranian natural person needs a national id, a
 * foreign natural person needs a passport, a legal entity needs its
 * registration. The shared validator is the same one the form and the
 * server route use, so "complete" means the same everywhere.
 */
function partyIdentityComplete(party: ContractParty): boolean {
  return (
    validatePartyIdentity({
      personKind: party.personKind ?? "natural",
      nationality: party.nationality ?? "iranian",
      identity: party.identity,
    }).length === 0
  );
}

/** Resolve a dotted path against the contract aggregate. */
function resolvePath(
  contract: PropertyContract,
  parties: ContractParty[],
  documents: ContractDocument[],
  path: string
): unknown {
  if (path === "parties") return parties;
  if (path === "documents") return documents;
  // `banking.<role>` resolves against the party record. The value is a
  // boolean "is valid" — the bank details themselves are never copied
  // into domain data.
  if (path.startsWith("banking.")) {
    const role = path.slice("banking.".length);
    const party = parties.find((p) => p.role === role);
    if (!party?.banking) return false;
    return validateBanking(party.banking).length === 0;
  }
  // Schema-driven types store their values in a flat `values` map, so
  // `values.<key>` resolves one level into `contract.data`.
  if (path.startsWith("values.")) {
    const key = path.slice("values.".length);
    const values = (contract.data as { values?: Record<string, unknown> }).values;
    return values ? values[key] : undefined;
  }
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
  // A list is only an answer when at least one entry has content. A row
  // the form added but the user has not typed into yet is a scaffold, not
  // a completed schedule — the same rule the renderer applies when it
  // drops blank rows from the printed table.
  if (Array.isArray(value)) return value.some((entry) => isFilled(entry));
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
  const sides = def.roles.every((role) => {
    const party = parties.find((p) => p.role === role);
    if (!party) return false;
    if (!partyIdentityComplete(party)) return false;
    // A legal entity also needs its authorized representative recorded as
    // a separate person, linked back to the entity.
    if (party.personKind === "legal") {
      const rep = parties.find(
        (p) => p.role === "legal_representative" && p.representativeOfPartyId === party.id
      );
      if (!rep) return false;
      if (!rep.representativePositionFa.trim()) return false;
      return partyIdentityComplete(rep);
    }
    return true;
  });
  return sides;
}

/** True when every required document category has at least one upload. */
function documentsComplete(contract: PropertyContract, documents: ContractDocument[]): boolean {
  const def = getContractDefinition(contract.type);
  return def.requiredDocuments
    .filter((d) => d.required)
    .every((d) => documents.some((doc) => doc.category === d.category));
}

/** The flat value map of a schema-driven contract. */
function genericValues(contract: PropertyContract): Record<string, unknown> {
  const values = (contract.data as { values?: Record<string, unknown> }).values;
  return values ?? {};
}

/** Score a single section. */
function scoreSection(
  contract: PropertyContract,
  parties: ContractParty[],
  documents: ContractDocument[],
  section: ContractSectionDefinition
): ContractCompletenessSection {
  const missing: string[] = [];
  const values = genericValues(contract);
  const fields = getContractDefinition(contract.type).fields;

  // Drop conditionally-required fields whose branch was not chosen, so an
  // irrelevant field never holds back a section that is complete for the
  // path the user actually took.
  const applicablePaths = section.requiredPaths.filter((path) => {
    if (!path.startsWith("values.")) return true;
    const key = path.slice("values.".length);
    const descriptor = fields.find((f) => f.key === key);
    if (!descriptor?.requiredWhen) return true;
    return fieldConditionHolds(values, descriptor.requiredWhen);
  });

  for (const path of applicablePaths) {
    if (path === "parties") {
      if (!partiesComplete(contract, parties)) missing.push(PATH_LABELS["parties"] ?? "طرفین قرارداد");
      continue;
    }
    if (path === "documents") {
      if (!documentsComplete(contract, documents)) missing.push(PATH_LABELS["documents"] ?? "مدارک");
      continue;
    }
    // `banking.<role>` resolves to a boolean ASSERTION (are these details
    // valid?), not a value. `isFilled` deliberately treats every boolean
    // as filled — that is right for toggles and wrong here, where `false`
    // must count as missing.
    if (path.startsWith("banking.")) {
      if (resolvePath(contract, parties, documents, path) !== true) {
        missing.push(pathLabelFa(contract, path));
      }
      continue;
    }
    const value = resolvePath(contract, parties, documents, path);
    if (!isFilled(value)) missing.push(pathLabelFa(contract, path));
  }

  const total = applicablePaths.length;
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
