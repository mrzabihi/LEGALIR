/**
 * ============================================================
 * LEGALIR — the FINAL PDF, verified in its own bytes
 * ============================================================
 * The route tests prove what the server DECIDES. This spec proves what
 * the file a party downloads actually CONTAINS, on a throwaway contract
 * driven through the whole real lifecycle:
 *
 *   §T7  page order — contract pages → annexed pages → authenticity
 *   §T1  annexes in REGISTRATION order, each with its aspect ratio kept
 *   §T2  the uploaded scan drawn in its OWN party's cell, pending rows
 *        saying «در انتظار امضا»
 *   §T3  the 40mm seal + 32mm hologram on EVERY page, hologram leftmost
 *   §6   the admin message in RED on the LAST page only, inside the
 *        printable area, and nothing at all when unset
 *   §2   the authenticity page stating plainly that LEGALIR did not
 *        review the text, and not claiming any external authority
 *
 * Nothing here is mocked: PDFs are produced by the real renderer and
 * read back with pdfjs (operator list + text layer).
 *
 * The spec is self-contained — PNG fixtures are encoded here with zlib,
 * so it introduces no dependency.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const DEV_OTP = "405405";

// ------------------------------------------------------------
// Minimal PNG encoder (no dependency)
// ------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** A solid-colour RGB PNG of the requested size. */
function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Two annexes with DIFFERENT ratios, so "own aspect ratio kept" is a real
// test and not a coincidence; and an unrelated scan ratio, so the scan
// can never be confused with an annex image.
const ANNEX_A = { title: "پیوست الف — پلان ملک", w: 400, h: 200, ratio: 2 };
const ANNEX_B = { title: "پیوست ب — فهرست تحویل", w: 200, h: 600, ratio: 1 / 3 };
const SCAN = { w: 300, h: 120, ratio: 2.5 };

const ADMIN_MESSAGE = "این نسخه بدون بررسی حقوقی لیگالیر ثبت نهایی شد.";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function filledRentData(base: Record<string, unknown>) {
  const money = (toman: number) => ({ amount: toman * 10, currency: "IRR" });
  return {
    ...base,
    address: {
      province: "تهران",
      city: "تهران",
      street: "خیابان ولیعصر",
      alley: "کوچه بهار",
      plaque: "۱۲",
      unit: "۳",
      postalCode: "1234567890",
    },
    deed: {
      deedType: "single",
      deedNumber: "۱۲۳۴۵",
      mainPlaque: "۵۶۷۸",
      subPlaque: "۲",
      registrationDistrict: "منطقه ۳",
      officialArea: 110,
      ownerName: "مریم محمدی",
      deedDate: "2019-05-10",
    },
    general: {
      area: 110,
      buildYear: 1396,
      floor: 3,
      totalFloors: 6,
      bedrooms: 2,
      orientation: "شمالی",
      renovationStatus: "بازسازی‌شده",
      occupancyStatus: "خالی",
    },
    amenities: {
      hasParking: true,
      parkingKind: "exclusive",
      parkingNumber: "۱۲",
      hasStorage: true,
      storageNumber: "۷",
      hasElevator: true,
      hasBalcony: true,
      heating: ["پکیج"],
      cooling: ["کولر گازی"],
      utilities: { water: true, electricity: true, gas: true, telephone: true },
    },
    durations: {
      contractDate: "2026-09-01",
      startDate: "2026-10-01",
      handoverDate: "2026-10-01",
      endDate: "2027-09-30",
      durationMonths: 12,
    },
    terms: {
      agreementKind: "deposit_and_rent",
      securityDeposit: money(500_000_000),
      monthlyRent: money(20_000_000),
      rentDueDay: 5,
      landlordAccount: "IR000000000000000000000000",
      hasLatePenalty: true,
      latePenaltyPeriod: 5,
      latePenaltyAmount: money(2_000_000),
      depositInstalments: false,
    },
    termination: {
      grounds: {
        nonPayment: true,
        latePayment: true,
        unauthorizedUse: true,
        sublet: true,
        propertyDamage: true,
        earlyVacation: true,
        failureToVacate: true,
      },
      evictionPenaltyPeriod: 10,
      evictionPenaltyAmount: money(50_000_000),
      depositReturnTerms: "ودیعه پس از تخلیه و تسویه کامل بازگردانده می‌شود.",
      depositReturnTiming: "حداکثر ۱۰ روز پس از تخلیه",
    },
    handover: {
      items: [
        { key: "walls", labelFa: "دیوارها", state: "intact" },
        { key: "floor", labelFa: "کفپوش", state: "flawed" },
      ],
      meters: [{ key: "electricity", labelFa: "برق", meterNumber: "111222", value: "۱۵۰۰" }],
      keys: [{ key: "main", labelFa: "کلید اصلی", count: 2 }],
      notes: "تحویل در تاریخ توافق‌شده انجام می‌شود.",
    },
    customClauses: [],
    supplementary: { notes: "تمدید قرارداد منوط به توافق کتبی طرفین است." },
  };
}

function rentParties(): Array<Record<string, unknown>> {
  return [
    {
      role: "landlord",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "مریم",
        lastName: "محمدی",
        fatherName: "حسن",
        nationalId: "0012345679",
        mobile: "09120000003",
        address: "تهران، خیابان ولیعصر، کوچه بهار، پلاک ۱۲",
        postalCode: "1234567890",
        birthCertificateNumber: "123",
        birthCertificatePlace: "تهران",
      },
    },
    {
      role: "tenant",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "رضا",
        lastName: "کریمی",
        fatherName: "محمد",
        nationalId: "0087654326",
        mobile: "09120000004",
        address: "کرج، خیابان شهید بهشتی، پلاک ۴",
        postalCode: "3145678901",
        birthCertificateNumber: "456",
        birthCertificatePlace: "کرج",
      },
    },
  ];
}

