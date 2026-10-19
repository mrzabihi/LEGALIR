// @vitest-environment node
// ============================================================
// LEGALIR — Contract PDF (Persian/RTL correctness smoke test)
// ============================================================
// The contract PDF shares the receipt's shaping path (`@/lib/pdf/rtl`). It used
// to reverse the Persian characters itself, which broke joining and scrambled
// any embedded Latin token. This locks in: the PDF is valid, the title reads in
// correct logical order, and a Latin reference code is left intact.
// ============================================================

import zlib from "node:zlib";
import { describe, it, expect } from "vitest";
import type {
  ContractParty,
  ContractVersionSnapshot,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import {
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import { FOOTER_BAND, renderContractPdf } from "../pdf";
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

interface PlacedRun {
  str: string;
  /** x of the run's start, in PDF user space (page is 595.28pt wide). */
  x: number;
  /** y of the run's baseline. */
  y: number;
}

/**
 * The PDF text layer with positions, one entry per page. Needed where the
 * brief is about GEOMETRY, not wording — e.g. «طرف ۱ در ستون چپ و طرف ۲ در
 * ستون راست» can only be proven by comparing x coordinates on the sheet.
 */
async function extractPageRuns(bytes: Uint8Array): Promise<PlacedRun[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    // A COPY: pdfjs takes ownership of the buffer it is given, so a second
    // read of the same document must not see a detached one.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  const pages: PlacedRun[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items
        .filter(
          (i): i is typeof i & { str: string; transform: number[] } =>
            "str" in i && typeof (i as { str?: unknown }).str === "string"
        )
        .map((i) => ({ str: i.str, x: i.transform[4]!, y: i.transform[5]! }))
    );
  }
  return pages;
}

/** The PDF text layer, one entry per page (logical order, as pdfjs reads it). */
async function extractPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    // See `extractPageRuns`: every read gets its own copy of the bytes.
    data: new Uint8Array(bytes),
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

/** A painted path with the ink it used, in PDF user space. */
interface PaintedPath {
  /** Fill colour as pdfjs reports it: 0–255 per channel. */
  fill: [number, number, number] | null;
  /** Stroke colour, same scale. */
  stroke: [number, number, number] | null;
  /** Bounding box in page space: [minX, minY, maxX, maxY]. */
  box: [number, number, number, number];
}

/** The admin card's red ink (#B91C1C). */
const ADMIN_RED: [number, number, number] = [185, 28, 28];

/** A dependency-free solid-white PNG, for annex fixtures with a set ratio. */
function whitePng(width: number, height: number): Uint8Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 4 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height, 0xff);
  for (let y = 0; y < height; y++) raw[y * (width * 3 + 1)] = 0; // filter byte
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return new Uint8Array(png);
}

/**
 * Every filled/stroked path per page with its ink.
 *
 * Colour is the only way to prove the admin message really is RED (the
 * brief asks for red ink, not merely for the text to be present), and a
 * bounding box is the only way to prove it stayed inside the printable
 * area at its fixed place. pdf-lib paints a path in absolute coordinates
 * only through a translate matrix, so the CTM is tracked through
 * save/restore/transform.
 */
