// ============================================================
// LEGALIR — Schema-driven contract type tests
// ============================================================
// The non-property types (vehicle, debt, freelance, nda, saas,
// startup, employment) share ONE rendering path: the registry declares
// their fields, the generic SchemaStep renders them, the completeness
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
  "employment",
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
      nationalId: "0012345679",
      birthCertificateNumber: "",
      birthCertificatePlace: "",
      birthDate: null,
      mobile: "09120000003",
      address: "",
      postalCode: "",
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
    // The payment step names the recipient whose bank details it needs;
    // those live on the party record, never in the contract values.
    const bankingRole = def.wizardSteps.find((s) => s.bankingFor)?.bankingFor;
    const parties = def.roles.map((r) =>
      r === bankingRole
        ? {
            ...party(r),
            banking: {
              bankName: "بانک ملی",
              accountNumber: "1234567890",
              iban: "IR000000000000000000000000",
              cardNumber: "6037990000000000",
            },
          }
        : party(r)
    );
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

  it("renders required fields with the draft placeholder, never an empty optional line", () => {
    const contract = genericContract("nda");
    const rendered = renderContract(contract, [], []);

    // A draft must visibly show what is still missing. Required fields of
    // an applicable branch render with the ellipsis placeholder …
    const scope = rendered.clauses.find((c) => c.id === "generic.scope")!;
    expect(
      scope.paragraphs.some((p) => p.startsWith("نوع توافق محرمانگی: ") && p.includes("……………"))
    ).toBe(true);

    // … while an EMPTY OPTIONAL field adds no line at all.
    const terms = rendered.clauses.find((c) => c.id === "generic.terms")!;
    expect(terms.paragraphs.some((p) => p.startsWith("موارد مستثنی از محرمانگی"))).toBe(false);
  });

  it("omits a conditionally required field while its branch is not chosen", () => {
    const contract = genericContract("employment");
    const indefinite: PropertyContract = {
      ...contract,
      data: {
        schemaVersion: 1,
        values: { contractType: "indefinite" },
        customClauses: [],
      } as unknown as GenericContractData,
    };
    const rendered = renderContract(indefinite, [], []);
    const term = rendered.clauses.find((c) => c.id === "generic.term")!;

    // `endDate` is required only for definite/task-based contracts, so an
    // indefinite draft must not show an irrelevant blank for it.
    expect(term.paragraphs.some((p) => p.startsWith("تاریخ پایان قرارداد"))).toBe(false);
    expect(term.paragraphs.some((p) => p.startsWith("تاریخ شروع قرارداد"))).toBe(true);
  });
});

describe("employment — party branches (identity recorded once on the party)", () => {
  function employmentContract(values: Record<string, unknown> = {}): PropertyContract {
    const contract = genericContract("employment");
    return {
      ...contract,
      data: { schemaVersion: 1, values, customClauses: [] } as unknown as GenericContractData,
    };
  }

  function employmentParty(
    role: ContractParty["role"],
    overrides: Partial<ContractParty> = {}
  ): ContractParty {
    return { ...party(role), contractId: "cnt-employment", ...overrides };
  }

  function identity(
    overrides: Partial<ContractParty["identity"]> = {}
  ): ContractParty["identity"] {
    return { ...party("employer").identity, ...overrides };
  }

  function partiesPercent(parties: ContractParty[]): number {
    const result = computeCompleteness(employmentContract(), parties, []);
    return result.sections.find((s) => s.key === "parties")!.percent;
  }

  it("counts a natural-person employer complete without any company fields", () => {
    expect(
      partiesPercent([employmentParty("employer"), employmentParty("employee")])
    ).toBe(100);
  });

  it("blocks a legal-entity employer until its representative is a separate, linked person", () => {
    const legal = employmentParty("employer", {
      personKind: "legal",
      identity: identity({
        firstName: "",
        lastName: "",
        nationalId: "",
        companyName: "شرکت نمونه",
        companyRegistrationNumber: "14000000000",
        address: "نشانی شرکت",
      }),
    });

    // The entity's own registration is complete, but the authorized
    // representative is a SEPARATE person and must be recorded.
    expect(partiesPercent([legal, employmentParty("employee")])).toBe(0);

    const rep = employmentParty("legal_representative", {
      representativeOfPartyId: legal.id,
      representativePositionFa: "مدیرعامل",
    });
    expect(partiesPercent([legal, rep, employmentParty("employee")])).toBe(100);
  });

  it("switches the employee branch between a national id and passport data", () => {
    // Iranian: the national id is required and no passport data is asked.
    expect(
      partiesPercent([employmentParty("employer"), employmentParty("employee")])
    ).toBe(100);

    // Foreign: the Iranian national id is NOT required, but nationality,
    // passport and Gregorian birth data are.
    const foreignIncomplete = employmentParty("employee", {
      nationality: "foreign",
      identity: identity({ nationalId: "" }),
    });
    expect(partiesPercent([employmentParty("employer"), foreignIncomplete])).toBe(0);

    const foreignComplete = employmentParty("employee", {
      nationality: "foreign",
      identity: identity({
        nationalId: "",
        nationalityCountryFa: "افغانستان",
        passportNumber: "P1234567",
        passportExpiry: "2030-01-01",
        birthPlace: "کابل",
        birthDateGregorian: "1995-03-21",
      }),
    });
    expect(partiesPercent([employmentParty("employer"), foreignComplete])).toBe(100);
  });

  it("requires the employee's bank details on the wages section", () => {
    const contract = employmentContract({
      baseSalary: { amount: 20_000_000, currency: "IRR" },
      wagePeriod: "monthly",
    });

    const wagesPercent = (parties: ContractParty[]): number =>
      computeCompleteness(contract, parties, []).sections.find((s) => s.key === "wages")!
        .percent;

    // Banking lives on the party record (`bankingFor: "employee"`), so an
    // empty banking block leaves the payment section incomplete.
    expect(wagesPercent([employmentParty("employee")])).toBeLessThan(100);

    const paid = employmentParty("employee", {
      banking: {
        bankName: "بانک ملی",
        accountNumber: "1234567890",
        iban: "IR000000000000000000000000",
        cardNumber: "6037990000000000",
      },
    });
    expect(wagesPercent([paid])).toBe(100);
  });
});

