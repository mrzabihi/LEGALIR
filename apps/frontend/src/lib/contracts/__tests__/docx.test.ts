// ============================================================
// LEGALIR — Contract Word (.docx) renderer tests
// ============================================================
// The .docx must be a structurally valid OOXML package (a ZIP whose
// first entry is [Content_Types].xml and which carries word/document.xml),
// must render from the IMMUTABLE snapshot, and must be deterministic.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractParty,
  ContractVersionSnapshot,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import { renderContractDocx } from "../docx";
import { getContractDefinition } from "../registry";

/** A complete rent contract built from the real registry defaults. */
function rentData() {
  return getContractDefinition("property_rent").createDefaultData("apartment");
}

function contract(overrides: Partial<PropertyContract> = {}): PropertyContract {
  return {
    id: "ct-1",
    userId: "user-A",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    title: "اجاره‌نامه آپارتمان",
    state: "finalized",
    currentStep: "review",
    progress: 100,
    referenceCode: "RENT-1405-0001",
    publicVerificationId: "pub-abc",
    finalVersionId: "ver-1",
    finalizedAt: "2026-08-10T10:00:00Z",
    data: rentData(),
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-10T10:00:00Z",
    ...overrides,
  } as PropertyContract;
}

function version(): PropertyContractVersion {
  const snapshot: ContractVersionSnapshot = {
    data: contract().data,
    parties: [
      { id: "pty-1", role: "landlord", identity: { firstName: "مریم", lastName: "محمدی", nationalId: "0012345678" } },
      { id: "pty-2", role: "tenant", identity: { firstName: "رضا", lastName: "کریمی", nationalId: "0087654321" } },
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

/** Read the ZIP local-file-header signature at offset 0. */
function signature(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

/** Decode the whole archive as latin1 to search for entry names. */
function asText(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

describe("renderContractDocx", () => {
  it("produces a ZIP archive (PK\\x03\\x04 signature)", () => {
    const bytes = renderContractDocx({ contract: contract(), version: version() });
    expect(signature(bytes)).toBe(0x04034b50);
  });

  it("contains the required OOXML parts", () => {
    const text = asText(renderContractDocx({ contract: contract(), version: version() }));
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("_rels/.rels");
    expect(text).toContain("word/document.xml");
    expect(text).toContain("word/styles.xml");
  });

  it("declares the WordprocessingML content type", () => {
    const text = asText(renderContractDocx({ contract: contract(), version: version() }));
    expect(text).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    );
  });

  it("renders the reference code and document hash", () => {
    const text = asText(renderContractDocx({ contract: contract(), version: version() }));
    expect(text).toContain("RENT-1405-0001");
    expect(text).toContain("a".repeat(64));
  });

  it("marks the body right-to-left", () => {
    const text = asText(renderContractDocx({ contract: contract(), version: version() }));
    expect(text).toContain("<w:bidi/>");
    expect(text).toContain("<w:rtl/>");
  });

  it("is deterministic — identical input yields identical bytes", () => {
    const a = renderContractDocx({ contract: contract(), version: version() });
    const b = renderContractDocx({ contract: contract(), version: version() });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("escapes XML metacharacters in user-supplied text", () => {
    const c = contract({ title: "قرارداد <A> & \"B\"" });
    const text = asText(renderContractDocx({ contract: c, version: version() }));
    expect(text).toContain("&lt;A&gt;");
    expect(text).toContain("&amp;");
    expect(text).not.toContain("<A>");
  });
});