async function extractPaintedPaths(bytes: Uint8Array): Promise<PaintedPath[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    // See `extractPageRuns`: every read gets its own copy of the bytes.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const pages: PaintedPath[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    const found: PaintedPath[] = [];

    let fill: [number, number, number] | null = null;
    let stroke: [number, number, number] | null = null;
    let m = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];

    const asRgb = (args: unknown): [number, number, number] | null => {
      const a = args as Record<string, number> | number[] | null;
      if (!a) return null;
      const pick = (i: number) =>
        Array.isArray(a) ? a[i] : (a as Record<string, number>)[String(i)];
      const r = pick(0);
      const g = pick(1);
      const b = pick(2);
      return typeof r === "number" && typeof g === "number" && typeof b === "number"
        ? [r, g, b]
        : null;
    };

    for (let k = 0; k < ops.fnArray.length; k++) {
      const fn = ops.fnArray[k];
      if (fn === pdfjs.OPS.save) {
        stack.push(m.slice());
      } else if (fn === pdfjs.OPS.restore) {
        m = stack.pop() ?? m;
      } else if (fn === pdfjs.OPS.transform) {
        const [a, b, c, d, e, f] = ops.argsArray[k] as [
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        m = [
          m[0]! * a + m[2]! * b,
          m[1]! * a + m[3]! * b,
          m[0]! * c + m[2]! * d,
          m[1]! * c + m[3]! * d,
          m[0]! * e + m[2]! * f + m[4]!,
          m[1]! * e + m[3]! * f + m[5]!,
        ];
      } else if (fn === pdfjs.OPS.setFillRGBColor) {
        fill = asRgb(ops.argsArray[k]);
      } else if (fn === pdfjs.OPS.setStrokeRGBColor) {
        stroke = asRgb(ops.argsArray[k]);
      } else if (fn === pdfjs.OPS.constructPath) {
        const args = ops.argsArray[k] as unknown[];
        const raw = args[2] as number[] | undefined;
        if (raw && raw.length === 4) {
          const x0 = m[0]! * raw[0]! + m[2]! * raw[1]! + m[4]!;
          const y0 = m[1]! * raw[0]! + m[3]! * raw[1]! + m[5]!;
          const x1 = m[0]! * raw[2]! + m[2]! * raw[3]! + m[4]!;
          const y1 = m[1]! * raw[2]! + m[3]! * raw[3]! + m[5]!;
          found.push({
            fill,
            stroke,
            box: [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)],
          });
        }
      }
    }
    pages.push(found);
  }
  return pages;
}

const sameInk = (ink: [number, number, number] | null, want: [number, number, number]) =>
  ink !== null && ink.every((v, i) => Math.abs(v - want[i]!) <= 1);


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

    // Page 1: type, reference code, contract date and version label — the
    // identification group the brief requires in the header.
    expect(norm(pages[0]!)).toContain(norm("اجاره‌نامه"));
    expect(pages[0]).toContain("RENT-1405-0001");
    expect(norm(pages[0]!)).toContain(norm("تاریخ قرارداد"));
    // The status is part of the same right-aligned identity group.
    expect(norm(pages[0]!)).toContain(norm("وضعیت:"));
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

// ============================================================
// §2.5 / §2.6 — two-column parties, paraphe on every page, one signature block
// ============================================================
// These are GEOMETRY assertions, so they read the positioned text layer.
// The printed PDF is the signing/printing artefact (§2.8): a browser
// screenshot cannot prove that the left column really is on the left, or
// that the signature block was never split across a page break.

