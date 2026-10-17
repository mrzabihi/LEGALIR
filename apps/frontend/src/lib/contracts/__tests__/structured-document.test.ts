// ============================================================
// LEGALIR — Structured document model (§2 + §4)
// ============================================================
// The brief's two hard separation rules, pinned at the renderer:
//
//   §2  A clause is an ordered list of BLOCKS (paragraph | table), and
//       `paragraphs` must be the EXACT plain-text mirror of those blocks
//       — nothing may appear on the sheet that is missing from the
//       plain-text projection (docx export, hash, admin list).
//
//   §4  Free text may never silently replace an authored clause or an
//       identity field. So:
//         • a custom AGREEMENT prints as an operative term;
//         • a CHANGE REQUEST prints ONLY in the labelled non-operative
//           annex, never as an operative term;
//         • supplementary notes likewise live only in the annex;
//         • every declarative clause the drafter authored is untouched.
//
// The cloud family is covered separately: IaaS/PaaS/BaaS share the SLA
// and finance skeleton but must each print their OWN subject-matter
// fields, so the three documents can never be interchangeable.
// ============================================================

import { describe, it, expect } from "vitest";
import type { ContractParty, GenericContractData, PropertyContract } from "@legalir/types";
import { getContractDefinition, implementedContractDefinitions } from "../registry";
import { clauseParagraphs, renderContract } from "../template";

const NOTE_TEXT = "یادداشت تکمیلی کاملاً یکتا — تمدید تلفنی معتبر نیست.";
const AGREEMENT_TEXT = "طرفین توافق کردند که پارکینگ اختصاصی باشد.";
const REQUEST_TEXT = "درخواست یکتای اصلاح — روز پرداخت به دهم منتقل شود.";

function party(role: string): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: "ctr-structured",
    role,
    capacity: "owner",
    identity: {
      firstName: "مریم",
      lastName: "محمدی",
      fatherName: "علی",
      nationalId: "0012345678",
      birthCertificateNumber: "1234",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile: "09121110001",
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
  } as unknown as ContractParty;
}

function genericContract(
  typeId: string,
  values: Record<string, unknown>,
  extra: Partial<GenericContractData> = {}
): PropertyContract {
  const def = getContractDefinition(typeId as never);
  return {
    id: `ctr-${typeId}`,
    userId: "user-A",
    domain: def.domain,
    type: def.id,
    typeFa: def.typeFa,
    title: def.typeFa,
    state: "DRAFT",
    initiatorRole: def.defaultInitiatorRole,
    initiatorSide: "first",
    currentStep: def.wizardSteps[0]!.id,
    progress: 50,
    templateVersion: def.templateVersion,
    schemaVersion: 1,
    referenceCode: "LGL-TEST-1405-000002",
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: null,
    data: { schemaVersion: 1, values, customClauses: [], ...extra },
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContract;
}

/** A plausible answer for every declared field of a definition. */
function answerAll(def: ReturnType<typeof getContractDefinition>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of def.fields) {
    values[f.key] =
      f.kind === "money"
        ? { amount: 1_000_000, currency: "IRR" }
        : f.kind === "number"
          ? 3
          : f.kind === "toggle"
            ? true
            : f.kind === "date"
              ? "2026-10-01"
              : f.kind === "select"
                ? f.options?.[0]?.value ?? "x"
                : f.kind === "repeatable"
                  ? [{ [f.columns?.[0]?.key ?? "x"]: "ردیف" }]
                  : "نمونه";
  }
  return values;
}

