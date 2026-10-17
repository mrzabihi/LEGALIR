// ============================================================
// LEGALIR — every implemented type renders a printable document
// ============================================================
// §8 of the contract brief asks for acceptance coverage PER CONTRACT
// TYPE, not just for the property journeys. The other suites exercise
// the two property renderers and sample the schema types; nothing
// sweeps ALL implemented definitions together.
//
// Three invariants are checked for every registered type:
//
//   1. the definition is internally consistent — every field binds to a
//      real step, and every declared `fieldTables` row points at a real
//      field of that step (a stale key is a silent coverage hole: the
//      answer is collected but never printed);
//   2. the draft and the filled document both render, with the parties
//      clause first and a signature line per role;
//   3. no printed table is empty — not one header-only grid, not one
//      zero-column table. A legal sheet must never carry a bare frame.
//
// It is deliberately DATA-driven: a new contract type is covered the
// moment it is registered, without touching this file.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractFieldDescriptor,
  ContractParty,
  GenericContractData,
  PropertyContract,
} from "@legalir/types";
import { implementedContractDefinitions } from "../registry";
import { renderContract } from "../template";

const DEFINITIONS = implementedContractDefinitions();

/** A contract row for the given type, using its real default data. */
function defaultContract(def: (typeof DEFINITIONS)[number]): PropertyContract {
  return {
    id: `cnt-${def.id}`,
    userId: "user-1",
    domain: def.domain,
    type: def.id,
    typeFa: def.typeFa,
    state: "DRAFT",
    initiatorRole: def.defaultInitiatorRole,
    initiatorSide: "first",
    title: def.typeFa,
    currentStep: def.wizardSteps[0]!.id,
    progress: 0,
    templateVersion: def.templateVersion,
    schemaVersion: 1,
    data: def.createDefaultData("apartment"),
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: null,
    referenceCode: "LGL-TEST-1405-000001",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContract;
}

function party(role: ContractParty["role"]): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: "cnt-test",
    role,
    capacity: "owner",
    identity: {
      firstName: "نام",
      lastName: "خانوادگی",
      fatherName: "پدر",
      nationalId: "0012345679",
      birthCertificateNumber: "1",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile: "09120000003",
      address: "تهران",
      postalCode: "1234567890",
    },
    personKind: "natural",
    nationality: "iranian",
    representativeOfPartyId: null,
    representativePositionFa: "",
    ownershipShare: null,
    powerOfAttorney: null,
    banking: null,
    isInitiator: true,
    createdAt: "2026-09-20T00:00:00.000Z",
  };
}

/** A plausible answer for a field of the given kind. */
function answerFor(field: ContractFieldDescriptor): unknown {
  switch (field.kind) {
    case "money":
      return { amount: 5_000_000, currency: "IRR" };
    case "number":
      return 2;
    case "toggle":
      return true;
    case "date":
      return "2026-10-01";
    case "select":
      return field.options?.[0]?.value ?? "x";
    case "repeatable":
      // One fully answered row, so the printed table has data to show.
      return (field.columns ?? []).reduce<Record<string, unknown>>((row, col) => {
        row[col.key] =
          col.kind === "money"
            ? { amount: 5_000_000, currency: "IRR" }
            : col.kind === "number"
              ? 1
              : col.kind === "date"
                ? "2026-10-01"
                : "مقدار";
        return row;
      }, {});
    default:
      return "مقدار آزمون";
  }
}

