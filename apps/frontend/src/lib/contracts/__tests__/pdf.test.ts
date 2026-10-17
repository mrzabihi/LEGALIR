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

/** The PDF text layer, one entry per page (logical order, as pdfjs reads it). */
async function extractPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ")
    );
  }
  return pages;
}

/** Extract the PDF text layer (logical order, as pdfjs reads it). */
async function extractText(bytes: Uint8Array): Promise<string> {
  return (await extractPageTexts(bytes)).join("\n");
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
// The letterhead and the printed identity — §6 of the brief
// ============================================================
// The printed PDF is the print output; a browser screenshot is not. So the
// letterhead, the running head and the page numbering are asserted against
// the PDF's own text layer, per page.

describe("renderContractPdf — letterhead, running head and page numbers", () => {
  it("prints the identifying block on page 1 and repeats it on pages 2+", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
    });
    const pages = await extractPageTexts(bytes);
    const norm = (s: string) => s.replace(/\u200c/g, " ").replace(/\s+/g, " ");

    // Page 1: type, reference code, issue date and version label — the
    // identification group the brief requires at the top-left.
    expect(norm(pages[0]!)).toContain(norm("اجاره‌نامه"));
    expect(pages[0]).toContain("RENT-1405-0001");
    expect(norm(pages[0]!)).toContain(norm("تاریخ صدور"));
    // The version line reads across a bidi boundary (Persian label, Latin
    // template version, Persian digits), so assert its parts, not a phrase.
    expect(norm(pages[0]!)).toContain(norm("نسخه قالب"));
    expect(pages[0]).toContain("1.0.0");
    // The title is on the sheet, and a real clause reached the body.
    expect(norm(pages[0]!)).toContain(norm("اجاره‌نامه آپارتمان"));
    expect(norm(pages[0]!)).toContain(norm("طرفین قرارداد"));

    // Every page carries «صفحه N از M» with the true total. A mixed Persian +
    // Persian-digit line may be reported by pdfjs in either logical or visual
    // order, so both readings are accepted — the point is that the true page
    // count is printed on every page, never a stale "1 of 1".
    const total = pages.length;
    const faDigits = (n: number) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
    pages.forEach((text, index) => {
      const logical = norm(`صفحه ${faDigits(index + 1)} از ${faDigits(total)}`);
      const visual = norm(`${faDigits(total)} از ${faDigits(index + 1)} صفحه`);
      expect(
        norm(text).includes(logical) || norm(text).includes(visual),
        `page ${index + 1} page number`
      ).toBe(true);
    });

    // Pages 2+ repeat the identity in the running head, so a loose sheet is
    // always traceable to its contract and revision.
    for (const [index, text] of pages.slice(1).entries()) {
      expect(text, `running head on page ${index + 2}`).toContain("RENT-1405-0001");
      expect(norm(text), `running head on page ${index + 2}`).toContain(norm("نسخه قالب"));
    }

    // No page is blank — a print defect the brief calls out explicitly.
    for (const [index, text] of pages.entries()) {
      expect(text.trim().length, `page ${index + 1} is blank`).toBeGreaterThan(40);
    }
  });
});

// ============================================================
// The schema-driven path — a non-property type reaches the same PDF
// ============================================================
// `property_rent` is rendered by the bespoke builder; employment is
// rendered by `genericClauses` from the registry field descriptors and
// declares five semantic tables. Both must produce the same printable
// contract, so this asserts the server PDF, not a browser screenshot.