/** Every employment field answered, so each declared table is populated. */
function employmentData(): Record<string, unknown> {
  const money = (toman: number) => ({ amount: toman * 10, currency: "IRR" });
  return {
    schemaVersion: 1,
    values: {
      jobTitle: "کارشناس حسابداری",
      jobDuties: "ثبت اسناد مالی، تهیهٔ گزارش‌های دوره‌ای و همکاری در بستن حساب‌ها.",
      jobWorkplace: "تهران، خیابان ولیعصر",
      jobDepartment: "واحد مالی",
      jobSupervisor: "مدیر مالی",
      employeeEducation: "کارشناسی حسابداری",
      contractType: "definite",
      startDate: "2026-10-01",
      endDate: "2027-09-30",
      probationMonths: 3,
      probationNote: "دورهٔ آزمایشی طبق توافق طرفین و در چارچوب مقررات قانون کار.",
      baseSalary: money(25_000_000),
      wagePeriod: "monthly",
      paymentDay: 1,
      housingAllowance: money(3_000_000),
      foodAllowance: money(2_000_000),
      childAllowance: money(1_500_000),
      seniorityAllowance: money(1_000_000),
      otherBenefits: "بیمهٔ تکمیلی درمان و پاداش سالانه.",
      weeklyHours: 44,
      dailyHours: 8,
      workSchedule: "شنبه تا چهارشنبه ۸ تا ۱۷ و پنجشنبه ۸ تا ۱۲.",
      restDay: "جمعه",
      annualLeaveDays: 26,
      remoteWork: false,
      socialInsurance: "yes",
      insuranceNumber: "12345678",
      taxWithholding: true,
      payrollObligations: "ارسال لیست بیمه و پرداخت حق بیمه در مهلت مقرر.",
      additionalInsurance: "بیمهٔ عمر و حوادث گروهی.",
      mutualObligations: "رعایت مقررات کارگاه، حفظ اسرار تجاری و انجام وظایف محوله.",
      confidentiality: true,
      nonCompete: false,
      ipOwnership: "employer",
      trainingBond: false,
      specialClauses: "هر شرط دیگر در چارچوب ماده ۱۰ قانون مدنی.",
      terminationTerms: "خاتمهٔ قرارداد مطابق قانون کار و با اطلاع کتبی طرفین.",
      latePenalty: money(1_000_000),
      disputeResolution: "هیئت‌های تشخیص و حل اختلاف ادارهٔ کار.",
      governingLaw: "iran",
    },
    customClauses: [],
    supplementary: { notes: "هرگونه تغییر در شرح وظایف باید به‌صورت الحاقیهٔ کتبی ثبت شود." },
  };
}

function employmentParties(): Array<Record<string, unknown>> {
  return [
    {
      role: "employer",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "مریم",
        lastName: "محمدی",
        fatherName: "حسن",
        nationalId: "0012345679",
        mobile: "09120000003",
        address: "تهران، خیابان ولیعصر، پلاک ۱۲",
        postalCode: "1234567890",
        birthCertificateNumber: "123",
        birthCertificatePlace: "تهران",
      },
    },
    {
      role: "employee",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "رضا",
        lastName: "کریمی",
        fatherName: "محمد",
        nationalId: "0087654326",
        mobile: "09120000004",
        address: "کرج، خیابان شهید بهشتی، پلاک ۴",
        postalCode: "3145678901",
        birthCertificateNumber: "456",
        birthCertificatePlace: "کرج",
      },
      // The wages step names the employee as the payee, so their bank
      // details are a real requirement (banking.employee).
      banking: {
        bankName: "بانک ملت",
        accountNumber: "1234567890",
        iban: "IR000000000000000000000000",
        cardNumber: "6104337812345678",
      },
    },
  ];
}

// ------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------

async function ownerSession(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const body = await res.text();
  const id = (JSON.parse(body) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!id) throw new Error(`login failed: ${res.status()} ${body.slice(0, 300)}`);
  return id;
}

/**
 * Create a contract that can print faithfully, then walk it through
 * «ثبت نهایی» — the unreviewed path — into the signature stage.
 *
 * The annexes are uploaded BEFORE the content is frozen, in a known
 * order, because registration order is exactly what §T1 asserts.
 */
type ContractSeed = {
  type: string;
  title: string;
  /** `propertyKind` is only meaningful for the property family. */
  propertyKind?: string;
  /** The contract's own `data` — merged over the freshly created draft's. */
  buildData: (base: Record<string, unknown>) => Record<string, unknown>;
  parties: Array<Record<string, unknown>>;
  /** Required document categories this type expects. */
  documents: readonly string[];
  /** The role label of the party that signs on PAPER (see §T2). */
  physicalRoleFa: string;
  /** Role label of the party that signs by OTP. */
  otpRoleFa: string;
  /** A fragment of the physically-signing party's name, for the row lookup. */
  physicalNameNeedle: string;
  /** A fragment of the other party's name. */
  otherNameNeedle: string;
};

