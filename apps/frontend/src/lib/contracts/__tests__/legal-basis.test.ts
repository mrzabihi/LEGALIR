// ============================================================
// LEGALIR — Legal-basis annex (§2)
// ============================================================
// §2 of the contract brief: every provision a clause rests on must be a
// REAL, catalogued citation with stored review metadata — never guessed,
// never paraphrased, never invented. This pins that rule at the resolver
// level, so a future change can never let an unvetted article number slip
// into the annex the user sees.
// ============================================================

import { describe, it, expect } from "vitest";
import type { ContractParty, PropertyContract, PropertyRentData } from "@legalir/types";
import { CONTRACT_LEGAL_BASIS_DISCLAIMER_FA } from "@legalir/types";
import { getContractDefinition } from "../registry";
import { renderContract } from "../template";
import {
  buildLegalBasisReport,
  catalogCitationsForClause,
  cataloguedClauseIds,
  hasLegalBasis,
  legalBasisReportLines,
} from "../legal-basis";
import { getLawById } from "@/lib/law-catalog";

function rentContract(withPenalty: boolean): PropertyContract {
  const data = getContractDefinition("property_rent").createDefaultData(
    "apartment"
  ) as PropertyRentData;
  data.terms.hasLatePenalty = withPenalty;
  data.terms.latePenaltyAmount = withPenalty ? { amount: 5_000_000, currency: "IRR" } : null;
  return {
    id: "ct-legal-1",
    userId: "user-A",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    title: "اجاره‌نامه آپارتمان",
    state: "READY_FOR_REVIEW",
    currentStep: "review",
    progress: 100,
    referenceCode: "RENT-1405-0009",
    publicVerificationId: "pub-legal",
    finalVersionId: null,
    finalizedAt: null,
    data,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-10T10:00:00Z",
  } as unknown as PropertyContract;
}

const PARTIES: ContractParty[] = [
  {
    id: "pty-1",
    role: "landlord",
    identity: { firstName: "مریم", lastName: "محمدی", nationalId: "0012345678" },
  },
  {
    id: "pty-2",
    role: "tenant",
    identity: { firstName: "رضا", lastName: "کریمی", nationalId: "0087654321" },
  },
] as unknown as ContractParty[];

/** The complete, reviewed set of article locators this catalog may cite. */
const REVIEWED_ARTICLES = new Set([
  "ماده ۱۰ قانون مدنی",
  "ماده ۲۳۰ قانون مدنی",
  "ماده ۴۸۶ قانون مدنی",
  "ماده ۵۲۲ قانون آیین دادرسی مدنی",
]);