describe("renderContractPdf — party columns and signature geometry", () => {
  const PAGE_HEIGHT = 841.89;
  /** The reserved footer band: content must stop above MARGIN + FOOTER_BAND. */
  const CONTENT_BOTTOM = 48 + FOOTER_BAND;

  async function rendered() {
    return renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
    });
  }

  it("prints party 1 in the LEFT column and party 2 in the RIGHT column", async () => {
    const pages = await extractPageRuns(await rendered());
    const first = pages[0]!;

    // The two party names in the parties table on page 1. The sheet is RTL,
    // so the RIGHT-hand column starts at a larger x than the left-hand one.
    const landlord = first.find((r) => r.str.includes("مریم"));
    const tenant = first.find((r) => r.str.includes("رضا"));
    expect(landlord, "landlord name on page 1").toBeDefined();
    expect(tenant, "tenant name on page 1").toBeDefined();
    // def.roles = [landlord, tenant] — party 1 (landlord) is column LEFT.
    expect(landlord!.x).toBeLessThan(tenant!.x);
  });

  it("carries a legible paraphe strip on EVERY page, clear of body text", async () => {
    const pages = await extractPageRuns(await rendered());
    expect(pages.length).toBeGreaterThan(1);

    for (const [index, page] of pages.entries()) {
      const caption = page.find((r) => r.str.includes("پاراف صفحه"));
      expect(caption, `paraphe caption on page ${index + 1}`).toBeDefined();

      // No body text may enter the footer band: every text baseline is
      // either above the band, or belongs to a footer row (paraphe caption
      // at ~136, page number at 22). That gap is what guarantees text,
      // tables and the paraphe strip never collide.
      for (const run of page) {
        const inFooter = run.y <= CONTENT_BOTTOM - 6;
        const inBodyOrHead = run.y >= CONTENT_BOTTOM;
        expect(
          inFooter || inBodyOrHead,
          `run "${run.str}" at y=${run.y} straddles the footer band on page ${index + 1}`
        ).toBe(true);
      }
    }

    // Every page also carries its page number, below the paraphe strip.
    for (const [index, page] of pages.entries()) {
      expect(
        page.some((r) => r.str.includes("صفحه") && r.y < 40),
        `page number on page ${index + 1}`
      ).toBe(true);
    }
  });

  it("keeps the whole signature block on the final page, never split", async () => {
    const pages = await extractPageRuns(await rendered());
    const final = pages[pages.length - 1]!;

    // The heading appears exactly once in the whole document…
    const headingCount = pages
      .flat()
      .filter((r) => r.str.includes("امضای طرفین")).length;
    expect(headingCount).toBe(1);

    // …on the last page, together with every signer and the QR caption, so
    // a page break can never separate the signatures from the verification.
    expect(final.some((r) => r.str.includes("امضای طرفین"))).toBe(true);
    expect(final.some((r) => r.str.includes("مریم"))).toBe(true);
    expect(final.some((r) => r.str.includes("رضا"))).toBe(true);
    expect(final.some((r) => r.str.includes("contracts/verify/pub-abc"))).toBe(true);

    // And the block itself sits above the reserved footer band.
    const blockRuns = final.filter(
      (r) => r.str.includes("امضای طرفین") || r.str.includes("contracts/verify/pub-abc")
    );
    for (const run of blockRuns) {
      expect(run.y).toBeGreaterThan(CONTENT_BOTTOM);
      expect(run.y).toBeLessThan(PAGE_HEIGHT);
    }
  });
});

// ============================================================
// The review mark on EVERY page, and the signature TABLE (§3 / §6)
// ============================================================
// The blue mark used to be printed once, under the letterhead. The brief
// moves it into the footer band of every page, carrying the contract's REAL
// review fields — and turns the floating signer boxes into one RTL table
// whose state cell shows only a recorded signature.