describe("§2 — the plain-text projection is an exact mirror of the blocks", () => {
  it("derives `paragraphs` from `blocks` for every clause of every type", () => {
    for (const def of implementedContractDefinitions()) {
      const contract =
        def.fields.length > 0
          ? genericContract(def.id, answerAll(def))
          : ({
              ...genericContract(def.id, {}),
              data: def.createDefaultData("apartment" as never),
            } as PropertyContract);

      const rendered = renderContract(
        contract,
        def.roles.map((r) => party(r as string)),
        []
      );

      for (const clause of rendered.clauses) {
        for (const block of clause.blocks ?? []) {
          if (block.kind === "paragraph") {
            expect(block.textFa.trim().length, `${def.id}/${clause.id}`).toBeGreaterThan(0);
          } else {
            expect(block.table.columnsFa.length, `${def.id}/${clause.id}`).toBeGreaterThan(0);
          }
        }
        expect(clauseParagraphs(clause), `${def.id}/${clause.id}`).toEqual(clause.paragraphs);
      }
    }
  });

  it("keeps a table's caption, headers and every row in the plain-text mirror", () => {
    const rendered = renderContract(
      genericContract("employment", {
        jobTitle: "کارشناس",
        jobDuties: "وظایف",
        jobWorkplace: "تهران",
        contractType: "definite",
        baseSalary: { amount: 100_000_000, currency: "IRR" },
        wagePeriod: "monthly",
        weeklyHours: 44,
        socialInsurance: "yes",
      }),
      [party("employer"), party("employee")],
      []
    );
    const withTable = rendered.clauses.find((c) =>
      (c.blocks ?? []).some((b) => b.kind === "table")
    );
    expect(withTable).toBeDefined();

    const table = (withTable!.blocks ?? []).find((b) => b.kind === "table")!;
    if (table.kind !== "table") throw new Error("unreachable");

    if (table.table.captionFa) expect(withTable!.paragraphs).toContain(table.table.captionFa);
    expect(withTable!.paragraphs).toContain(table.table.columnsFa.join(" | "));
    for (const row of table.table.rowsFa) {
      expect(withTable!.paragraphs).toContain(row.join(" | "));
    }
  });
});

describe("§4 — free text never replaces an authored clause or identity", () => {
  const extras = {
    customClauses: [
      {
        id: "cc-agreement",
        kind: "agreement" as const,
        title: "پارکینگ اختصاصی",
        body: AGREEMENT_TEXT,
        createdAt: "2026-09-20T00:00:00.000Z",
      },
      {
        id: "cc-request",
        kind: "change_request" as const,
        title: "اصلاح روز پرداخت",
        body: REQUEST_TEXT,
        sectionRef: "service",
        createdAt: "2026-09-20T00:00:00.000Z",
      },
    ],
    supplementary: { notes: NOTE_TEXT },
  };

  it("prints an agreement as an operative term, and a change request only in the annex", () => {
    const rendered = renderContract(
      genericContract("saas", {}, extras),
      [party("provider"), party("customer")],
      []
    );
    const custom = rendered.clauses.find((c) => c.id === "common.custom");
    const annex = rendered.clauses.find((c) => c.id === "common.supplementary");

    expect(custom).toBeDefined();
    expect(custom!.paragraphs.join(" ")).toContain(AGREEMENT_TEXT);
    expect(custom!.paragraphs.join(" ")).not.toContain(REQUEST_TEXT);

    expect(annex).toBeDefined();
    expect(annex!.paragraphs.join(" ")).toContain(REQUEST_TEXT);
    expect(annex!.paragraphs.join(" ")).not.toContain(AGREEMENT_TEXT);

    // The annex heading itself says it is not binding.
    expect(annex!.headingFa).toContain("تغییرات درخواستی");
    expect(annex!.paragraphs[0]).toContain("تعهدآور قرارداد نیست");
  });

  it("never lets a change request leak into any other clause", () => {
    const rendered = renderContract(genericContract("saas", {}, extras), [], []);
    const offenders = rendered.clauses.filter(
      (c) => c.id !== "common.supplementary" && c.paragraphs.join(" ").includes(REQUEST_TEXT)
    );
    expect(offenders.map((c) => c.id)).toEqual([]);
  });

  it("keeps supplementary notes out of every operative clause", () => {
    const rendered = renderContract(genericContract("saas", {}, extras), [], []);
    const offenders = rendered.clauses.filter(
      (c) => c.id !== "common.supplementary" && c.paragraphs.join(" ").includes(NOTE_TEXT)
    );
    expect(offenders.map((c) => c.id)).toEqual([]);
  });

  it("emits no annex clause when there is neither a note nor a request", () => {
    const rendered = renderContract(genericContract("saas", {}, {}), [], []);
    expect(rendered.clauses.find((c) => c.id === "common.supplementary")).toBeUndefined();
  });

  it("never prints a blank change-request row", () => {
    const rendered = renderContract(
      genericContract("saas", {}, {
        customClauses: [
          {
            id: "cc-empty",
            kind: "change_request",
            title: "   ",
            body: "   ",
            createdAt: "2026-09-20T00:00:00.000Z",
          },
        ],
      }),
      [],
      []
    );
    expect(rendered.clauses.find((c) => c.id === "common.supplementary")).toBeUndefined();
  });
});

