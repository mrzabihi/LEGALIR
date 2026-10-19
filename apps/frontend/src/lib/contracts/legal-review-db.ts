// ============================================================
// LEGALIR — Per-type legal review store (§7)
// ============================================================
// The DB-backed, versioned source of:
//
//   contract-legal-clause-records   one reviewed citation per row
//   contract-pre-sign-tips          «قبل از امضا بدانید» tips per type
//
// The in-code catalog in `legal-basis.ts` is the SEED. A stored record
// always wins over it, clause by clause — so a legal reviewer can correct
// a provision, set a source, or flag a clause for revision without a
// deploy, and every contract of that type immediately reads the corrected
// record.
//
// Rules this module enforces:
//   • a clause with at least one stored record takes ONLY the stored
//     records (the reviewer's judgment replaces the seed for that clause);
//   • a clause with no stored record falls back to the seed, and a clause
//     with neither is FLAGGED for legal review — never invented;
//   • every save bumps `contentVersion` and stamps `reviewedAt`, so the
//     admin report and the printed annex can name the exact content
//     version a citation came from.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractLegalCitationStatus,
  ContractLegalClauseRecord,
  ContractPreSignTip,
  ContractTypeId,
  GenericContractData,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import {
  LEGAL_BASIS_SEED,
  PRE_SIGN_TIPS_SEED,
  buildLegalBasisReport,
  seedPreSignTips,
  type LegalBasisCatalog,
} from "./legal-basis";
import { getContractDefinition } from "./registry";
import { renderContract, type RenderedContract } from "./template";

const T_CLAUSE_RECORDS = "contract-legal-clause-records";
const T_PRE_SIGN_TIPS = "contract-pre-sign-tips";

// ------------------------------------------------------------
// Clause records
// ------------------------------------------------------------

/** All stored clause records, optionally filtered to one type. */
export function listLegalClauseRecords(typeId?: ContractTypeId): ContractLegalClauseRecord[] {
  const rows = readTable<ContractLegalClauseRecord>(T_CLAUSE_RECORDS);
  return (typeId ? rows.filter((r) => r.contractType === typeId) : rows).sort((a, b) => {
    if (a.contractType !== b.contractType) return a.contractType.localeCompare(b.contractType);
    if (a.clauseId !== b.clauseId) return a.clauseId.localeCompare(b.clauseId);
    return a.articleFa.localeCompare(b.articleFa);
  });
}

export function getLegalClauseRecord(id: string): ContractLegalClauseRecord | null {
  return readTable<ContractLegalClauseRecord>(T_CLAUSE_RECORDS).find((r) => r.id === id) ?? null;
}

export interface UpsertLegalClauseRecordInput {
  contractType: ContractTypeId;
  clauseId: string;
  sourceNameFa: string;
  lawSourceId: string | null;
  articleFa: string;
  noteFa: string;
  status: ContractLegalCitationStatus;
  reviewedBy: string;
  reviewedByLabelFa: string | null;
}

/**
 * Create a citation record, or revise the existing row for the same
 * (type, clause, article). A revision ALWAYS increments `contentVersion`
 * and re-stamps `reviewedAt`, so a reader can tell two revisions apart and
 * the audit trail can point at the exact version that changed.
 */