async function seedReadyToSign(
  request: APIRequestContext,
  sessionId: string,
  seed: ContractSeed
): Promise<{ id: string; referenceCode: string }> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: {
      type: seed.type,
      title: seed.title,
      ...(seed.propertyKind ? { propertyKind: seed.propertyKind } : {}),
    },
  });
  expect(created.ok(), `create failed: ${created.status()}`).toBeTruthy();
  const body = (await created.json()) as { data?: { id?: string; referenceCode?: string } };
  const id = body.data?.id;
  const referenceCode = body.data?.referenceCode;
  if (!id || !referenceCode) throw new Error("create returned no id/referenceCode");

  const detailRes = await request.get(`/api/v1/property-contracts/${id}`, { headers: { cookie } });
  const detail = ((await detailRes.json()) as { data?: { data?: Record<string, unknown> } }).data;
  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { data: seed.buildData(detail?.data ?? {}), currentStep: "review" },
  });
  expect(patched.ok(), `patch failed: ${patched.status()}`).toBeTruthy();

  for (const party of seed.parties) {
    const res = await request.put(`/api/v1/property-contracts/${id}/parties`, {
      headers: { cookie },
      data: party,
    });
    expect(res.ok(), `party failed: ${res.status()}`).toBeTruthy();
  }

  const onePixel = solidPng(1, 1, [255, 255, 255]);
  for (const category of seed.documents) {
    const uploaded = await request.post(`/api/v1/property-contracts/${id}/documents`, {
      headers: { cookie },
      multipart: {
        category,
        file: { name: `${category}.png`, mimeType: "image/png", buffer: onePixel },
      },
    });
    expect(uploaded.ok(), `upload ${category} failed: ${uploaded.status()}`).toBeTruthy();
  }

  // §T1 — registration order. A then B; the PDF must follow this order.
  const annexes: Array<{ title: string; w: number; h: number; rgb: [number, number, number] }> = [
    { ...ANNEX_A, rgb: [220, 232, 220] },
    { ...ANNEX_B, rgb: [232, 224, 200] },
  ];
  for (const annex of annexes) {
    const uploaded = await request.post(`/api/v1/property-contracts/${id}/documents`, {
      headers: { cookie },
      multipart: {
        category: "contract_annex",
        titleFa: annex.title,
        file: {
          name: `${annex.title}.png`,
          mimeType: "image/png",
          buffer: solidPng(annex.w, annex.h, annex.rgb),
        },
      },
    });
    expect(uploaded.ok(), `annex upload failed: ${uploaded.status()}`).toBeTruthy();
  }

  const frozen = await request.post(`/api/v1/property-contracts/${id}/review`, {
    headers: { cookie },
    data: { action: "submit" },
  });
  expect(frozen.ok(), `submit failed: ${frozen.status()} ${await frozen.text()}`).toBeTruthy();

  const registered = await request.post(`/api/v1/property-contracts/${id}/review`, {
    headers: { cookie },
    data: { action: "final_register", acknowledgedUnreviewed: true },
  });
  expect(
    registered.ok(),
    `final_register failed: ${registered.status()} ${await registered.text()}`
  ).toBeTruthy();

  return { id, referenceCode };
}

interface ParticipantRow {
  id: string;
  roleFa: string;
  status: string;
}

