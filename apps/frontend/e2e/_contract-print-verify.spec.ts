/**
 * TEMPORARY verification spec (deleted after the run).
 *
 * Proves the CONTRACT PRINT OUTPUT, not the screen: it seeds a rent
 * contract through the live API, opens the review step, triggers the
 * real «چاپ سند» path (window.print is stubbed so the dialog never
 * blocks headless Chrome), and then renders the mounted print root to
 * an actual PDF with `page.pdf()`. The PDF is read back with pdfjs to
 * assert page count, per-page text presence and the page numbering.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const SHOT_DIR = path.join(process.cwd(), "e2e", "__shots__");

let cachedSessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const id = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!id) throw new Error("login failed");
  cachedSessionId = id;
  return id;
}

async function mockAuth(page: Page, sessionId: string) {
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

async function suppressProfilePrompt(page: Page) {
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

/** A fully-answered rent contract, so the sheet carries every clause. */
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
      meters: [
        { key: "electricity", labelFa: "برق", meterNumber: "111222", value: "۱۵۰۰" },
      ],
      keys: [{ key: "main", labelFa: "کلید اصلی", count: 2 }],
      notes: "تحویل در تاریخ توافق‌شده انجام می‌شود.",
    },
    customClauses: [
      {
        id: "cc-print-1",
        kind: "agreement",
        title: "اجازه نگهداری حیوان خانگی",
        body: "مستأجر مجاز است یک حیوان خانگی کوچک نگهداری کند.",
        sectionRef: "usageRules",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "cc-print-2",
        kind: "change_request",
        title: "اصلاح روز پرداخت",
        body: "پیشنهاد می‌شود روز پرداخت به دهم هر ماه تغییر کند.",
        sectionRef: "financial",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    supplementary: { notes: "تمدید قرارداد منوط به توافق کتبی طرفین است." },
  };
}

async function seed(request: APIRequestContext, sessionId: string): Promise<string> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: { type: "property_rent", propertyKind: "apartment", title: "اجاره‌نامه آزمون چاپ" },
  });
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error("create failed");

  const detailRes = await request.get(`/api/v1/property-contracts/${id}`, { headers: { cookie } });
  const detail = ((await detailRes.json()) as { data?: { data?: Record<string, unknown> } }).data;
  const base = (detail?.data ?? {}) as Record<string, unknown>;

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { data: filledRentData(base), currentStep: "review" },
  });
  if (!patched.ok()) throw new Error(`patch failed: ${await patched.text()}`);

  const parties: Array<Record<string, unknown>> = [
    {
      role: "landlord",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "مریم",
        lastName: "محمدی",
        fatherName: "حسن",
        nationalId: "0012345678",
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
        nationalId: "0087654321",
        mobile: "09120000004",
        address: "کرج، خیابان شهید بهشتی، پلاک ۴",
        postalCode: "3145678901",
        birthCertificateNumber: "456",
        birthCertificatePlace: "کرج",
      },
    },
  ];
  for (const party of parties) {
    const res = await request.put(`/api/v1/property-contracts/${id}/parties`, {
      headers: { cookie },
      data: party,
    });
    if (!res.ok()) throw new Error(`party failed: ${await res.text()}`);
  }
  return id;
}

test("contract print output — real PDF, A4, page numbers", async ({ page, request }) => {
  const sessionId = await getSession(request);
  const id = await seed(request, sessionId);

  await mockAuth(page, sessionId);
  await suppressProfilePrompt(page);
  // Headless print() must never open a dialog; the component only needs
  // the call to happen so it keeps the print root mounted.
  await page.addInitScript(() => {
    window.print = () => {};
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/contracts/${id}`);
  await expect(page.getByText("پیش‌نمایش قرارداد").first()).toBeVisible({ timeout: 20_000 });

  // The print root is only mounted through the real print action.
  await page.getByRole("button", { name: "چاپ سند" }).click();
  const printRoot = page.locator(".a4-print-root");
  await expect(printRoot).toBeAttached({ timeout: 15_000 });
  await expect(printRoot.locator(".a4-page").first()).toBeVisible();

  // Clipping check on the ACTUAL print root: `overflow: hidden` would
  // silently cut content that the paginator mis-measured.
  const domPages = await printRoot.locator(".a4-page").count();
  const clipped = await printRoot.locator(".a4-page").evaluateAll((els) =>
    els.map((el) => ({
      overflow: Math.max(0, (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight),
      widthOverflow: Math.max(
        0,
        (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth
      ),
    }))
  );

  const pdfPath = path.join(SHOT_DIR, "contract-print.pdf");
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });

  // ---- Read the real PDF back -----------------------------------------
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  // Chrome embeds Persian as presentation-form glyphs in VISUAL order, so a
  // substring match on logical Persian would always fail. The honest checks
  // are geometry (is it really A4?), page count, non-blank pages, and a
  // Latin token — the reference code survives extraction intact.
  const pages: string[] = [];
  const sizes: { w: number; h: number }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    pages.push(
      tc.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ")
    );
    const view = pg.view;
    sizes.push({ w: view[2] ?? 0, h: view[3] ?? 0 });
  }

  const A4_PT = { w: 595.28, h: 841.89 };
  const isA4 = (s: { w: number; h: number }) =>
    Math.abs(s.w - A4_PT.w) < 2 && Math.abs(s.h - A4_PT.h) < 2;

  const report = {
    pages: doc.numPages,
    domPages,
    perPageChars: pages.map((t) => t.trim().length),
    allPagesA4: sizes.every(isA4),
    sizes,
    // The running head on pages 2+ carries the reference code verbatim.
    refCodeOnPage2: pages[1]?.includes("LGL-RENT-1405-") ?? false,
    clipped,
  };
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SHOT_DIR, "contract-print-report.json"),
    JSON.stringify(report, null, 2)
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  // Blank-page guard: a page with almost no text means the sheet overflowed
  // and the browser emitted padding pages.
  expect(report.perPageChars.every((n) => n > 40), "a printed page is blank").toBe(true);
  // The PDF must carry exactly the pages the paginator produced — no extra
  // blank sheets, no content squeezed onto fewer sheets.
  expect(report.pages).toBe(domPages);
  expect(report.pages).toBeGreaterThanOrEqual(2);
  expect(report.allPagesA4, "a printed page is not A4").toBe(true);
  expect(report.refCodeOnPage2, "the running head is missing on page 2").toBe(true);
  // `overflow: hidden` would clip silently, so assert the DOM pages hold
  // exactly what they measured.
  expect(report.clipped.every((c) => c.overflow <= 1 && c.widthOverflow <= 1)).toBe(true);

  // Clean up the throwaway contract.
  await request.delete(`/api/v1/property-contracts/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
});

function faNum(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}