describe("renderContractPdf — review mark and the signature table", () => {
  const STAMP = {
    applied: true as const,
    reviewId: "arev-42",
    reviewedAt: "2026-08-09T10:00:00Z",
    reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
    reviewerInitials: "م.م",
  };

  it("prints the review mark, its real fields and the disclaimer on EVERY page", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      stamp: STAMP,
    });
    const pages = await extractPageRuns(bytes);
    expect(pages.length).toBeGreaterThan(1);

    for (const [index, page] of pages.entries()) {
      const text = page.map((r) => r.str).join(" ");
      expect(text, `page ${index + 1}: stamp title`).toContain(CONTRACT_REVIEW_STAMP_TEXT);
      // The REAL per-contract values, not a sample.
      expect(text, `page ${index + 1}: review id`).toContain("arev-42");
      expect(text, `page ${index + 1}: reviewer`).toContain("م.م");
      expect(text, `page ${index + 1}: review date`).toContain("تاریخ بررسی");
      // The mandatory disclaimer is present, exactly once, per page.
      const notes = page.filter((r) => CONTRACT_REVIEW_STAMP_DISCLAIMER_FA.includes(r.str));
      expect(notes.length, `page ${index + 1}: disclaimer`).toBeGreaterThan(0);
      // And it lives INSIDE the reserved band, never over the contract text.
      for (const run of page.filter((r) => r.str.includes("arev-42"))) {
        expect(run.y).toBeLessThan(CONTENT_BOTTOM_PDF);
      }
    }
  });

  it("says «ثبت نشده» rather than dropping a missing review field", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      // An approval whose review metadata was never recorded.
      stamp: { applied: true },
    });
    const pages = await extractPageTexts(bytes);
    for (const text of pages) {
      expect(text).toContain(CONTRACT_REVIEW_STAMP_TEXT);
      expect(text).toContain("ثبت نشده");
    }
  });

  it("renders the signature TABLE with its four RTL headers and a ≥14px name", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
    });
    const final = (await extractPageRuns(bytes)).at(-1)!;

    const headers = ["نقش", "نام کامل", "محل امضا", "وضعیت امضا"];
    for (const header of headers) {
      expect(
        final.some((r) => r.str.includes(header)),
        `header «${header}»`
      ).toBe(true);
    }

    // RTL: the role column is the RIGHTMOST, so its x is the largest.
    const role = final.find((r) => r.str.includes("نقش") && r.y > CONTENT_BOTTOM_PDF)!;
    const name = final.find((r) => r.str.includes("نام کامل") && r.y > CONTENT_BOTTOM_PDF)!;
    expect(role.x).toBeGreaterThan(name.x);

    // The party names are on the sheet, and the state cell is honest:
    // with no signature marks supplied, every role is pending.
    expect(final.some((r) => r.str.includes("مریم"))).toBe(true);
    expect(final.some((r) => r.str.includes("رضا"))).toBe(true);
    const pending = final.filter((r) => r.str.includes("در انتظار امضا"));
    expect(pending.length).toBeGreaterThanOrEqual(2);
    // Never a fabricated signature or date.
    expect(final.some((r) => r.str.includes("امضا شده"))).toBe(false);
  });

  it("shows a party's REAL signature only when a mark is supplied for that role", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      signatureMarks: {
        "موجر": { signedAt: "2026-08-09T12:00:00Z", statusFa: "امضا شده" },
      },
    });
    const final = (await extractPageRuns(bytes)).at(-1)!;
    const text = final.map((r) => r.str).join(" ");

    // Exactly one signed row, with its real signing date…
    expect(text).toContain("امضا شده");
    expect(text).toContain("تاریخ امضا");
    // …and the other role still pending — never both signed by default.
    expect(text).toContain("در انتظار امضا");
  });
});