describe("the cloud family — three models, three documents", () => {
  const COMMON: Record<string, unknown> = {
    serviceName: "سرویس آزمون",
    serviceDescription: "شرح سرویس آزمون",
    hostingRegion: "تهران",
    contractStartDate: "2026-10-01",
    contractTermMonths: 12,
    availabilitySla: 99.5,
    supportHours: "۲۴/۷",
    responseTime: "۲ ساعت",
    securityMeasures: "رمزنگاری در حالت سکون و انتقال",
  };

  const MODEL_SPECIFIC: Record<string, Record<string, unknown>> = {
    cloud_iaas: { computeSpec: "۴ vCPU / ۸GB", storageSpec: "SSD 500GB", osResponsibility: "customer" },
    cloud_paas: { runtimeStack: "Node 22", scalingPolicy: "افقی تا ۱۰ نمونه", deploymentMethod: "CI/CD" },
    cloud_baas: { backendServices: "DB + Auth", databaseSpec: "Postgres 16", apiQuota: "۱M/ماه" },
  };

  /**
   * What the sheet actually prints for a stored value. A `select` prints its
   * option label, never the stored token — the brief's rule is that the reader
   * sees Persian, so the assertion must follow the same projection.
   */
  function printedValue(typeId: string, key: string, value: unknown): string {
    const field = getContractDefinition(typeId as never).fields.find((f) => f.key === key);
    if (field?.kind === "select") {
      const option = field.options?.find((o) => o.value === value);
      if (option) return option.labelFa;
    }
    return String(value);
  }

  /**
   * The label the sheet actually prints for a field — the declared table row
   * label when the field is tabulated, else the field's own label. This is the
   * strongest available leak signal: it is the exact string on the paper.
   */
  function printedLabel(typeId: string, key: string): string {
    const def = getContractDefinition(typeId as never);
    const field = def.fields.find((f) => f.key === key);
    for (const table of def.fieldTables ?? []) {
      const row = table.rows.find((r) => r.key === key);
      if (row) return row.labelFa ?? field?.labelFa ?? key;
    }
    return field?.labelFa ?? key;
  }

  it("prints each model's own subject matter and not the other two", () => {
    for (const [typeId, own] of Object.entries(MODEL_SPECIFIC)) {
      const rendered = renderContract(
        genericContract(typeId, { ...COMMON, ...own }),
        [party("provider"), party("customer")],
        []
      );
      const text = rendered.clauses.flatMap((c) => c.paragraphs).join("\n");

      for (const [field, value] of Object.entries(own)) {
        expect(text, `${typeId} is missing ${field}`).toContain(
          printedValue(typeId, field, value)
        );
      }
      for (const [otherType, otherFields] of Object.entries(MODEL_SPECIFIC)) {
        if (otherType === typeId) continue;
        for (const field of Object.keys(otherFields)) {
          // Assert on the other model's printed LABEL, not its value: a short
          // token like «مشتری» legitimately appears as a party role, but the
          // other model's own subject-matter heading must never be printed.
          const label = printedLabel(otherType, field);
          expect(text, `${typeId} leaked ${otherType}'s field "${label}"`).not.toContain(label);
        }
      }
    }
  });

  it("declares a distinct template version per model", () => {
    const versions = ["cloud_iaas", "cloud_paas", "cloud_baas"].map(
      (t) => getContractDefinition(t as never).templateVersion
    );
    expect(new Set(versions).size).toBe(3);
  });
});
