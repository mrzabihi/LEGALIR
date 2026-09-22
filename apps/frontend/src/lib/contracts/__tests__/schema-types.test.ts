// ============================================================
// LEGALIR — Schema-driven contract type tests
// ============================================================
// The six non-property types (vehicle, debt, freelance, nda, saas,
// startup) share ONE rendering path: the registry declares their
// fields, the generic SchemaStep renders them, the completeness
// scorer reads `values.<key>`, and the template engine turns each
// wizard step into a clause. These tests lock that contract in so a
// new type can never silently regress to "not implemented".
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractParty,
  GenericContractData,
  PropertyContract,
  SchemaContractType,
} from "@legalir/types";
import { getContractDefinition, implementedContractDefinitions } from "../registry";
import { computeCompleteness } from "../completeness";
import { renderContract, renderContractText } from "../template";

const SCHEMA_TYPES: SchemaContractType[] = [
  "vehicle_sale",
  "debt",
  "freelance",
  "nda",
  "saas",
  "startup",
];

function genericContract(type: SchemaContractType): PropertyContract {
  const def = getContractDefinition(type);
  return {
    id: `cnt-${type}`,
    userId: "user-1",
    domain: def.domain,
    type,
    typeFa: def.typeFa,
    state: "DRAFT",
    initiatorRole: def.defaultInitiatorRole,
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
    referenceCode: `LGL-TEST-1405-000001`,
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
      fatherName: "",
      nationalId: "0079123456",
      birthCertificateNumber: "",
      birthCertificatePlace: "",
      birthDate: null,
      mobile: "09120000003",
      address: "",
      postalCode: "",
    },
    ownershipShare: null,
    powerOfAttorney: null,
    isInitiator: true,
    createdAt: "2026-09-20T00:00:00.000Z",
  };
}

describe("schema-driven types — registry", () => {
  it("registers all six types as implemented", () => {
    const ids = implementedContractDefinitions().map((d) => d.id);
    for (const type of SCHEMA_TYPES) expect(ids).toContain(type);
  });

  it("declares at least one field per type, all bound to a real step", () => {
    for (const type of SCHEMA_TYPES) {
      const def = getContractDefinition(type);
      expect(def.fields.length).toBeGreaterThan(0);
      const stepIds = new Set(def.wizardSteps.map((s) => s.id));
      for (const f of def.fields) expect(stepIds.has(f.stepId)).toBe(true);
    }
  });

  it("derives a completeness section for every step that owns a required field", () => {
    for (const type of SCHEMA_TYPES) {
      const def = getContractDefinition(type);
      const requiredSteps = new Set(
        def.fields.filter((f) => f.required).map((f) => f.stepId)
      );
      for (const stepId of requiredSteps) {
        expect(def.sections.some((s) => s.key === stepId)).toBe(true);
      }
    }
  });
});

describe("schema-driven types — completeness", () => {
  it("starts below 100% with an empty generic data object", () => {
    for (const type of SCHEMA_TYPES) {
      const result = computeCompleteness(genericContract(type), [], []);
      expect(result.overall).toBeLessThan(100);
    }
  });

  it("labels a missing generic field with its Persian label, not its path", () => {
    const def = getContractDefinition("debt");
    const result = computeCompleteness(genericContract("debt"), [], []);
    const firstRequired = def.fields.find((f) => f.required)!;
    const allMissing = result.sections.flatMap((s) => s.missing);
    expect(allMissing).toContain(firstRequired.labelFa);
    expect(allMissing.some((m) => m.startsWith("values."))).toBe(false);
  });

  it("reaches 100% when every required field is filled and both parties exist", () => {
    const def = getContractDefinition("debt");
    const contract = genericContract("debt");
    const values: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (!f.required) continue;
      values[f.key] =
        f.kind === "money"
          ? { amount: 5_000_000, currency: "IRR" }
          : f.kind === "number"
            ? 1
            : f.kind === "toggle"
              ? true
              : f.kind === "date"
                ? "2026-10-01"
                : f.kind === "select"
                  ? (f.options?.[0]?.value ?? "x")
                  : "مقدار";
    }
    const filled: PropertyContract = {
      ...contract,
      data: { schemaVersion: 1, values, customClauses: [] } as unknown as GenericContractData,
    };
    const parties = def.roles.map((r) => party(r));
    const documents = def.requiredDocuments
      .filter((d) => d.required)
      .map((d) => ({
        id: `doc-${d.category}`,
        contractId: contract.id,
        category: d.category,
        fileName: "f.pdf",
        mime: "application/pdf",
        sizeBytes: 10,
        storageKey: "k",
        hash: "h",
        description: "",
        photoCategory: null,
        uploadedBy: "user-1",
        uploadedAt: "2026-09-20T00:00:00.000Z",
      }));
    const result = computeCompleteness(filled, parties, documents as never);
    expect(result.overall).toBe(100);
  });
});

describe("schema-driven types — template", () => {
  it("renders a clause per filled step and the party signature block", () => {
    const def = getContractDefinition("nda");
    const contract = genericContract("nda");
    const values: Record<string, string> = {};
    for (const f of def.fields) values[f.key] = "مقدار";
    const filled: PropertyContract = {
      ...contract,
      data: { schemaVersion: 1, values, customClauses: [] } as unknown as GenericContractData,
    };
    const parties = def.roles.map((r) => party(r));
    const rendered = renderContract(filled, parties, []);

    // The parties clause is always first.
    expect(rendered.clauses[0]!.id).toBe("common.parties");
    // At least one generic clause was produced.
    expect(rendered.clauses.some((c) => c.id.startsWith("generic."))).toBe(true);
    // Both roles appear in the signature block.
    expect(rendered.signatureLines).toHaveLength(def.roles.length);
    // The plain-text rendering is non-empty and deterministic.
    const text = renderContractText(rendered);
    expect(text.length).toBeGreaterThan(0);
    expect(renderContractText(renderContract(filled, parties, []))).toBe(text);
  });

  it("omits clauses for steps whose fields are all empty", () => {
    const contract = genericContract("saas");
    const rendered = renderContract(contract, [], []);
    expect(rendered.clauses.some((c) => c.id.startsWith("generic."))).toBe(false);
  });
});