describe("every implemented contract type", () => {
  it("registers a definition with steps, fields and roles", () => {
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(14);
    for (const def of DEFINITIONS) {
      expect(def.wizardSteps.length, `${def.id} has no steps`).toBeGreaterThan(0);
      expect(def.roles.length, `${def.id} has no roles`).toBeGreaterThan(0);
      expect(def.typeFa.length).toBeGreaterThan(0);
      expect(def.templateVersion.length).toBeGreaterThan(0);
    }
  });

  it("binds every field to a declared step", () => {
    for (const def of DEFINITIONS) {
      const stepIds = new Set(def.wizardSteps.map((s) => s.id));
      for (const field of def.fields) {
        expect(
          stepIds.has(field.stepId),
          `${def.id}.${field.key} points at unknown step "${field.stepId}"`
        ).toBe(true);
      }
    }
  });

  it("declares printable tables that can actually draw every row", () => {
    for (const def of DEFINITIONS) {
      const stepIds = new Set(def.wizardSteps.map((s) => s.id));
      for (const table of def.fieldTables ?? []) {
        expect(
          stepIds.has(table.stepId),
          `${def.id}: table "${table.captionFa}" points at unknown step "${table.stepId}"`
        ).toBe(true);
        expect(table.columnsFa.length).toBeGreaterThan(0);
        for (const row of table.rows) {
          const field = def.fields.find((f) => f.key === row.key);
          expect(
            field,
            `${def.id}: table "${table.captionFa}" names unknown field "${row.key}"`
          ).toBeDefined();
          // A declared table owns its fields — a row pointing at another
          // step's field would print that answer under the wrong heading.
          expect(field!.stepId).toBe(table.stepId);
        }
      }
    }
  });

  it("renders a draft with the parties clause first and one signature per role", () => {
    for (const def of DEFINITIONS) {
      const contract = defaultContract(def);
      const parties = def.roles.map(party);
      const rendered = renderContract(contract, parties, []);

      expect(rendered.clauses[0]!.id, def.id).toBe("common.parties");
      expect(rendered.clauses.length, def.id).toBeGreaterThan(1);
      expect(rendered.signatureLines, def.id).toHaveLength(def.roles.length);
      expect(rendered.titleFa.length, def.id).toBeGreaterThan(0);
    }
  });

  it("renders a fully answered document without throwing", () => {
    for (const def of DEFINITIONS) {
      if (def.fields.length === 0) continue; // bespoke property journeys
      const values: Record<string, unknown> = {};
      for (const field of def.fields) values[field.key] = answerFor(field);
      const contract = {
        ...defaultContract(def),
        data: {
          schemaVersion: 1,
          values: values as GenericContractData["values"],
          customClauses: [
            {
              id: "cc-1",
              kind: "agreement",
              title: "شرط افزوده",
              body: "متن شرط افزودهٔ آزمون.",
              sectionRef: def.wizardSteps[0]!.id,
              createdAt: "2026-09-20T00:00:00.000Z",
            },
            {
              id: "cc-2",
              kind: "change_request",
              title: "درخواست تغییر",
              body: "متن درخواست آزمون.",
              sectionRef: def.wizardSteps[0]!.id,
              createdAt: "2026-09-20T00:00:00.000Z",
            },
          ],
          supplementary: { notes: "یادداشت تکمیلی آزمون." },
        } satisfies GenericContractData,
      } as PropertyContract;

      const parties = def.roles.map(party);
      const rendered = renderContract(contract, parties, []);
      expect(rendered.clauses.length, def.id).toBeGreaterThan(1);
      // Every step that owns a field becomes a clause.
      const emitted = new Set(rendered.clauses.map((c) => c.id));
      for (const step of def.wizardSteps) {
        if (!def.fields.some((f) => f.stepId === step.id)) continue;
        expect(emitted.has(`generic.${step.id}`), `${def.id}/${step.id}`).toBe(true);
      }
      // The custom clause and the non-operative annex both reached the sheet.
      expect(emitted.has("common.custom"), def.id).toBe(true);
      expect(emitted.has("common.supplementary"), def.id).toBe(true);
    }
  });

  it("never prints an empty or zero-column table", () => {
    for (const def of DEFINITIONS) {
      const contract = defaultContract(def);
      const parties = def.roles.map(party);
      const rendered = renderContract(contract, parties, []);
      for (const clause of rendered.clauses) {
        for (const block of clause.blocks ?? []) {
          if (block.kind !== "table") continue;
          expect(
            block.table.columnsFa.length,
            `${def.id}/${clause.id}: table with no columns`
          ).toBeGreaterThan(0);
          expect(
            block.table.rowsFa.length,
            `${def.id}/${clause.id}: table with no rows`
          ).toBeGreaterThan(0);
          for (const row of block.table.rowsFa) {
            expect(
              row.length,
              `${def.id}/${clause.id}: row width does not match its headers`
            ).toBe(block.table.columnsFa.length);
            expect(
              row.some((cell) => cell.trim().length > 0),
              `${def.id}/${clause.id}: blank row reached the sheet`
            ).toBe(true);
          }
        }
      }
    }
  });

  it("prints a repeatable field as a table with its declared columns", () => {
    for (const def of DEFINITIONS) {
      const repeatables = def.fields.filter((f) => f.kind === "repeatable");
      if (repeatables.length === 0) continue;
      const values: Record<string, unknown> = {};
      for (const field of repeatables) values[field.key] = [answerFor(field)];
      const contract = {
        ...defaultContract(def),
        data: { schemaVersion: 1, values, customClauses: [] } as GenericContractData,
      } as PropertyContract;
      const rendered = renderContract(contract, def.roles.map(party), []);
      const tables = rendered.clauses.flatMap((c) =>
        (c.blocks ?? []).flatMap((b) => (b.kind === "table" ? [b.table] : []))
      );
      for (const field of repeatables) {
        const table = tables.find((t) => t.captionFa === field.labelFa);
        expect(table, `${def.id}.${field.key}: no printed table`).toBeDefined();
        expect(table!.columnsFa).toEqual((field.columns ?? []).map((c) => c.labelFa));
        expect(table!.rowsFa).toHaveLength(1);
      }
    }
  });
});
