// @vitest-environment node
// ============================================================
// LEGALIR — Contract PDF (Persian/RTL correctness smoke test)
// ============================================================
// The contract PDF shares the receipt's shaping path (`@/lib/pdf/rtl`). It used
// to reverse the Persian characters itself, which broke joining and scrambled
// any embedded Latin token. This locks in: the PDF is valid, the title reads in
// correct logical order, and a Latin reference code is left intact.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractParty,
  ContractVersionSnapshot,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import { renderContractPdf } from "../pdf";
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
  } as unknown as PropertyContract;
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

/** Extract the PDF text layer (logical order, as pdfjs reads it). */
async function extractText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ") + "\n";
  }
  return out;
}

describe("renderContractPdf — Persian shaping", () => {
  it("renders a valid PDF with the Persian title in correct logical order", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
    });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const text = await extractText(bytes);
    // pdfjs renders ZWNJ (نیم‌فاصله) as a plain space on extraction, so compare
    // with ZWNJ folded to a space on both sides.
    const norm = (s: string) => s.replace(/\u200c/g, " ").replace(/\s+/g, " ");
    // Title reads forward (not reversed); the RTL run was reordered to visual
    // order and pdfjs applies bidi on read, so the logical phrase is intact.
    expect(norm(text)).toContain(norm("اجاره‌نامه آپارتمان"));
    // A Latin reference code embedded in Persian text is never scrambled.
    expect(text).toContain("RENT-1405-0001");
    // A real clause heading is present, proving body text rendered.
    expect(text).toContain("طرفین قرارداد");
  });
});

// ============================================================
// The official LEGALIR stamp — the real PNG is drawn on the document
// ============================================================
// The stamp master is drawn ONLY when the renderer is told the approved
// hash matches the master bytes on disk (the two-gate rule lives in the
// callers; here we prove the renderer paints it and refuses a foreign mark).
// This spec runs at the real cwd, so the bundled font + the private stamp
// asset both resolve.

/** SHA-256 of the committed stamp master (apps/frontend/assets/legalir). */
const REAL_STAMP_SHA256 =
  "129352b0ba24626b82d8b929d2df871251d96f1c88d920bff16fdf49e449e1c8";

describe("renderContractPdf — the official PNG stamp", () => {
  it("draws the real master when the sha matches, and falls back when it does not", async () => {
    const withOfficial = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      stamp: {
        applied: true,
        reviewedAt: "2026-08-09T10:00:00Z",
        reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
        reviewerInitials: "م.م",
        officialStamp: { sha256: REAL_STAMP_SHA256, version: "legalir-review-stamp-1" },
      },
    });
    expect(String.fromCharCode(...withOfficial.slice(0, 5))).toBe("%PDF-");

    // A hash that does NOT match the master must NOT draw the image — the
    // renderer falls back to the reviewed text mark, so a foreign or
    // missing asset can never be stamped onto the document.
    const fallback = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      stamp: {
        applied: true,
        reviewedAt: "2026-08-09T10:00:00Z",
        officialStamp: { sha256: "0".repeat(64), version: "legalir-review-stamp-1" },
      },
    });
    expect(String.fromCharCode(...fallback.slice(0, 5))).toBe("%PDF-");
    expect(withOfficial.length).not.toBe(fallback.length);
  });
});