// ============================================================
// Repeating rows (instalment schedules etc.)
// ============================================================
// A `repeatable` field is a user-managed list. These tests pin the three
// properties the brief demands: rows print as a real table, an empty
// scaffold row is never printed, and a required schedule cannot pass
// completeness on scaffold rows alone.

describe("repeatable fields — add / edit / delete rows", () => {
  function debtContract(values: Record<string, unknown>): PropertyContract {
    const contract = genericContract("debt");
    return {
      ...contract,
      data: { schemaVersion: 1, values, customClauses: [] } as unknown as GenericContractData,
    };
  }

  it("declares the instalment field with a column set the printer can draw", () => {
    const def = getContractDefinition("debt");
    const instalments = def.fields.find((f) => f.key === "instalments")!;
    expect(instalments.kind).toBe("repeatable");
    expect(instalments.columns?.map((c) => c.key)).toEqual(["dueDate", "amount", "note"]);
    expect(instalments.columns?.map((c) => c.labelFa)).toEqual(["سررسید", "مبلغ قسط", "توضیح"]);
  });

  it("prints each row as a table row, with the headers printed once", () => {
    const contract = debtContract({
      repaymentMethod: "instalments",
      instalments: [
        { dueDate: "2026-11-01", amount: { amount: 500_000_000, currency: "IRR" }, note: "قسط اول" },
        { dueDate: "2026-12-01", amount: { amount: 500_000_000, currency: "IRR" }, note: "قسط دوم" },
      ],
    });
    const rendered = renderContract(contract, [], []);
    const loan = rendered.clauses.find((c) => c.id === "generic.loan")!;

    const table = loan.blocks?.find((b) => b.kind === "table" && b.table.captionFa === "برنامهٔ اقساط");
    expect(table).toBeDefined();
    if (table?.kind !== "table") throw new Error("expected a table block");
    expect(table.table.columnsFa).toEqual(["سررسید", "مبلغ قسط", "توضیح"]);
    expect(table.table.rowsFa).toHaveLength(2);
    // Dates and money are formatted, never raw ISO / raw IRR integers.
    expect(table.table.rowsFa[0]![0]).not.toBe("2026-11-01");
    expect(table.table.rowsFa[0]![0]).toContain("۱۴۰۵");
    expect(table.table.rowsFa[0]![1]).toContain("۵۰");
    expect(table.table.rowsFa[1]![2]).toBe("قسط دوم");
  });

  it("never prints a blank scaffold row", () => {
    const contract = debtContract({
      repaymentMethod: "instalments",
      instalments: [
        { dueDate: null, amount: null, note: null },
        { dueDate: "2026-11-01", amount: { amount: 1_000, currency: "IRR" }, note: null },
      ],
    });
    const rendered = renderContract(contract, [], []);
    const loan = rendered.clauses.find((c) => c.id === "generic.loan")!;
    const table = loan.blocks?.find((b) => b.kind === "table" && b.table.captionFa === "برنامهٔ اقساط");
    if (table?.kind !== "table") throw new Error("expected a table block");
    expect(table.table.rowsFa).toHaveLength(1);
  });

  it("does not count scaffold-only rows as a completed required schedule", () => {
    const contract = debtContract({
      amount: { amount: 1_000_000, currency: "IRR" },
      loanDate: "2026-10-01",
      dueDate: "2027-10-01",
      repaymentMethod: "instalments",
      instalments: [{ dueDate: null, amount: null, note: null }],
    });
    const loanSection = computeCompleteness(contract, [], []).sections.find(
      (s) => s.key === "loan"
    )!;
    expect(loanSection.percent).toBeLessThan(100);

    const filled: PropertyContract = {
      ...contract,
      data: {
        ...(contract.data as GenericContractData),
        values: {
          ...(contract.data as GenericContractData).values,
          instalments: [{ dueDate: "2026-11-01", amount: { amount: 1_000_000, currency: "IRR" }, note: null }],
        },
      },
    };
    expect(
      computeCompleteness(filled, [], []).sections.find((s) => s.key === "loan")!.percent
    ).toBe(100);
  });

  it("prints a legacy free-text answer verbatim instead of dropping it", () => {
    const contract = debtContract({
      repaymentMethod: "instalments",
      instalmentTerms: "سه قسط مساوی هر ماه",
    });
    void contract;
    const commercial = genericContract("commercial_sale");
    const legacy: PropertyContract = {
      ...commercial,
      data: {
        schemaVersion: 1,
        values: { hasInstalments: true, instalmentTerms: "سه قسط مساوی هر ماه" },
        customClauses: [],
      } as unknown as GenericContractData,
    };
    const rendered = renderContract(legacy, [], []);
    const financial = rendered.clauses.find((c) => c.id === "generic.financial")!;
    expect(
      financial.paragraphs.some((p) => p.includes("سه قسط مساوی هر ماه"))
    ).toBe(true);
  });
});
