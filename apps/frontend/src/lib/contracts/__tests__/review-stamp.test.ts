// ============================================================
// LEGALIR — Review stamp vs. draft watermark (§7)
// ============================================================
// The blue «لیـــــــگالیر - بررسی شد» stamp may appear ONLY on a version
// carrying a valid bound admin approval. Anything else is an unapproved
// draft and must instead carry the «پیش‌نویس ـ تأییدنشده» watermark. This
// pins that rule at the renderer level, so a future change can never let an
// unapproved document masquerade as reviewed.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractParty,
  ContractVersionSnapshot,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import { renderContractDocx } from "../docx";
import { getContractDefinition } from "../registry";

function rentData() {
  return getContractDefinition("property_rent").createDefaultData("apartment");
}

function contract(): PropertyContract {
  return {
    id: "ct-1",
    userId: "user-A",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    title: "اجاره‌نامه آپارتمان",
    state: "SIGNED",
    currentStep: "review",
    progress: 100,
    referenceCode: "RENT-1405-0001",
    publicVerificationId: "pub-abc",
    finalVersionId: null,
    finalizedAt: null,
    data: rentData(),
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-10T10:00:00Z",
  } as unknown as PropertyContract;
}

function version(): PropertyContractVersion {
  const snapshot: ContractVersionSnapshot = {
    data: contract().data,
    parties: [
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
    ] as unknown as ContractParty[],
    payments: [],
    documentsManifest: [],
  };
  return {
    id: "ver-1",
    contractId: "ct-1",
    versionNumber: 1,
    templateVersion: "1.0.0",
    documentHash: "a".repeat(64),
    snapshot,
    createdBy: "user-A",
    createdAt: "2026-08-10T10:00:00Z",
  } as PropertyContractVersion;
}

/** Decode the archive; the XML parts are valid UTF-8 so the Persian text survives. */
function asText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

describe("the review stamp is drawn only on an approved version", () => {
  it("an APPROVED version carries the exact stamp text and the blue ink colour", () => {
    const text = asText(
      renderContractDocx({
        contract: contract(),
        version: version(),
        stamp: {
          applied: true,
          reviewId: "arev-1",
          reviewDateIso: "2026-08-11T00:00:00.000Z",
          reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
          reviewerInitials: "ز.م",
        },
      })
    );
    expect(text).toContain(CONTRACT_REVIEW_STAMP_TEXT);
    expect(text).toContain("1C4E9C"); // the blue stamp ink
    expect(text).not.toContain(CONTRACT_DRAFT_WATERMARK_FA);
    expect(text).not.toContain("A0A0A8"); // no gray watermark on an approved doc
  });

  it("an UNAPPROVED version carries the draft watermark and NEVER the stamp", () => {
    const text = asText(
      renderContractDocx({
        contract: contract(),
        version: version(),
        stamp: { applied: false },
      })
    );
    expect(text).toContain(CONTRACT_DRAFT_WATERMARK_FA);
    expect(text).toContain("A0A0A8"); // the gray watermark ink
    expect(text).not.toContain(CONTRACT_REVIEW_STAMP_TEXT);
    expect(text).not.toContain("1C4E9C");
  });

  it("a missing stamp argument is treated as an unapproved draft", () => {
    const text = asText(renderContractDocx({ contract: contract(), version: version() }));
    expect(text).toContain(CONTRACT_DRAFT_WATERMARK_FA);
    expect(text).not.toContain(CONTRACT_REVIEW_STAMP_TEXT);
  });
});