async function participantsOf(
  request: APIRequestContext,
  id: string,
  cookie: string
): Promise<ParticipantRow[]> {
  const res = await request.get(`/api/v1/property-contracts/${id}/lifecycle`, {
    headers: { cookie },
  });
  expect(res.ok(), `lifecycle failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as {
    data?: { signatureRequest?: { participants?: ParticipantRow[] } | null };
  };
  return body.data?.signatureRequest?.participants ?? [];
}

// ------------------------------------------------------------
// PDF reading
// ------------------------------------------------------------

const MM_PT = 72 / 25.4;
const SEAL_H = 40 * MM_PT; // 113.4
const HOLO_H = 32 * MM_PT; // 90.7
const MARGIN = 48;
const CONTENT_BOTTOM = MARGIN + 170; // top of the reserved footer band

interface ImageDraw {
  page: number;
  w: number;
  h: number;
  x: number;
  y: number;
  rotated: boolean;
}

interface PdfFacts {
  numPages: number;
  /** Whitespace/ZWNJ-stripped page text. */
  texts: string[];
  images: ImageDraw[];
  /** Pages whose FILL ink is the admin card's red (#B91C1C). */
  redPages: number[];
  /** The red-bordered card's box, if any: [minX, minY, maxX, maxY]. */
  redCardBox: [number, number, number, number] | null;
}

const ADMIN_RED: [number, number, number] = [185, 28, 28];
const sameInk = (ink: number[] | null, want: [number, number, number]) =>
  ink !== null && ink.length >= 3 && want.every((v, i) => Math.abs((ink[i] ?? -999) - v) <= 1);

async function readPdf(bytes: Uint8Array): Promise<PdfFacts> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    // A copy: pdfjs takes ownership of the buffer it is handed.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const texts: string[] = [];
  const images: ImageDraw[] = [];
  const redPages: number[] = [];
  let redCardBox: [number, number, number, number] | null = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    texts.push(
      tc.items
        .map((i) => ("str" in i && typeof i.str === "string" ? i.str : ""))
        .join(" ")
        .replace(/\s+/g, "")
        .replace(/[\u200c\u0640]/g, "")
    );

    const ops = await page.getOperatorList();
    let m = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    let fill: number[] | null = null;
    let stroke: number[] | null = null;

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
        const a = ops.argsArray[k] as { 0: number; 1: number; 2: number } | number[];
        fill = Array.isArray(a) ? (a as number[]) : [a[0], a[1], a[2]];
        if (sameInk(fill, ADMIN_RED) && !redPages.includes(p)) redPages.push(p);
      } else if (fn === pdfjs.OPS.setStrokeRGBColor) {
        const a = ops.argsArray[k] as { 0: number; 1: number; 2: number } | number[];
        stroke = Array.isArray(a) ? (a as number[]) : [a[0], a[1], a[2]];
      } else if (fn === pdfjs.OPS.constructPath) {
        const args = ops.argsArray[k] as unknown[];
        const raw = args[2] as number[] | undefined;
        if (raw && raw.length === 4 && sameInk(stroke, ADMIN_RED) && sameInk(fill, [255, 246, 246])) {
          const x0 = m[0]! * raw[0]! + m[2]! * raw[1]! + m[4]!;
          const y0 = m[1]! * raw[0]! + m[3]! * raw[1]! + m[5]!;
          const x1 = m[0]! * raw[2]! + m[2]! * raw[3]! + m[4]!;
          const y1 = m[1]! * raw[2]! + m[3]! * raw[3]! + m[5]!;
          redCardBox = [
            Math.min(x0, x1),
            Math.min(y0, y1),
            Math.max(x0, x1),
            Math.max(y0, y1),
          ];
        }
      } else if (fn === pdfjs.OPS.paintImageXObject) {
        images.push({
          page: p,
          w: Math.hypot(m[0]!, m[1]!),
          h: Math.hypot(m[2]!, m[3]!),
          x: m[4]!,
          y: m[5]!,
          rotated: Math.abs(m[1]!) > 0.01 || Math.abs(m[2]!) > 0.01,
        });
      }
    }
  }

  return { numPages: doc.numPages, texts, images, redPages, redCardBox };
}

/**
 * Text the PDF stores is not text the PDF shows. pdfjs reconstructs a run
 * from glyph ids, so a lam-alef ligature comes back in visual order
 * («پلان» → «پالن») and a combining hamza moves off its base
 * («تأییدیهٔ» → «تأییدیٔه»). Fold both sides of every comparison instead
 * of asserting on glyph order.
 */
function fold(s: string): string {
  return s
    // Chromium's print pipeline stores SHAPED glyphs, so its text layer
    // comes back in Arabic presentation forms («ﯾ», «ﻧ»). NFKC folds
    // every presentation form back to the base letter; server-rendered
    // PDFs are unaffected by it.
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[\u200c\u0640]/g, "")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    // Lam and alef swap order across the ligature. Dropping both is the
    // only order-independent canonical form.
    .replace(/[\u0627\u0644]/g, "");
}

/** The page texts in the same canonical form as every needle. */
function foldedPages(facts: PdfFacts): string[] {
  return facts.texts.map(fold);
}

/** The 0-based index of the first page containing `needle`, or -1. */
function pageOf(pages: readonly string[], needle: string, from = 0): number {
  const at = pages.slice(from).findIndex((t) => t.includes(fold(needle)));
  return at < 0 ? -1 : at + from;
}

/**
 * The image drawn on `page` (0-based page INDEX, as `facts.texts` is)
 * whose aspect ratio matches `ratio`.
 */
function imageWithRatio(facts: PdfFacts, page: number, ratio: number): ImageDraw | undefined {
  return facts.images.find(
    (d) => d.page === page + 1 && d.h > 20 && Math.abs(d.w / d.h - ratio) < 0.02
  );
}

// ------------------------------------------------------------
// Shared assertions — the same rules must hold for EVERY contract type
// ------------------------------------------------------------

/** §T3 — the seal (40mm) and hologram (32mm) on every page, inside the band. */
function assertMarksOnEveryPage(facts: PdfFacts): void {
  for (let page = 1; page <= facts.numPages; page++) {
    const drawn = facts.images.filter((i) => i.page === page);
    const seal = drawn.find((i) => Math.abs(i.h - SEAL_H) < 1);
    const holo = drawn.find((i) => Math.abs(i.h - HOLO_H) < 1);
    expect(seal, `page ${page}: no 40mm seal`).toBeTruthy();
    expect(holo, `page ${page}: no 32mm hologram`).toBeTruthy();
    expect(holo!.x, `page ${page}: the hologram is not at the physical left`).toBeLessThanOrEqual(
      MARGIN + 1
    );
    expect(
      holo!.x + holo!.w,
      `page ${page}: the hologram is not left of the seal`
    ).toBeLessThanOrEqual(seal!.x + 1);
    // Both live inside the reserved band, above the page number.
    expect(holo!.y, `page ${page}: hologram leaves the band`).toBeGreaterThan(MARGIN - 1);
    expect(seal!.y, `page ${page}: seal leaves the band`).toBeGreaterThan(MARGIN - 1);
    expect(seal!.y + seal!.h, `page ${page}: seal climbs over body text`).toBeLessThan(
      MARGIN + 170
    );
    expect(seal!.rotated, `page ${page}: the seal is not tilted`).toBe(true);
  }
}

/** §6 — the red card on the LAST page only, above the band, nowhere else. */
function assertRedCard(facts: PdfFacts, pages: readonly string[]): void {
  expect(facts.redPages, "the red admin message is not on exactly the last page").toEqual([
    facts.numPages,
  ]);
  expect(pages[facts.numPages - 1]).toContain(fold(ADMIN_MESSAGE));
  for (let i = 0; i < facts.numPages - 1; i++) {
    expect(pages[i], `page ${i + 1} repeats the admin message`).not.toContain(fold("پیام‌ادمین"));
  }
  expect(facts.redCardBox, "the message card is not painted").toBeTruthy();
  const [cardLeft, cardBottom, cardRight, cardTop] = facts.redCardBox!;
  expect(cardLeft, "the card starts outside the printable area").toBeGreaterThanOrEqual(MARGIN - 1);
  expect(cardRight, "the card runs outside the printable area").toBeLessThanOrEqual(
    595.28 - MARGIN + 1
  );
  // Above the reserved band (never over the seal/hologram/page number).
  expect(cardBottom, "the card overlaps the footer band").toBeGreaterThan(MARGIN + 170);
  // Below the body content of the certificate page.
  expect(cardTop, "the card covers the certificate text").toBeLessThan(500);
}

/** §2 — the certificate states the truth and claims no outside authority. */
function assertCertificateTruth(facts: PdfFacts, pages: readonly string[]): void {
  const text = pages[facts.numPages - 1]!;
  expect(text).toContain(fold("بررسی‌نشده توسط لیگالیر"));
  expect(text).toContain(fold("ثبت نهایی بدون بررسی لیگالیر — بررسی‌نشده"));
  // It is a TRACEABILITY page, not a claim of external confirmation.
  expect(text).toContain(fold("به معنای تأیید هیچ مرجع بیرونی یا ثبت رسمی نیست"));
}

/**
 * §T7 / §T1 — the annexes follow the body in REGISTRATION order, each on
 * a page of its own at its own aspect ratio, and the certificate closes
 * the file.
 */
function assertAnnexOrderAndLayout(args: {
  facts: PdfFacts;
  pages: readonly string[];
  signaturePage: number;
  annexA: typeof ANNEX_A;
  annexB: typeof ANNEX_B;
}): { annexA: number; annexB: number; certificate: number } {
  const { facts, pages, signaturePage, annexA: specA, annexB: specB } = args;
  const annexA = pageOf(pages, specA.title, signaturePage + 1);
  const annexB = pageOf(pages, specB.title, signaturePage + 1);
  const certificate = pageOf(pages, "تأییدیهٔ اصالت سند", signaturePage + 1);

  expect(annexA, `annex «${specA.title}» is missing`).toBeGreaterThan(signaturePage);
  expect(annexB, `annex «${specB.title}» is missing`).toBeGreaterThan(signaturePage);
  expect(certificate, "the authenticity certificate is missing").toBeGreaterThan(signaturePage);

  expect(annexA).toBeLessThan(annexB);
  expect(annexB).toBeLessThan(certificate);
  expect(certificate, "the certificate must be the LAST page").toBe(facts.numPages - 1);

  expect(
    imageWithRatio(facts, annexA, specA.ratio),
    `annex A is not drawn with ratio ${specA.ratio}`
  ).toBeTruthy();
  expect(
    imageWithRatio(facts, annexB, specB.ratio),
    `annex B is not drawn with ratio ${specB.ratio}`
  ).toBeTruthy();

  // Each annex occupies exactly one page of its own — counting only the
  // pages AFTER the body, where the «فهرست پیوست‌ها» table (which names
  // every annex) no longer appears.
  const pagesWith = (title: string) =>
    pages.map((t, i) => (i > signaturePage && t.includes(fold(title)) ? i : -1)).filter((i) => i >= 0);
  expect(pagesWith(specA.title)).toEqual([annexA]);
  expect(pagesWith(specB.title)).toEqual([annexB]);

  // Both annex images fit inside the printable box, above the band.
  for (const [page, spec, label] of [
    [annexA, specA, "A"],
    [annexB, specB, "B"],
  ] as const) {
    const draw = imageWithRatio(facts, page, spec.ratio)!;
    expect(draw.x, `annex ${label} starts left of the margin`).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(draw.x + draw.w, `annex ${label} runs past the right margin`).toBeLessThanOrEqual(
      595.28 - MARGIN + 1
    );
    expect(draw.y, `annex ${label} runs into the footer band`).toBeGreaterThan(MARGIN + 170 - 1);
  }

  // Every page BEFORE the annexes identifies the contract it belongs to.
  const referenceCode = facts.texts[0]!.match(/LGL-[A-Z]+-\d{4}-\d{6}/)?.[0];
  expect(referenceCode, "page 1 carries no contract reference").toBeTruthy();
  for (let i = 0; i < annexA; i++) {
    expect(pages[i], `contract page ${i + 1} has no identity header`).toContain(referenceCode!);
  }

  return { annexA, annexB, certificate };
}

/** §T2 — the uploaded scan is drawn ONCE, in the signer's own cell. */
async function assertScanCell(args: {
  facts: PdfFacts;
  pdfBytes: Uint8Array;
  signaturePage: number;
  signerNameNeedle: string;
  otherNameNeedle: string;
}): Promise<void> {
  const { facts, pdfBytes, signaturePage, signerNameNeedle, otherNameNeedle } = args;
  const scans = facts.images.filter((i) => Math.abs(i.w / i.h - SCAN.ratio) < 0.02);
  expect(scans.length, "the uploaded signature scan must be drawn exactly once").toBe(1);
  const scan = scans[0]!;
  expect(scan.page, "the scan belongs on the signature page").toBe(signaturePage + 1);

  // Column geometry: «محل امضا» is the THIRD column from the right.
  const CONTENT_WIDTH = 595.28 - MARGIN * 2;
  const RIGHT = 595.28 - MARGIN;
  const widths = [0.2, 0.3, 0.28, 0.22].map((w) => CONTENT_WIDTH * w);
  const columnRight = RIGHT - widths.slice(0, 2).reduce((sum, w) => sum + w, 0);
  const columnLeft = columnRight - widths[2]!;
  expect(scan.x, "the scan drifts left of the signature column").toBeGreaterThanOrEqual(
    columnLeft - 2
  );
  expect(scan.x + scan.w, "the scan drifts right of the signature column").toBeLessThanOrEqual(
    columnRight + 2
  );

  // …and in the SIGNER's row. Rows run RTL top → bottom (initiator first),
  // so the scan sits between the two names.
  const runs = await (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise;
    const page = await doc.getPage(signaturePage + 1);
    const tc = await page.getTextContent();
    return tc.items
      .filter((i): i is typeof i & { str: string; transform: number[] } => "str" in i)
      .map((i) => ({ str: i.str, x: i.transform[4]!, y: i.transform[5]! }));
  })();
  const signerName = runs.find((r) => r.str.includes(signerNameNeedle) && r.y > CONTENT_BOTTOM - 40);
  const otherName = runs.find((r) => r.str.includes(otherNameNeedle) && r.y > CONTENT_BOTTOM - 40);
  expect(signerName, "the signer's name is not in the signature table").toBeTruthy();
  expect(otherName, "the other party's name is not in the signature table").toBeTruthy();
  expect(scan.y, "the scan sits below the signer's name").toBeLessThan(signerName!.y);
  expect(scan.y, "the scan sits above the other party's row").toBeGreaterThan(otherName!.y);
}

// ------------------------------------------------------------
// The real lifecycle, in named steps, so the byte-level checks and the
// on-screen checks walk the SAME path.
// ------------------------------------------------------------

/** §T2 — before anyone signs, the file itself says both rows are pending. */
async function assertPendingBeforeSigning(
  request: APIRequestContext,
  cookie: string,
  id: string
): Promise<void> {
  const preSignRes = await request.get(`/api/v1/property-contracts/${id}/pdf`, {
    headers: { cookie },
  });
  expect(preSignRes.ok(), `PDF route failed: ${preSignRes.status()}`).toBeTruthy();
  const preSign = await readPdf(new Uint8Array(await preSignRes.body()));

  const pendingPages = preSign.texts.filter((t) => (t.match(/درانتظارامضا/g) ?? []).length >= 2);
  expect(pendingPages.length, "an unsigned contract must print «در انتظار امضا»").toBeGreaterThan(0);
  expect(
    preSign.images.some((i) => Math.abs(i.w / i.h - SCAN.ratio) < 0.02),
    "no scan was uploaded yet, so no scan may be drawn"
  ).toBe(false);
}

/** Open the request, then have one party sign on paper and one by OTP. */
async function signEveryParty(
  request: APIRequestContext,
  cookie: string,
  id: string,
  seed: ContractSeed
): Promise<void> {
  const opened = await request.post(`/api/v1/property-contracts/${id}/sign`, {
    headers: { cookie },
    data: { action: "create_request" },
  });
  expect(opened.ok(), `create_request failed: ${opened.status()} ${await opened.text()}`).toBeTruthy();

  const participants = await participantsOf(request, id, cookie);
  const paperSigner = participants.find((p) => p.roleFa === seed.physicalRoleFa);
  const otpSigner = participants.find((p) => p.roleFa === seed.otpRoleFa);
  expect(paperSigner, `the request has no «${seed.physicalRoleFa}» participant`).toBeTruthy();
  expect(otpSigner, `the request has no «${seed.otpRoleFa}» participant`).toBeTruthy();

  // The first party signs on paper: the scan is drawn into THEIR cell.
  const physical = await request.post(`/api/v1/property-contracts/${id}/sign`, {
    headers: { cookie },
    multipart: {
      participantId: paperSigner!.id,
      file: {
        name: "paper-signature.png",
        mimeType: "image/png",
        buffer: solidPng(SCAN.w, SCAN.h, [40, 60, 90]),
      },
    },
  });
  expect(
    physical.ok(),
    `record_physical failed: ${physical.status()} ${await physical.text()}`
  ).toBeTruthy();

  // The second party signs by OTP.
  const otpRequested = await request.post(`/api/v1/property-contracts/${id}/sign`, {
    headers: { cookie },
    data: { action: "request_otp", participantId: otpSigner!.id },
  });
  expect(
    otpRequested.ok(),
    `request_otp failed: ${otpRequested.status()} ${await otpRequested.text()}`
  ).toBeTruthy();
  const otpVerified = await request.post(`/api/v1/property-contracts/${id}/sign`, {
    headers: { cookie },
    data: {
      action: "verify_otp",
      participantId: otpSigner!.id,
      code: DEV_OTP,
      consentGiven: true,
    },
  });
  expect(
    otpVerified.ok(),
    `verify_otp failed: ${otpVerified.status()} ${await otpVerified.text()}`
  ).toBeTruthy();
}

/**
 * Finalize, then set the admin message. §T7 requires the late change to
 * REGENERATE the same stored artifact rather than leave a stale one.
 */
async function finalizeWithMessage(
  request: APIRequestContext,
  cookie: string,
  adminCookie: string,
  id: string
): Promise<void> {
  const finalized = await request.post(`/api/v1/property-contracts/${id}/finalize`, {
    headers: { cookie },
  });
  expect(finalized.ok(), `finalize failed: ${finalized.status()} ${await finalized.text()}`).toBeTruthy();
  const finalBody = (await finalized.json()) as {
    data: { state: string; finalArtifact: { storageKey: string } | null };
  };
  expect(finalBody.data.state).toBe("FINALIZED");
  expect(finalBody.data.finalArtifact, "finalization stored no artifact").toBeTruthy();

  const messaged = await request.post(`/api/v1/admin/contracts/${id}/message`, {
    headers: { cookie: adminCookie },
    data: { messageFa: ADMIN_MESSAGE },
  });
  expect(messaged.ok(), `message failed: ${messaged.status()} ${await messaged.text()}`).toBeTruthy();
  const messageBody = (await messaged.json()) as {
    data: { finalArtifactRegenerated: boolean; remainingChars: number };
  };
  expect(messageBody.data.finalArtifactRegenerated).toBe(true);
  expect(messageBody.data.remainingChars).toBe(100 - Array.from(ADMIN_MESSAGE).length);
}

// ------------------------------------------------------------
// The on-screen sheet — the same document, rendered in the browser
// ------------------------------------------------------------

async function mockAuth(page: Page, sessionId: string): Promise<void> {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId,
          userId: "demo-user-id",
          mobileE164: "+989120000003",
          mobileDisplay: DEMO_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    }
  );
}

/** Keep the profile-completion sheet out of the way of the print root. */
async function suppressProfilePrompt(page: Page): Promise<void> {
  await page.route("**/api/v1/me/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { showProfileCompletionPrompt: false } }),
      });
      return;
    }
    await route.continue();
  });
}

/**
 * The paginator measures on mount and AGAIN after `document.fonts.ready`,
 * so the sheet legitimately re-flows right after the print root mounts.
 * Wait for the page count to settle before measuring anything about it —
 * the print flow itself awaits fonts, so the SETTLED layout is what the
 * browser prints.
 */
async function settlePagination(page: Page, root: Locator): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
  let last = -1;
  for (let i = 0; i < 50; i++) {
    const count = await root.locator(".a4-page").count();
    if (count === last && count > 0) return;
    last = count;
    await page.waitForTimeout(100);
  }
}

// ------------------------------------------------------------
// Fixtures for the two contract types
// ------------------------------------------------------------

/** A residential rent contract — the bespoke property renderer. */
const RENT_SEED: ContractSeed = {
  type: "property_rent",
  propertyKind: "apartment",
  title: "قرارداد آزمون PDF نهایی",
  buildData: filledRentData,
  parties: rentParties(),
  documents: ["deed", "landlord_id", "tenant_id"],
  physicalRoleFa: "موجر",
  otpRoleFa: "مستأجر",
  physicalNameNeedle: "مریم",
  otherNameNeedle: "رضا",
};

/** A schema-driven employment contract — the generic renderer. */
const EMPLOYMENT_SEED: ContractSeed = {
  type: "employment",
  title: "قرارداد کار آزمون PDF نهایی",
  buildData: () => employmentData(),
  parties: employmentParties(),
  documents: ["employer_id", "employee_id"],
  physicalRoleFa: "کارفرما",
  otpRoleFa: "کارگر / کارمند",
  physicalNameNeedle: "مریم",
  otherNameNeedle: "رضا",
};

// ------------------------------------------------------------
// The tests
// ------------------------------------------------------------

test.describe("final PDF — real bytes, real lifecycle", () => {
  /**
   * The SAME acceptance rules, driven through the same real lifecycle,
   * against one contract type. §8 of the specification asks for several
   * real contracts, so the suite runs it for a bespoke property contract
   * AND a schema-driven employment contract — the renderer must be
   * type-agnostic, and a regression in one renderer must not hide behind
   * the other.
   */
  async function verifyFinalPdf(
    request: APIRequestContext,
    seed: ContractSeed
  ): Promise<void> {
    const sessionId = await ownerSession(request);
    const cookie = `${SESSION_COOKIE}=${sessionId}`;
    const admin = await ensureAdminSession(request);
    const draft = await seedReadyToSign(request, sessionId, seed);

    try {
      await assertPendingBeforeSigning(request, cookie, draft.id);
      await signEveryParty(request, cookie, draft.id, seed);
      await finalizeWithMessage(request, cookie, `${SESSION_COOKIE}=${admin.sessionId}`, draft.id);

      // ---- Read the artifact the ADMIN sees, byte for byte -------------
      const docRes = await request.get(`/api/v1/admin/contracts/${draft.id}/final-document`, {
        headers: { cookie: `${SESSION_COOKIE}=${admin.sessionId}` },
      });
      expect(docRes.ok(), `final-document failed: ${docRes.status()}`).toBeTruthy();
      expect(docRes.headers()["content-type"]).toContain("application/pdf");
      // Read the body ONCE: a response body is a single-use stream, so
      // every later inspection of the same artifact reuses these bytes.
      const pdfBytes = new Uint8Array(await docRes.body());
      const facts = await readPdf(pdfBytes);

      const pages = foldedPages(facts);

      // ---- §T7 — page ORDER: contract → annex A → annex B → certificate --
      // The contract body lists the annex titles in its own «فهرست پیوست‌ها»
      // table, so anchor on the signature block first and look for the
      // annexed FILES only after it.
      const signaturePage = pageOf(pages, "امضای طرفین");
      expect(signaturePage, "the signature block is missing").toBeGreaterThan(0);

      assertAnnexOrderAndLayout({ facts, pages, signaturePage, annexA: ANNEX_A, annexB: ANNEX_B });

      // ---- §T2 — the scan in ITS OWN party's cell ----------------------
      await assertScanCell({
        facts,
        pdfBytes,
        signaturePage,
        signerNameNeedle: seed.physicalNameNeedle,
        otherNameNeedle: seed.otherNameNeedle,
      });

      // ---- §T3 — seal + hologram on EVERY page -------------------------
      assertMarksOnEveryPage(facts);

      // ---- §6 — the red message on the LAST page, and nowhere else -----
      assertRedCard(facts, pages);

      // ---- §2 — the certificate tells the truth ------------------------
      assertCertificateTruth(facts, pages);
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, { headers: { cookie } });
    }
  }

  test("a residential rent contract — annexes, signatures, marks, the red message and the certificate all land where §T1–§T7 require", async ({
    request,
  }) => {
    test.setTimeout(420_000);
    await verifyFinalPdf(request, RENT_SEED);
  });

  test("a schema-driven employment contract — the same rules hold on the generic renderer", async ({
    request,
  }) => {
    test.setTimeout(420_000);
    await verifyFinalPdf(request, EMPLOYMENT_SEED);
  });
});

test.describe("the A4 sheet on screen", () => {
  /**
   * §8 of the specification asks for the final output to be checked in
   * the PRINT PREVIEW as well as in the file. This walks the same
   * lifecycle as the byte-level test, then drives the real «چاپ سند»
   * path and holds the browser-rendered pages — and the PDF Chromium
   * produces from them — to the same last-page rules.
   */
  test("preview and print put the annexes, the certificate and the red card on the same pages as the stored PDF", async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000);

    const sessionId = await ownerSession(request);
    const cookie = `${SESSION_COOKIE}=${sessionId}`;
    const admin = await ensureAdminSession(request);
    const draft = await seedReadyToSign(request, sessionId, RENT_SEED);

    try {
      await signEveryParty(request, cookie, draft.id, RENT_SEED);
      await finalizeWithMessage(request, cookie, `${SESSION_COOKIE}=${admin.sessionId}`, draft.id);

      await mockAuth(page, sessionId);
      await suppressProfilePrompt(page);
      await page.addInitScript(() => {
        window.print = () => {};
      });

      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`/contracts/${draft.id}`);
      await expect(page.getByText("پیش‌نمایش قرارداد").first()).toBeVisible({ timeout: 20_000 });

      // The mirror (signature scans, annexes, the certificate and the
      // message) arrives with the lifecycle query, separately from the
      // contract detail. Printing before it lands would emit a text-only
      // sheet — so wait for the visible sheet to carry it first.
      const sheetRoot = page.locator(".a4-document .a4-pages");
      await expect(sheetRoot.locator(".a4-admin-message")).toBeAttached({ timeout: 20_000 });
      await expect(sheetRoot.getByText("تأییدیهٔ اصالت سند").first()).toBeAttached();

      await page.getByRole("button", { name: "چاپ سند" }).click();
      const printRoot = page.locator(".a4-print-root");
      await expect(printRoot).toBeAttached({ timeout: 15_000 });
      await expect(printRoot.locator(".a4-page").first()).toBeVisible();
      await settlePagination(page, printRoot);

      const sheet = await printRoot.evaluate((root) => {
        const pages = Array.from(root.querySelectorAll<HTMLElement>(".a4-page"));
        const cards = Array.from(root.querySelectorAll<HTMLElement>(".a4-admin-message"));
        const card = cards[0] ?? null;
        const text = card?.querySelector<HTMLElement>(".a4-admin-message-text") ?? null;
        const cardStyle = card ? getComputedStyle(card) : null;
        return {
          pageCount: pages.length,
          /** Whitespace-collapsed text of every sheet, in reading order. */
          texts: pages.map((p) => (p.innerText ?? "").replace(/\s+/g, " ")),
          cardCount: cards.length,
          cardPage:
            card && card.closest(".a4-page")
              ? pages.indexOf(card.closest(".a4-page") as HTMLElement)
              : -1,
          cardText: text?.textContent ?? null,
          cardColor: text ? getComputedStyle(text).color : null,
          cardBorder: cardStyle
            ? `${cardStyle.borderTopStyle} ${cardStyle.borderTopColor}`
            : null,
          cardFill: cardStyle?.backgroundColor ?? null,
          // `overflow: hidden` on the sheet means real clipping shows up as
          // scrollHeight − clientHeight; subpixel rounding stays at ≤1px.
          clipped: pages.map((p) => Math.max(0, p.scrollHeight - p.clientHeight)),
        };
      });

      const textOf = (index: number) => sheet.texts[index] ?? "";
      const pageWith = (needle: string, from = 0) => {
        const at = sheet.texts.slice(from).findIndex((t) => t.includes(needle));
        return at < 0 ? -1 : at + from;
      };

      // ---- §6 — ONE card, on the LAST page, in the PDF's own red -------
      expect(sheet.cardCount, "the sheet carries the admin card once").toBe(1);
      expect(sheet.cardPage, "the admin card is not on the last sheet").toBe(
        sheet.pageCount - 1
      );
      expect(sheet.cardText).toContain(ADMIN_MESSAGE);
      expect(sheet.cardColor, "the card is not printed in the PDF's red").toBe(
        "rgb(185, 28, 28)"
      );
      expect(sheet.cardFill, "the card does not use the PDF's tint").toBe(
        "rgb(255, 246, 246)"
      );
      // Dashed, in the same red — the PDF paints a perforated/stamped strip.
      expect(sheet.cardBorder, "the card is not framed like the PDF's").toBe(
        "dashed rgb(185, 28, 28)"
      );

      // ---- §T7 — annexes in registration order, certificate last --------
      // The contract body's «فهرست پیوست‌ها» table names every annex, so
      // anchor on the signature block and look for the FILES after it.
      const sheetSignature = pageWith("امضای طرفین");
      expect(sheetSignature, "the sheet has no signature block").toBeGreaterThan(0);
      const annexA = pageWith(ANNEX_A.title, sheetSignature + 1);
      const annexB = pageWith(ANNEX_B.title, sheetSignature + 1);
      const certificate = pageWith("تأییدیهٔ اصالت سند", sheetSignature + 1);
      expect(annexA, `annex «${ANNEX_A.title}» is missing from the sheet`).toBeGreaterThan(
        sheetSignature
      );
      expect(annexB, `annex «${ANNEX_B.title}» is missing from the sheet`).toBeGreaterThan(
        sheetSignature
      );
      expect(annexA).toBeLessThan(annexB);
      expect(certificate, "the certificate must be the last sheet").toBe(
        sheet.pageCount - 1
      );
      expect(annexB).toBeLessThan(certificate);
      // The message belongs to the certificate page — not a page of its own.
      expect(annexA).toBeLessThan(sheet.cardPage);

      // ---- Nothing may be clipped off any sheet (§2.5 / print) ---------
      expect(sheet.clipped.every((n) => n <= 1), "a sheet clips its content").toBe(true);

      // ---- §2 — the certificate states the unreviewed truth -------------
      expect(textOf(certificate)).toContain("بررسی‌نشده توسط لیگالیر");

      // ---- The PRINT output, read back from Chromium's own PDF ----------
      const pdfPath = path.join(
        os.tmpdir(),
        `legalir-print-${Date.now().toString(36)}.pdf`
      );
      await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
      const printedBytes = new Uint8Array(fs.readFileSync(pdfPath));
      const printed = await readPdf(printedBytes);
      fs.unlinkSync(pdfPath);

      // Chromium's print pipeline writes SHAPED glyphs in visual order,
      // so the TEXT layer of this file cannot be compared with a logical
      // Persian needle. Its GEOMETRY can: same page count, the red card
      // on the last page only, and every annexed image on the page the
      // sheet put it on, at its own aspect ratio.
      expect(printed.numPages, "the printed file and the sheet disagree on the page count").toBe(
        sheet.pageCount
      );
      expect(
        printed.redPages,
        "the printed red ink is not confined to the last page"
      ).toEqual([printed.numPages]);

      expect(
        imageWithRatio(printed, annexA, ANNEX_A.ratio),
        `the printed page ${annexA + 1} does not carry annex A at its aspect ratio`
      ).toBeTruthy();
      expect(
        imageWithRatio(printed, annexB, ANNEX_B.ratio),
        `the printed page ${annexB + 1} does not carry annex B at its aspect ratio`
      ).toBeTruthy();
      // Annex and certificate pages are the last three sheets, in order.
      expect([annexA, annexB, certificate]).toEqual([
        printed.numPages - 3,
        printed.numPages - 2,
        printed.numPages - 1,
      ]);

      // The Latin reference code survives bidi in every text layer, so it
      // is the one needle safe to use on a shaped-glyph page.
      const CODE_RE = /LGL-[A-Z]+-[0-9۰-۹]{4}-[0-9۰-۹]{6}/;
      const printedCode = printed.texts.map((t) => t.match(CODE_RE)?.[0]).find(Boolean);
      expect(printedCode, "the printed file carries no contract reference").toBeTruthy();
      // Persian page 1 and the Latin running head use different digit
      // sets, so compare the code's canonical digits.
      const digits = (code: string) =>
        code.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
      for (let i = 0; i < annexA; i++) {
        const found = printed.texts[i]?.match(CODE_RE)?.[0];
        expect(digits(found ?? ""), `printed page ${i + 1} has no identity header`).toBe(
          digits(printedCode!)
        );
      }
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, { headers: { cookie } });
    }
  });
});