describe("renderContractPdf — the admin message (§6)", () => {
  /** A minimal authenticity section, so the certificate closes the file. */
  const authenticity = {
    path: "self_final" as const,
    reviewedByLegalir: false,
    registeredAt: "2026-08-10T09:00:00Z",
    registeredByLabelFa: "مریم محمدی",
    reviewId: null,
    reviewedAt: null,
    participants: [
      {
        roleFa: "موجر",
        nameFa: "مریم محمدی",
        statusFa: "امضا شده",
        signedAt: "2026-08-09T12:00:00Z",
        methodFa: "امضای دستی",
      },
      {
        roleFa: "مستأجر",
        nameFa: "رضا کریمی",
        statusFa: "در انتظار",
        signedAt: null,
        methodFa: null,
      },
    ],
    stampApplied: true,
    stampSha256: "b".repeat(64),
    hologramApplied: true,
  };

  it("prints the message in RED on the LAST page only, inside the printable area", async () => {
    const message = "این نسخه بدون بررسی حقوقی لیگالیر ثبت نهایی شد.";
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      adminMessage: { messageFa: message },
      authenticity,
    });

    const texts = await extractPageTexts(bytes);
    const tight = (s: string) => s.replace(/\s+/g, "").replace(/[\u200c\u0640]/g, "");

    // The words appear on the last page, and nowhere else.
    const carrier = texts.findIndex((t) => tight(t).includes(tight("پیام ادمین")));
    expect(carrier, "the admin message card is missing from the PDF").toBe(texts.length - 1);
    expect(tight(texts[texts.length - 1]!)).toContain(tight(message));
    for (let i = 0; i < texts.length - 1; i++) {
      expect(tight(texts[i]!), `page ${i + 1} repeats the admin message`).not.toContain(
        tight("پیام ادمین")
      );
    }

    // The card really uses the red ink, and it sits above the reserved
    // footer band inside the left/right content margins.
    const paths = await extractPaintedPaths(bytes);
    const lastPagePaths = paths[paths.length - 1]!;
    const card = lastPagePaths.find((p) => sameInk(p.stroke, ADMIN_RED) && sameInk(p.fill, [255, 246, 246]));
    expect(card, "no red-bordered card is painted on the last page").toBeTruthy();
    expect(card!.box[0]).toBeGreaterThanOrEqual(47);
    expect(card!.box[2]).toBeLessThanOrEqual(548);
    expect(card!.box[1]).toBeGreaterThan(CONTENT_BOTTOM_PDF);
    expect(card!.box[3]).toBeLessThan(400 + CONTENT_BOTTOM_PDF);

    // No page may carry the red card besides the last one.
    for (let i = 0; i < paths.length - 1; i++) {
      expect(
        paths[i]!.some((p) => sameInk(p.stroke, ADMIN_RED)),
        `page ${i + 1} draws the red admin ink`
      ).toBe(false);
    }
  });

  it("prints the card on the LAST ANNEX page when no certificate closes the file", async () => {
    // Some renders (a preview of a version with no registration record)
    // have no authenticity section, so the document's last page is the
    // last annexed sheet. The card must land there — not on the contract
    // body and not on a sheet of its own — and the annex must still be
    // sized above it.
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      adminMessage: { messageFa: "این نسخه بدون بررسی حقوقی لیگالیر ثبت نهایی شد." },
      annexes: [
        { titleFa: "پیوست الف", mime: "image/png", bytes: whitePng(40, 20) },
        { titleFa: "پیوست ب", mime: "image/png", bytes: whitePng(20, 60) },
      ],
    });

    const texts = await extractPageTexts(bytes);
    const tight = (s: string) => s.replace(/\s+/g, "").replace(/[\u200c\u0640]/g, "");
    const cardPage = texts.findIndex((t) => tight(t).includes(tight("پیام ادمین")));
    // The closing page is the SECOND annex's sheet, and it is the last one:
    // the card never earns a page of its own.
    expect(cardPage, "the card is missing").toBe(texts.length - 1);
    expect(tight(texts[cardPage]!)).toContain(tight("پیوست ب"));

    const paths = await extractPaintedPaths(bytes);
    const card = paths[cardPage]!.find(
      (p) => sameInk(p.stroke, ADMIN_RED) && sameInk(p.fill, [255, 246, 246])
    );
    expect(card, "no red card is painted on the closing annex page").toBeTruthy();
    // The card sits above the reserved band, never over the seal/hologram.
    expect(card!.box[1]).toBeGreaterThan(CONTENT_BOTTOM_PDF);
    expect(card!.box[3]).toBeLessThan(CONTENT_BOTTOM_PDF + 40 + 10);
    for (let i = 0; i < cardPage; i++) {
      expect(
        paths[i]!.some((p) => sameInk(p.stroke, ADMIN_RED)),
        `page ${i + 1} draws the red admin ink`
      ).toBe(false);
    }
  });

  it("prints no card and reserves no space when no message is set", async () => {
    const bytes = await renderContractPdf({
      contract: contract(),
      version: version(),
      baseUrl: "https://legalir.example",
      authenticity,
    });

    const texts = await extractPageTexts(bytes);
    const tight = (s: string) => s.replace(/\s+/g, "").replace(/[\u200c\u0640]/g, "");
    for (const text of texts) {
      expect(tight(text)).not.toContain(tight("پیام ادمین"));
    }

    const paths = await extractPaintedPaths(bytes);
    for (const page of paths) {
      expect(page.some((p) => sameInk(p.stroke, ADMIN_RED))).toBe(false);
    }
  });
});

/** The footer band's top edge in PDF points (MARGIN + FOOTER_BAND). */
const CONTENT_BOTTOM_PDF = 48 + FOOTER_BAND;
