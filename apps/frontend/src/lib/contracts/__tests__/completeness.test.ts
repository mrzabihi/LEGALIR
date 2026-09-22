// ============================================================
// LEGALIR — Completeness scorer tests
// ============================================================
// Progress must reflect real required fields, not visited steps.
// These tests cover the cases the spec calls out explicitly:
// multiple parties, the conditional parking field, and the rule
// that a contract cannot read 100% while a section is empty.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractDocument,
  ContractParty,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { computeCompleteness, isReadyForReview, firstIncompleteStepId } from "../completeness";
import { getContractDefinition } from "../registry";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function rentContract(overrides: Partial<PropertyRentData> = {}): PropertyContract {
  const def = getContractDefinition("property_rent");
  const base = def.createDefaultData("apartment") as PropertyRentData;
  return {
    id: "cnt-test",
    userId: "user-1",
    domain: "property",
    type: "property_rent",
    typeFa: def.typeFa,
    state: "DRAFT",
    initiatorRole: "landlord",
    title: "test",
    currentStep: "parties",
    progress: 0,
    templateVersion: def.templateVersion,
    schemaVersion: 1,
    data: { ...base, ...overrides },
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: null,
    referenceCode: "LGL-RENT-1405-000001",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContract;
}

function saleContract(overrides: Partial<PropertySaleData> = {}): PropertyContract {
  const def = getContractDefinition("property_sale");
  const base = def.createDefaultData("apartment") as PropertySaleData;
  return {
    ...rentContract(),
    id: "cnt-sale",
    type: "property_sale",
    typeFa: def.typeFa,
    initiatorRole: "seller",
    templateVersion: def.templateVersion,
    data: { ...base, ...overrides },
  } as unknown as PropertyContract;
}

function party(role: ContractParty["role"], complete = true): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: "cnt-test",
    role,
    capacity: "owner",
    identity: {
      firstName: complete ? "نام" : "",
      lastName: complete ? "خانوادگی" : "",
      fatherName: "",
      nationalId: complete ? "0079123456" : "",
      birthCertificateNumber: "",
      birthCertificatePlace: "",
      birthDate: null,
      mobile: complete ? "09120000003" : "",
      address: "",
      postalCode: "",
    },
    ownershipShare: null,
    powerOfAttorney: null,
    isInitiator: role === "landlord" || role === "seller",
    createdAt: "2026-09-20T00:00:00.000Z",
  };
}

function doc(category: ContractDocument["category"]): ContractDocument {
  return {
    id: `doc-${category}`,
    contractId: "cnt-test",
    category,
    fileName: "f.pdf",
    mime: "application/pdf",
    sizeBytes: 10,
    storageKey: "k",
    hash: "h",
    description: "",
    photoCategory: null,
    uploadedBy: "user-1",
    uploadedAt: "2026-09-20T00:00:00.000Z",
  };
}

/** Every required document for a type. */
function allRequiredDocs(type: "property_rent" | "property_sale"): ContractDocument[] {
  return getContractDefinition(type)
    .requiredDocuments.filter((d) => d.required)
    .map((d) => doc(d.category));
}

/** A rent contract with every non-document section filled. */
function fullyFilledRent(): PropertyContract {
  const base = getContractDefinition("property_rent").createDefaultData("apartment") as PropertyRentData;
  return rentContract({
    address: { ...base.address, province: "تهران", city: "تهران", street: "ولیعصر" },
    general: { ...base.general, area: 90 },
    deed: { ...base.deed, ownerName: "مریم محمدی" },
    durations: { ...base.durations, startDate: "2026-10-01", endDate: "2027-10-01" },
    costs: { ...base.costs, water: "tenant" },
    usageRules: { ...base.usageRules, residentialOnly: true },
    handover: {
      ...base.handover,
      items: base.handover.items.map((i) => ({ ...i, state: "intact" as const })),
    },
  });
}

// ------------------------------------------------------------

describe("completeness — parties", () => {
  it("fails the parties section when a role is missing", () => {
    const result = computeCompleteness(rentContract(), [party("landlord")], []);
    expect(result.sections.find((s) => s.key === "parties")!.percent).toBe(0);
  });

  it("passes only when every declared role has a complete identity", () => {
    const result = computeCompleteness(
      rentContract(),
      [party("landlord"), party("tenant")],
      []
    );
    expect(result.sections.find((s) => s.key === "parties")!.percent).toBe(100);
  });

  it("fails when a party is present but missing a required identity field", () => {
    const result = computeCompleteness(
      rentContract(),
      [party("landlord"), party("tenant", false)],
      []
    );
    expect(result.sections.find((s) => s.key === "parties")!.percent).toBe(0);
  });

  it("requires both sale roles (seller and buyer)", () => {
    const result = computeCompleteness(saleContract(), [party("seller")], []);
    expect(result.sections.find((s) => s.key === "parties")!.percent).toBe(0);
  });
});

describe("completeness — conditional parking field", () => {
  it("does not require parking details when the property has no parking", () => {
    const base = getContractDefinition("property_rent").createDefaultData("apartment") as PropertyRentData;
    const c = rentContract({
      amenities: { ...base.amenities, hasParking: false, parkingNumber: "" },
    });
    const result = computeCompleteness(c, [], []);
    // The property section's required paths never include parking,
    // so an absent parking spot cannot block the contract.
    const section = result.sections.find((s) => s.key === "property")!;
    expect(section.missing).not.toContain("پارکینگ");
  });

  it("keeps the property section independent of optional amenities", () => {
    const base = getContractDefinition("property_rent").createDefaultData("apartment") as PropertyRentData;
    const c = rentContract({
      address: { ...base.address, province: "تهران", city: "تهران", street: "ولیعصر" },
      general: { ...base.general, area: 90 },
    });
    const result = computeCompleteness(c, [], []);
    expect(result.sections.find((s) => s.key === "property")!.percent).toBe(100);
  });
});

describe("completeness — overall and blockers", () => {
  it("never reads 100% while a section is empty", () => {
    const result = computeCompleteness(rentContract(), [], []);
    expect(result.overall).toBeLessThan(100);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("reports 100% and no blockers when everything is filled", () => {
    const result = computeCompleteness(
      fullyFilledRent(),
      [party("landlord"), party("tenant")],
      allRequiredDocs("property_rent")
    );
    expect(result.overall).toBe(100);
    expect(isReadyForReview(result)).toBe(true);
  });

  it("names the first incomplete step for resume", () => {
    const result = computeCompleteness(rentContract(), [], []);
    expect(firstIncompleteStepId(result)).toBe("parties");
  });

  it("blocks review while documents are missing", () => {
    const result = computeCompleteness(
      fullyFilledRent(),
      [party("landlord"), party("tenant")],
      []
    );
    expect(isReadyForReview(result)).toBe(false);
    expect(result.blockers.some((b) => b.sectionKey === "documents")).toBe(true);
  });
});