describe("renderContractPdf — a schema-driven contract (employment)", () => {
  function employmentContract(): PropertyContract {
    const def = getContractDefinition("employment");
    return {
      id: "ct-emp",
      userId: "user-A",
      domain: "employment",
      type: "employment",
      typeFa: def.typeFa,
      title: "قرارداد کار کارشناس حسابداری",
      state: "finalized",
      currentStep: "review",
      progress: 100,
      referenceCode: "EMPLOY-1405-0007",
      publicVerificationId: "pub-emp",
      templateVersion: def.templateVersion,
      schemaVersion: 1,
      finalVersionId: "ver-emp",
      finalizedAt: "2026-08-10T10:00:00Z",
      data: {
        schemaVersion: 1,
        values: {
          jobTitle: "کارشناس حسابداری",
          jobDuties: "ثبت اسناد مالی و تهیهٔ گزارش‌های دوره‌ای.",
          jobWorkplace: "تهران",
          contractType: "definite",
          startDate: "2026-10-01",
          endDate: "2027-09-30",
          baseSalary: { amount: 250_000_000, currency: "IRR" },
          wagePeriod: "monthly",
          weeklyHours: 44,
          workSchedule: "شنبه تا چهارشنبه ۸ تا ۱۷",
          socialInsurance: "yes",
          mutualObligations: "رعایت مقررات کارگاه و حفظ اسرار تجاری.",
          governingLaw: "iran",
        },
        customClauses: [
          {
            id: "cc-emp",
            kind: "change_request",
            title: "افزایش مرخصی",
            body: "پیشنهاد افزایش مرخصی به ۳۰ روز.",
            sectionRef: "hours",
            createdAt: "2026-08-01T00:00:00Z",
          },
        ],
        supplementary: { notes: "تغییر شرح وظایف با الحاقیهٔ کتبی." },
      },
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-10T10:00:00Z",
    } as unknown as PropertyContract;
  }

  function employmentVersion(): PropertyContractVersion {
    const c = employmentContract();
    const snapshot: ContractVersionSnapshot = {
      data: c.data,
      parties: [
        { id: "pty-e1", role: "employer", identity: { firstName: "مریم", lastName: "محمدی", nationalId: "0012345678" } },
        { id: "pty-e2", role: "employee", identity: { firstName: "رضا", lastName: "کریمی", nationalId: "0087654321" } },
      ] as unknown as ContractParty[],
      payments: [],
      documentsManifest: [],
    };
    return {
      id: "ver-emp",
      contractId: "ct-emp",
      versionNumber: 1,
      templateVersion: "employment-v1.0.0",
      documentHash: "b".repeat(64),
      snapshot,
      createdBy: "user-A",
      createdAt: "2026-08-10T10:00:00Z",
    } as PropertyContractVersion;
  }

  it("prints the generic clauses, the table headers and the non-operative annex", async () => {
    const bytes = await renderContractPdf({
      contract: employmentContract(),
      version: employmentVersion(),
      baseUrl: "https://legalir.example",
    });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");

    const pages = await extractPageTexts(bytes);
    const text = pages.join("\n");
    const norm = (s: string) => s.replace(/\u200c/g, " ").replace(/\s+/g, " ");

    // The identifying group and the clause body both reached the sheet.
    expect(pages[0]).toContain("EMPLOY-1405-0007");
    expect(norm(text)).toContain(norm("طرفین قرارداد"));
    expect(norm(text)).toContain(norm("کارشناس حسابداری"));

    // A declared table's headers are printed — the answer is not a
    // free-text paragraph. Both header cells of the wages table must exist.
    // (pdfjs splits the «هٔ» of «نحوهٔ» across two runs, so the caption is
    // matched on the stable part; the second header is a single run.)
    expect(norm(text)).toContain(norm("حقوق، مزایا و نحو"));
    expect(norm(text)).toContain(norm("مبلغ / ترتیب"));

    // A requested change never prints as an operative term; it lands in
    // the labelled non-operative annex. («لا» is extracted as «ال» by the
    // shaper, so match the unambiguous tail of the heading.)
    expect(norm(text)).toContain(norm("تغییرات درخواستی"));

    // No blank page.
    for (const [index, page] of pages.entries()) {
      expect(page.trim().length, `page ${index + 1} is blank`).toBeGreaterThan(40);
    }
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