describe("the legal-basis annex cites only catalogued, reviewed provisions", () => {
  it("cites ماده ۲۳۰ for the rent late-penalty clause, with the disclaimer", () => {
    const contract = rentContract(true);
    const rendered = renderContract(contract, PARTIES, []);
    const report = buildLegalBasisReport(contract, rendered);

    const penalty = report.sections.find((s) => s.clauseId === "rent.late_penalty");
    expect(penalty).toBeDefined();
    expect(penalty!.citations[0]!.articleFa).toBe("ماده ۲۳۰ قانون مدنی");
    expect(penalty!.citations[0]!.status).toBe("reviewed");
    expect(report.disclaimerFa).toBe(CONTRACT_LEGAL_BASIS_DISCLAIMER_FA);
  });

  it("omits a clause with no catalogued provision — it never guesses one", () => {
    // With no late penalty the clause is not rendered, so no citation. And
    // a wholly unmapped clause resolves to an empty list, not a default.
    expect(catalogCitationsForClause("property_rent", "rent.late_penalty")).toHaveLength(1);
    expect(catalogCitationsForClause("property_rent", "common.parties")).toHaveLength(0);
    expect(catalogCitationsForClause("nda", "generic.does_not_exist")).toHaveLength(0);

    const contract = rentContract(false);
    const rendered = renderContract(contract, PARTIES, []);
    const report = buildLegalBasisReport(contract, rendered);
    expect(report.sections.find((s) => s.clauseId === "rent.late_penalty")).toBeUndefined();
    expect(report.uncitedClauseCount).toBeGreaterThan(0);
  });

  it("links every cited provision to a real law-catalog entry when one is claimed", () => {
    const clauses = [
      "rent.late_penalty",
      "rent.termination",
      "rent.costs",
      "sale.obligations",
      "generic.obligations",
      "generic.scope",
      "generic.data",
      "generic.governance",
    ];
    const typeIds = [
      "property_rent",
      "property_sale",
      "vehicle_sale",
      "debt",
      "freelance",
      "nda",
      "saas",
      "startup",
    ] as const;
    for (const typeId of typeIds) {
      for (const clauseId of clauses) {
        for (const c of catalogCitationsForClause(typeId, clauseId)) {
          if (c.lawSourceId) expect(getLawById(c.lawSourceId)).toBeDefined();
        }
      }
    }
  });

  it("never cites an article outside the reviewed whitelist", () => {
    const typeIds = [
      "property_rent",
      "property_sale",
      "vehicle_sale",
      "debt",
      "freelance",
      "nda",
      "saas",
      "startup",
    ] as const;
    const clauseIds = [
      "rent.late_penalty",
      "rent.termination",
      "rent.costs",
      "sale.obligations",
      "generic.obligations",
      "generic.scope",
      "generic.data",
      "generic.governance",
    ];
    for (const typeId of typeIds) {
      for (const clauseId of clauseIds) {
        for (const c of catalogCitationsForClause(typeId, clauseId)) {
          expect(REVIEWED_ARTICLES.has(c.articleFa)).toBe(true);
        }
      }
    }
  });

  it("flattens to plain lines for the PDF/.docx, disclaimer first", () => {
    const contract = rentContract(true);
    const rendered = renderContract(contract, PARTIES, []);
    const lines = legalBasisReportLines(buildLegalBasisReport(contract, rendered));
    expect(lines[0]).toBe(CONTRACT_LEGAL_BASIS_DISCLAIMER_FA);
    expect(lines.some((l) => l.includes("ماده ۲۳۰ قانون مدنی"))).toBe(true);
  });

  it("reports whether a type carries any catalogued basis at all", () => {
    expect(hasLegalBasis("property_rent")).toBe(true);
    expect(hasLegalBasis("nda")).toBe(true);
    expect(hasLegalBasis("commercial_rent")).toBe(true);
    expect(hasLegalBasis("commercial_sale")).toBe(true);
    expect(hasLegalBasis("cloud_iaas")).toBe(true);
    expect(hasLegalBasis("cloud_paas")).toBe(true);
    expect(hasLegalBasis("cloud_baas")).toBe(true);
  });

  it("covers the commercial and cloud families with reviewed citations", () => {
    expect(catalogCitationsForClause("commercial_rent", "generic.financial").length).toBeGreaterThan(0);
    expect(catalogCitationsForClause("commercial_rent", "generic.obligations").length).toBeGreaterThan(0);
    expect(catalogCitationsForClause("commercial_sale", "generic.financial").length).toBeGreaterThan(0);
    for (const typeId of ["cloud_iaas", "cloud_paas", "cloud_baas"] as const) {
      for (const clauseId of [
        "generic.service",
        "generic.sla",
        "generic.data",
        "generic.financial",
        "generic.obligations",
      ]) {
        const citations = catalogCitationsForClause(typeId, clauseId);
        expect(citations.length, `${typeId}/${clauseId}`).toBeGreaterThan(0);
        for (const c of citations) expect(REVIEWED_ARTICLES.has(c.articleFa)).toBe(true);
      }
    }
  });

  it("cites nothing for clauses whose source this repo has not reviewed", () => {
    // Trade licensing and notarial registration rest on regulations the
    // repo holds no reviewed text for, so the annex stays silent.
    expect(catalogCitationsForClause("commercial_rent", "generic.licence")).toHaveLength(0);
    expect(catalogCitationsForClause("commercial_sale", "generic.registration")).toHaveLength(0);
  });

  /**
   * The regression that motivated this test: `generic.employer` and
   * `generic.employee` were catalogued but `EMPLOYMENT_STEPS` never emits
   * them, so those citations could never reach a reader. Every catalogued
   * clause id must be one the renderer actually produces.
   */
  it("never catalogues a clause id the renderer cannot emit", () => {
    const types = [
      "property_rent",
      "property_sale",
      "vehicle_sale",
      "debt",
      "freelance",
      "nda",
      "saas",
      "startup",
      "employment",
      "commercial_rent",
      "commercial_sale",
      "cloud_iaas",
      "cloud_paas",
      "cloud_baas",
    ] as const;

    for (const typeId of types) {
      const def = getContractDefinition(typeId);
      const base = def.createDefaultData("apartment" as never);

      // Fill every declared field so CONDITIONAL clauses render too — a
      // default draft legitimately omits e.g. the rent late-penalty clause.
      let data: typeof base;
      if (def.fields.length > 0) {
        const values: Record<string, unknown> = {
          ...((base as { values?: Record<string, unknown> }).values ?? {}),
        };
        for (const f of def.fields) {
          values[f.key] =
            f.kind === "money"
              ? { amount: 1_000_000, currency: "IRR" }
              : f.kind === "number"
                ? 1
                : f.kind === "toggle"
                  ? true
                  : f.kind === "select"
                    ? f.options?.[0]?.value ?? "x"
                    : f.kind === "date"
                      ? "2026-08-01"
                      : f.kind === "repeatable"
                        ? [{ [f.columns?.[0]?.key ?? "x"]: "ردیف نمونه" }]
                        : "نمونه";
        }
        data = { ...base, values } as typeof base;
      } else {
        // The bespoke property journeys gate clauses on explicit terms.
        // (Matches `rentContract(true)` above: the amount is part of the
        // condition, not just the flag.)
        const terms = (base as unknown as { terms: Record<string, unknown> }).terms;
        data = {
          ...base,
          terms: {
            ...terms,
            hasLatePenalty: true,
            latePenaltyAmount: { amount: 5_000_000, currency: "IRR" },
          },
        } as typeof base;
      }

      const contract = {
        id: `ct-${typeId}`,
        userId: "user-A",
        domain: def.domain,
        type: typeId,
        typeFa: def.typeFa,
        title: def.typeFa,
        state: "DRAFT",
        currentStep: "review",
        progress: 0,
        referenceCode: null,
        publicVerificationId: null,
        finalVersionId: null,
        finalizedAt: null,
        data,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      } as unknown as PropertyContract;

      const renderedIds = new Set(renderContract(contract, [], []).clauses.map((c) => c.id));
      for (const clauseId of cataloguedClauseIds(typeId)) {
        expect(renderedIds.has(clauseId), `${typeId} catalogues ${clauseId}`).toBe(true);
      }
    }
  });
});