export function upsertLegalClauseRecord(
  input: UpsertLegalClauseRecordInput
): { record: ContractLegalClauseRecord; previous: ContractLegalClauseRecord | null } {
  const rows = readTable<ContractLegalClauseRecord>(T_CLAUSE_RECORDS);
  const now = new Date().toISOString();
  const index = rows.findIndex(
    (r) =>
      r.contractType === input.contractType &&
      r.clauseId === input.clauseId &&
      r.articleFa === input.articleFa
  );

  if (index >= 0) {
    const previous = rows[index]!;
    const record: ContractLegalClauseRecord = {
      ...previous,
      sourceNameFa: input.sourceNameFa,
      lawSourceId: input.lawSourceId,
      noteFa: input.noteFa,
      status: input.status,
      contentVersion: previous.contentVersion + 1,
      reviewedAt: now,
      reviewedBy: input.reviewedBy,
      reviewedByLabelFa: input.reviewedByLabelFa,
      updatedAt: now,
    };
    rows[index] = record;
    writeTable(T_CLAUSE_RECORDS, rows);
    return { record, previous };
  }

  const record: ContractLegalClauseRecord = {
    id: `lcr-${crypto.randomUUID()}`,
    contractType: input.contractType,
    clauseId: input.clauseId,
    sourceNameFa: input.sourceNameFa,
    lawSourceId: input.lawSourceId,
    articleFa: input.articleFa,
    noteFa: input.noteFa,
    contentVersion: 1,
    status: input.status,
    reviewedAt: now,
    reviewedBy: input.reviewedBy,
    reviewedByLabelFa: input.reviewedByLabelFa,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(record);
  writeTable(T_CLAUSE_RECORDS, rows);
  return { record, previous: null };
}

export function deleteLegalClauseRecord(id: string): ContractLegalClauseRecord | null {
  const rows = readTable<ContractLegalClauseRecord>(T_CLAUSE_RECORDS);
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeTable(T_CLAUSE_RECORDS, rows);
  return removed ?? null;
}

// ------------------------------------------------------------
// Pre-sign tips
// ------------------------------------------------------------

/** Stored tip rows for a type, in display order. Empty = seed applies. */
export function listPreSignTipRecords(typeId?: ContractTypeId): ContractPreSignTip[] {
  const rows = readTable<ContractPreSignTip>(T_PRE_SIGN_TIPS);
  return (typeId ? rows.filter((r) => r.contractType === typeId) : rows).sort((a, b) => {
    if (a.contractType !== b.contractType) return a.contractType.localeCompare(b.contractType);
    return a.order - b.order;
  });
}

/**
 * The tips a type actually shows/prints: stored rows when a reviewer has
 * saved any, otherwise the seed. The two are never mixed — otherwise a
 * half-edited list would silently resurrect a deleted seed tip.
 */
export function preSignTipsForType(typeId: ContractTypeId): ContractPreSignTip[] {
  const stored = listPreSignTipRecords(typeId);
  return stored.length > 0 ? stored : seedPreSignTips(typeId);
}

export interface UpsertPreSignTipInput {
  /** When set, revise this row; otherwise create a new tip. */
  id?: string | null;
  contractType: ContractTypeId;
  titleFa: string;
  bodyFa: string;
  sourceNameFa: string;
  order: number;
  status: ContractLegalCitationStatus;
  reviewedBy: string;
  reviewedByLabelFa: string | null;
}

export function upsertPreSignTip(
  input: UpsertPreSignTipInput
): { tip: ContractPreSignTip; previous: ContractPreSignTip | null } {
  const rows = readTable<ContractPreSignTip>(T_PRE_SIGN_TIPS);
  const now = new Date().toISOString();

  if (input.id) {
    const index = rows.findIndex((r) => r.id === input.id);
    if (index >= 0) {
      const previous = rows[index]!;
      const tip: ContractPreSignTip = {
        ...previous,
        titleFa: input.titleFa,
        bodyFa: input.bodyFa,
        sourceNameFa: input.sourceNameFa,
        order: input.order,
        status: input.status,
        contentVersion: previous.contentVersion + 1,
        reviewedAt: now,
        reviewedBy: input.reviewedBy,
        reviewedByLabelFa: input.reviewedByLabelFa,
        updatedAt: now,
      };
      rows[index] = tip;
      writeTable(T_PRE_SIGN_TIPS, rows);
      return { tip, previous };
    }
  }

  const tip: ContractPreSignTip = {
    id: `tip-${crypto.randomUUID()}`,
    contractType: input.contractType,
    titleFa: input.titleFa,
    bodyFa: input.bodyFa,
    sourceNameFa: input.sourceNameFa,
    order: input.order,
    contentVersion: 1,
    status: input.status,
    reviewedAt: now,
    reviewedBy: input.reviewedBy,
    reviewedByLabelFa: input.reviewedByLabelFa,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(tip);
  writeTable(T_PRE_SIGN_TIPS, rows);
  return { tip, previous: null };
}

export function deletePreSignTip(id: string): ContractPreSignTip | null {
  const rows = readTable<ContractPreSignTip>(T_PRE_SIGN_TIPS);
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeTable(T_PRE_SIGN_TIPS, rows);
  return removed ?? null;
}

// ------------------------------------------------------------
// The merged, runtime catalog
// ------------------------------------------------------------

/**
 * The seed catalog with stored records applied: for any (type, clause) that
 * has at least one stored row, the stored rows replace the seed entirely.
 * Types/clauses with no stored row keep their seeded citations.
 */
export function mergedLegalBasisCatalog(): LegalBasisCatalog {
  const catalog: LegalBasisCatalog = {};
  for (const [typeId, clauses] of Object.entries(LEGAL_BASIS_SEED)) {
    if (!clauses) continue;
    catalog[typeId as ContractTypeId] = Object.fromEntries(
      Object.entries(clauses).map(([clauseId, entries]) => [
        clauseId,
        entries.map((e) => ({ ...e })),
      ])
    );
  }

  const byTypeClause = new Map<string, ContractLegalClauseRecord[]>();
  for (const record of listLegalClauseRecords()) {
    const key = `${record.contractType}\u0000${record.clauseId}`;
    const list = byTypeClause.get(key);
    if (list) list.push(record);
    else byTypeClause.set(key, [record]);
  }

  for (const [key, records] of byTypeClause) {
    const [typeId, clauseId] = key.split("\u0000") as [ContractTypeId, string];
    const typeCatalog = (catalog[typeId] ??= {});
    typeCatalog[clauseId] = records.map((r) => ({
      articleFa: r.articleFa,
      lawTitleFa: r.sourceNameFa,
      noteFa: r.noteFa,
      status: r.status,
      lawSourceId: r.lawSourceId,
      sourceNameFa: r.sourceNameFa,
      contentVersion: r.contentVersion,
      reviewedAt: r.reviewedAt,
    }));
  }

  return catalog;
}

/**
 * The legal-basis annex for one rendered contract, read from the merged
 * catalog. This is the single read path the preview, the PDF, the .docx
 * and the admin report all use, so a reviewer's correction lands
 * everywhere at once.
 */
export function legalBasisReportFor(contract: PropertyContract, rendered: RenderedContract) {
  return buildLegalBasisReport(contract, rendered, mergedLegalBasisCatalog());
}

// ------------------------------------------------------------
// The admin report: per-clause source / version / review state
// ------------------------------------------------------------

/** One clause the type can emit, with its printed heading. */
export interface LegalReviewKnownClause {
  clauseId: string;
  clauseHeadingFa: string;
}

/**
 * Fill the synthetic data so EVERY clause the type CAN emit renders.
 *
 * The default data leaves optional steps empty and conditional clauses off,
 * which would hide a real clause (e.g. `rent.late_penalty` or a schema-driven
 * `generic.obligations`). The legal report must still name it, so the
 * catalog renders from a maximal draft, never from the printable defaults.
 */
function maximisedSyntheticData(typeId: ContractTypeId): PropertyContract["data"] {
  const def = getContractDefinition(typeId);
  const data = def.createDefaultData("apartment");

  if (def.fields.length > 0) {
    const generic = data as GenericContractData;
    const values = { ...(generic.values ?? {}) };
    for (const f of def.fields) {
      // Satisfy a conditional gate before deciding the field applies.
      if (f.requiredWhen) {
        const gate = f.requiredWhen;
        if (gate.oneOf?.length) {
          values[gate.key] = gate.oneOf[0] ?? null;
        } else if (gate.equals !== undefined) {
          values[gate.key] = gate.equals;
        }
      }
      if (values[f.key] !== undefined && values[f.key] !== null && values[f.key] !== "") continue;
      values[f.key] =
        f.kind === "number" || f.kind === "money"
          ? 1
          : f.kind === "toggle"
            ? true
            : f.kind === "date"
              ? "2026-01-01"
              : f.kind === "repeatable"
                ? []
                : "—";
    }
    return { ...generic, values };
  }

  const property = data as PropertyRentData | PropertySaleData;
  if (typeId === "property_rent") {
    const rent = data as PropertyRentData;
    rent.terms.hasLatePenalty = true;
    rent.terms.latePenaltyAmount = { amount: 1_000_000, currency: "IRR" };
  }
  return property;
}

function knownClausesForType(typeId: ContractTypeId): LegalReviewKnownClause[] {
  const def = getContractDefinition(typeId);
  const now = new Date().toISOString();
  // A synthetic draft: the renderer substitutes placeholders for every
  // missing value, so this never depends on stored data.
  const synthetic: PropertyContract = {
    id: `synthetic-${typeId}`,
    referenceCode: "",
    userId: "",
    domain: def.domain,
    type: typeId,
    typeFa: def.typeFa,
    state: "DRAFT",
    initiatorRole: def.defaultInitiatorRole,
    initiatorSide: "first",
    title: def.typeFa,
    currentStep: def.wizardSteps[0]?.id ?? "",
    progress: 0,
    templateVersion: def.templateVersion,
    schemaVersion: def.schemaVersion,
    data: maximisedSyntheticData(typeId),
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: "",
    createdAt: now,
    updatedAt: now,
  };
  return renderContract(synthetic, [], []).clauses.map((clause) => ({
    clauseId: clause.id,
    clauseHeadingFa: clause.headingFa,
  }));
}

export interface LegalReviewClauseRow {
  clauseId: string;
  /** The printed clause heading, e.g. «ماده ۵ — ثمن معامله». */
  clauseHeadingFa: string;
  /** Stored rows for this clause, in citation order. */
  records: ContractLegalClauseRecord[];
  /** The seeded citations this clause would fall back to, if any. */
  seeded: { articleFa: string; sourceNameFa: string; status: ContractLegalCitationStatus }[];
  /** True when at least one stored record exists (stored wins). */
  overridden: boolean;
}

/**
 * The complete legal-review picture for one contract TYPE: every catalogued
 * clause with its stored records (source, content version, review state),
 * plus the clauses that carry no reviewed source at all — flagged rather
 * than silently published.
 */
export function legalReviewTypeSummary(typeId: ContractTypeId): {
  typeId: ContractTypeId;
  clauses: LegalReviewClauseRow[];
  /** Every clause the type emits, including ones with no source at all. */
  knownClauses: LegalReviewKnownClause[];
  tips: ContractPreSignTip[];
  reviewedClauseCount: number;
  pendingClauseCount: number;
  needsRevisionCount: number;
  unflaggedCount: number;
} {
  const stored = listLegalClauseRecords(typeId);
  const byClause = new Map<string, ContractLegalClauseRecord[]>();
  for (const record of stored) {
    const list = byClause.get(record.clauseId);
    if (list) list.push(record);
    else byClause.set(record.clauseId, [record]);
  }

  const knownClauses = knownClausesForType(typeId);
  const headingById = new Map(knownClauses.map((c) => [c.clauseId, c.clauseHeadingFa]));

  const clauseIds = new Set<string>([
    ...Object.keys(LEGAL_BASIS_SEED[typeId] ?? {}),
    ...byClause.keys(),
    ...headingById.keys(),
  ]);

  const clauses: LegalReviewClauseRow[] = [...clauseIds].sort().map((clauseId) => {
    const records = byClause.get(clauseId) ?? [];
    const seeded = records.length
      ? []
      : (LEGAL_BASIS_SEED[typeId]?.[clauseId] ?? []).map((e) => ({
          articleFa: e.articleFa,
          sourceNameFa: e.sourceNameFa ?? e.lawTitleFa,
          status: e.status,
        }));
    return {
      clauseId,
      clauseHeadingFa: headingById.get(clauseId) ?? clauseId,
      records,
      seeded,
      overridden: records.length > 0,
    };
  });

  let reviewedClauseCount = 0;
  let pendingClauseCount = 0;
  let needsRevisionCount = 0;
  for (const clause of clauses) {
    const statuses = clause.overridden
      ? clause.records.map((r) => r.status)
      : clause.seeded.map((s) => s.status);
    if (statuses.includes("needs_revision")) needsRevisionCount += 1;
    else if (statuses.includes("pending")) pendingClauseCount += 1;
    else if (statuses.length > 0) reviewedClauseCount += 1;
  }

  return {
    typeId,
    clauses,
    knownClauses,
    tips: preSignTipsForType(typeId),
    reviewedClauseCount,
    pendingClauseCount,
    needsRevisionCount,
    unflaggedCount: clauses.filter((c) => !c.overridden && c.seeded.length === 0).length,
  };
}

/** The types the seed carries at least one pre-sign tip for. */
export function typesWithPreSignTips(): ContractTypeId[] {
  return Object.keys(PRE_SIGN_TIPS_SEED) as ContractTypeId[];
}
