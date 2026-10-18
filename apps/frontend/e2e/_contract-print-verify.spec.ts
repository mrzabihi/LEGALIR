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

/**
 * Seed a schema-driven type (cloud IaaS). This exercises the OTHER render
 * path: `genericClauses` + `fieldTables`, whose tables are built from the
 * registry rather than hand-written.
 */
async function seedCloud(request: APIRequestContext, sessionId: string): Promise<string> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: { type: "cloud_iaas", title: "قرارداد خدمات ابری — IaaS" },
  });
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error("create failed");

  const money = (toman: number) => ({ amount: toman * 10, currency: "IRR" });
  const values: Record<string, unknown> = {
    serviceName: "زیرساخت ابری سازمانی",
    serviceDescription: "ارائهٔ ماشین مجازی، شبکه و ذخیره‌سازی اختصاصی",
    hostingRegion: "تهران — دیتاسنتر داخلی",
    contractStartDate: "2026-10-01",
    contractTermMonths: 12,
    computeSpecs: "۸ هسته، ۳۲ گیگابایت حافظه",
    storageSpecs: "۵۰۰ گیگابایت SSD",
    networkSpecs: "۱ گیگابیت بر ثانیه",
    backupPolicy: "پشتیبان‌گیری روزانه با نگهداری ۳۰ روزه",
    availabilitySla: 99.9,
    supportHours: "۲۴×۷",
    responseTime: "حداکثر ۳۰ دقیقه",
    maintenanceWindow: "سه‌شنبه ۰۲:۰۰ تا ۰۴:۰۰",
    securityMeasures: "رمزنگاری داده در حالت سکون و انتقال، احراز هویت دومرحله‌ای",
    uptimePenalty: money(20_000_000),
    subscriptionFee: money(120_000_000),
    billingPeriod: "monthly",
    paymentMethod: "bank_transfer",
    usageBilling: "مصرف مازاد بر سهمیه، ماهانه صورت‌حساب می‌شود.",
    customerObligations: "مشتری مسئول مدیریت دسترسی کاربران خود است.",
    providerObligations: "ارائه‌دهنده متعهد به حفظ دسترس‌پذیری مطابق SLA است.",
    terminationNoticeDays: 30,
    terminationTerms: "هر طرف می‌تواند با ۳۰ روز اطلاع کتبی قرارداد را فسخ کند.",
    dataOwnership: "customer",
    dataRetentionDays: 90,
    dataReturnMethod: "خروجی کامل به‌صورت آرشیو رمزنگاری‌شده",
  };

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { data: { schemaVersion: 1, values, customClauses: [] }, currentStep: "review" },
  });
  if (!patched.ok()) throw new Error(`patch failed: ${await patched.text()}`);

  const parties: Array<Record<string, unknown>> = [
    {
      role: "provider",
      personKind: "legal",
      nationality: "iranian",
      identity: {
        firstName: "شرکت ابر آریا",
        lastName: "",
        companyRegistrationNumber: "123456",
        address: "تهران، خیابان ولیعصر، پلاک ۱۰",
        mobile: "09120000003",
      },
    },
    {
      role: "customer",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "رضا",
        lastName: "کریمی",
        nationalId: "0087654321",
        mobile: "09120000004",
        address: "کرج، خیابان شهید بهشتی، پلاک ۴",
      },
    },
  ];
  let providerId = "";
  for (const party of parties) {
    const res = await request.put(`/api/v1/property-contracts/${id}/parties`, {
      headers: { cookie },
      data: party,
    });
    if (!res.ok()) throw new Error(`party failed: ${await res.text()}`);
    if (party["role"] === "provider") {
      providerId = ((await res.json()) as { data?: { id?: string } }).data?.id ?? "";
    }
  }
  if (!providerId) throw new Error("provider party id missing");
  // A legal entity needs its representative recorded separately, linked by id.
  const rep = await request.put(`/api/v1/property-contracts/${id}/parties`, {
    headers: { cookie },
    data: {
      role: "legal_representative",
      representativeOfPartyId: providerId,
      personKind: "natural",
      nationality: "iranian",
      representativePositionFa: "مدیرعامل",
      identity: {
        firstName: "علی",
        lastName: "رضایی",
        nationalId: "0011223344",
        mobile: "09120000005",
      },
    },
  });
  if (!rep.ok()) throw new Error(`representative failed: ${await rep.text()}`);
  return id;
}

test("cloud IaaS print output — service model, tables, A4, page numbers", async ({
  page,
  request,
}) => {
  const sessionId = await getSession(request);
  const id = await seedCloud(request, sessionId);

  await mockAuth(page, sessionId);
  await suppressProfilePrompt(page);
  await page.addInitScript(() => {
    window.print = () => {};
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/contracts/${id}`);
  await expect(page.getByText("پیش‌نمایش قرارداد").first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "چاپ سند" }).click();
  const printRoot = page.locator(".a4-print-root");
  await expect(printRoot).toBeAttached({ timeout: 15_000 });
  await expect(printRoot.locator(".a4-page").first()).toBeVisible();

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

  // The chosen service model must be readable in the document identity.
  const letterheadText = await printRoot.locator(".a4-letterhead").first().innerText();
  const titleText = await printRoot.locator(".a4-doc-title").first().innerText();

  const tables = await printRoot.evaluate((root) =>
    Array.from(root.querySelectorAll(".a4-table")).map((t) => ({
      hasThead: !!t.querySelector("thead"),
      theadRepeats: t.querySelector("thead")
        ? getComputedStyle(t.querySelector("thead")!).display === "table-header-group"
        : false,
      columns: t.querySelectorAll("thead th").length,
      rows: t.querySelectorAll("tbody tr").length,
    }))
  );
  const emptyTables = tables.filter((t) => t.rows === 0 || t.columns === 0);

  const pdfPath = path.join(SHOT_DIR, "contract-print-cloud.pdf");
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

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
    clipped,
    letterheadMentionsIaaS: /IaaS/.test(letterheadText),
    titleMentionsIaaS: /IaaS/.test(titleText),
    tableCount: tables.length,
    emptyTables: emptyTables.length,
  };
  fs.writeFileSync(
    path.join(SHOT_DIR, "contract-print-cloud-report.json"),
    JSON.stringify(report, null, 2)
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  expect(report.perPageChars.every((n) => n > 40), "a printed page is blank").toBe(true);
  expect(report.pages).toBe(domPages);
  expect(report.allPagesA4, "a printed page is not A4").toBe(true);
  // ≤1px is subpixel rounding of a fractional line box, not clipping: the
  // print pages have a fixed A4 height, so a real overflow would be tens of
  // pixels and would show as a blank or cut-off page below.
  expect(
    clipped.every((c) => c.overflow <= 1 && c.widthOverflow <= 1),
    "content is clipped"
  ).toBe(true);
  // Block B cloud rule: the service model is recorded in the title and the
  // letterhead identity, not only in the form.
  expect(report.titleMentionsIaaS || report.letterheadMentionsIaaS).toBe(true);
  // Block B tables: real tables with headings, and no empty table printed.
  expect(report.tableCount).toBeGreaterThan(0);
  expect(report.emptyTables, "an empty table reached the sheet").toBe(0);
  expect(tables.every((t) => t.hasThead && t.theadRepeats)).toBe(true);
});

test("cloud IaaS preview at mobile width — no horizontal overflow, tables intact", async ({
  page,
  request,
}) => {
  const sessionId = await getSession(request);
  const id = await seedCloud(request, sessionId);

  await mockAuth(page, sessionId);
  await suppressProfilePrompt(page);
  await page.addInitScript(() => {
    window.print = () => {};
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/contracts/${id}`);
  await expect(page.getByText("پیش‌نمایش قرارداد").first()).toBeVisible({ timeout: 20_000 });

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    // Scope to the VISIBLE stack — the off-screen measurer also has
    // `.a4-page` boxes and would report its own (unzoomed, -10000px) rect.
    const pages = document.querySelector(".a4-pages") as HTMLElement | null;
    const sheet = pages?.querySelector(".a4-page") as HTMLElement | null;
    const table = pages?.querySelector(".a4-table") as HTMLElement | null;
    const rect = sheet?.getBoundingClientRect();
    return {
      // The page itself must never scroll sideways.
      docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      sheetRect: rect
        ? { left: rect.left, right: rect.right, width: rect.width }
        : null,
      viewport: window.innerWidth,
      pagesZoom: pages ? getComputedStyle(pages).zoom : null,
      pagesRect: pages
        ? { left: pages.getBoundingClientRect().left, right: pages.getBoundingClientRect().right }
        : null,
      tableVisible: table ? table.getBoundingClientRect().width > 0 : false,
    };
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(layout, null, 2));

  expect(layout.docOverflow, "the page scrolls horizontally at 390px").toBeLessThanOrEqual(1);
  expect(
    (layout.sheetRect?.right ?? 0) <= layout.viewport + 1,
    `the A4 sheet is cropped on mobile: ${JSON.stringify(layout.sheetRect)}`
  ).toBe(true);
  expect(layout.tableVisible, "the printed table collapsed on mobile").toBe(true);
});

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

  // Letterhead geometry: the logo, the identification block and the
  // centred title must not overlap one another on page 1.
  const letterhead = await printRoot.locator(".a4-letterhead").first().evaluate((el) => {
    const rect = (sel: string) => {
      const n = el.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
    };
    const overlaps = (
      a: { top: number; left: number; bottom: number; right: number } | null,
      b: { top: number; left: number; bottom: number; right: number } | null
    ) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const logo = rect(".a4-letterhead-logo");
    const meta = rect(".a4-letterhead-meta");
    const title = rect(".a4-doc-title");
    const box = el.getBoundingClientRect();
    return {
      logo,
      meta,
      title,
      container: { left: box.left, right: box.right, width: box.width },
      logoOverlapsMeta: overlaps(logo, meta),
      logoOverlapsTitle: overlaps(logo, title),
      metaOverlapsTitle: overlaps(meta, title),
      titleCentred: title
        ? Math.abs((title.left + title.right) / 2 - (el.getBoundingClientRect().left + el.getBoundingClientRect().right) / 2) < 8
        : false,
    };
  });

  // Tables: a real <table>, a repeating heading group, and an unsplittable
  // row — the three properties that make a multi-page table readable.
  const tables = await printRoot.evaluate((root) => {
    const els = Array.from(root.querySelectorAll(".a4-table"));
    return els.map((t) => {
      const thead = t.querySelector("thead");
      const tr = t.querySelector("tbody tr");
      return {
        hasThead: !!thead,
        theadRepeats: thead ? getComputedStyle(thead).display === "table-header-group" : false,
        rowUnsplittable: tr ? getComputedStyle(tr).breakInside === "avoid" : false,
        columns: t.querySelectorAll("thead th").length,
        rows: t.querySelectorAll("tbody tr").length,
      };
    });
  });

  // §2.5 / §2.6 — geometry that can only be checked on the real sheet:
  // the party columns, the paraphe strip on every page, and the one-piece
  // signature block on the last page. Print media is emulated FIRST, so the
  // pages have their true fixed A4 height (297mm) — measuring the screen
  // portal would measure a content-sized box and prove nothing about print.
  await page.emulateMedia({ media: "print" });
  const sheetGeometry = await printRoot.evaluate((root) => {
    interface Box {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
      height: number;
    }
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const intersects = (a: Box | null, b: Box | null) =>
      !!a && !!b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

    const pages = Array.from(root.querySelectorAll(".a4-page")) as HTMLElement[];

    // --- §2.6 paraphe strip: present, legible (non-zero), and clear of the
    // body and the page-number row on EVERY page.
    const perPage = pages.map((page, index) => {
      const body = page.querySelector(".a4-page-blocks");
      const paraphe = page.querySelector(".a4-paraphe");
      const caption = page.querySelector(".a4-paraphe-caption");
      const boxes = Array.from(page.querySelectorAll(".a4-paraphe-box"));
      const number = page.querySelector(".a4-page-number");
      const footerLine = page.querySelector(".a4-page-footer-line");
      const bodyBox = box(body);
      const parapheBox = box(paraphe);
      // The LAST body block, which is what could collide with the strip.
      const blocks = Array.from(page.querySelectorAll(".a4-page-blocks > .a4-block"));
      const lastBlock = box(blocks[blocks.length - 1] ?? null);
      return {
        index: index + 1,
        hasParaphe: !!paraphe,
        captionText: caption?.textContent?.trim() ?? "",
        boxCount: boxes.length,
        // Every initial box must have real writing space, not a 0x0 sliver.
        boxesLegible: boxes.every((b) => {
          const r = b.getBoundingClientRect();
          return r.width >= 30 && r.height >= 12;
        }),
        parapheOverlapsBody: intersects(parapheBox, bodyBox),
        parapheOverlapsLastBlock: intersects(parapheBox, lastBlock),
        parapheOverlapsPageNumber: intersects(parapheBox, box(number)),
        parapheOverlapsFooterLine: intersects(parapheBox, box(footerLine)),
        hasPageNumber: !!number,
      };
    });

    // --- §2.6 signature block: exactly ONE, wholly on the LAST page.
    const signatures = Array.from(root.querySelectorAll(".a4-signatures"));
    const sigPageIndex = signatures[0]
      ? pages.indexOf(signatures[0].closest(".a4-page") as HTMLElement)
      : -1;
    const sigBox = box(signatures[0] ?? null);
    const lastPageBox = box(pages[pages.length - 1] ?? null);
    const sigBoxes = Array.from(root.querySelectorAll(".a4-signature-box"));
    const rules = Array.from(root.querySelectorAll(".a4-signature-rule"));

    // --- §2.5 parties: two columns, party 1 (landlord) LEFT, party 2 RIGHT.
    // Scoped by caption, so a different two-column table can never satisfy it.
    const partiesWrap = Array.from(root.querySelectorAll(".a4-table-wrap")).find((w) =>
      (w.querySelector(".a4-table-caption")?.textContent ?? "").includes("طرفین")
    );
    const partiesTable = partiesWrap?.querySelector(".a4-table") ?? null;
    const headers = partiesTable
      ? Array.from(partiesTable.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "")
      : [];
    const firstRowCells = partiesTable
      ? Array.from(partiesTable.querySelectorAll("tbody tr:first-child td"))
      : [];
    const cellBoxes = firstRowCells.map((td) => box(td));

    // Under print media every page is a FIXED A4 box; anything whose bottom
    // passes the box's bottom is genuinely clipped by the printer.
    const A4_H = 297 * (96 / 25.4);
    return {
      pages: pages.length,
      pageHeights: pages.map((p) => p.getBoundingClientRect().height),
      allPagesA4: pages.every((p) => Math.abs(p.getBoundingClientRect().height - A4_H) < 2),
      perPage,
      signatureCount: signatures.length,
      signaturePage: sigPageIndex + 1,
      signatureOnLastPage: sigPageIndex === pages.length - 1,
      signatureInsideLastPage:
        !!sigBox && !!lastPageBox && sigBox.top >= lastPageBox.top - 1 && sigBox.bottom <= lastPageBox.bottom + 1,
      signatureBoxCount: sigBoxes.length,
      // A ruled area inside each signer's box is the physical space a wet
      // signature goes in; a zero-height rule means no real signing area.
      signatureRulesLegible: rules.every((r) => r.getBoundingClientRect().height >= 6),
      partyHeaderCount: headers.length,
      headers,
      partyCells: cellBoxes.length,
      // RTL table ⇒ the first cell is the RIGHT column. Party 1 (landlord)
      // therefore sits in the SECOND cell, and its left edge is smaller.
      party1LeftOfParty2:
        cellBoxes.length === 2 && !!cellBoxes[1] && !!cellBoxes[0]
          ? cellBoxes[1].left < cellBoxes[0].left
          : false,
      rowTexts: firstRowCells.map((td) => td.textContent?.trim() ?? ""),
    };
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ sheetGeometry }, null, 2));

  // Every measured page really is a fixed A4 sheet in the print layout.
  expect(sheetGeometry.allPagesA4, "a page is not A4 height in print media").toBe(true);
  // §2.6 — every page carries a legible paraphe strip, never touching the
  // body, the last block, the footer note or the page number.
  for (const page of sheetGeometry.perPage) {
    expect(page.hasParaphe, `page ${page.index} has no paraphe strip`).toBe(true);
    expect(page.captionText, `page ${page.index} paraphe caption`).toContain("پاراف");
    expect(page.boxCount, `page ${page.index} paraphe boxes`).toBeGreaterThanOrEqual(2);
    expect(page.boxesLegible, `page ${page.index} paraphe boxes are too small to initial`).toBe(true);
    expect(page.parapheOverlapsBody, `page ${page.index} paraphe overlaps the body`).toBe(false);
    expect(page.parapheOverlapsLastBlock, `page ${page.index} paraphe overlaps the last block`).toBe(false);
    expect(page.parapheOverlapsFooterLine, `page ${page.index} paraphe overlaps the footer note`).toBe(false);
    expect(page.parapheOverlapsPageNumber, `page ${page.index} paraphe overlaps the page number`).toBe(false);
    expect(page.hasPageNumber, `page ${page.index} has no page number`).toBe(true);
  }
  // §2.6 — one signature block, unbroken, on the final page.
  expect(sheetGeometry.signatureCount, "the signature block is missing or duplicated").toBe(1);
  expect(sheetGeometry.signatureOnLastPage, "the signature block is not on the last page").toBe(true);
  expect(sheetGeometry.signatureInsideLastPage, "the signature block spills past its page").toBe(true);
  expect(sheetGeometry.signatureBoxCount, "not every signer has a signature box").toBeGreaterThanOrEqual(2);
  expect(sheetGeometry.signatureRulesLegible, "a signing rule has no writable height").toBe(true);
  // §2.5 — two columns; party 1 left, party 2 right.
  expect(sheetGeometry.partyHeaderCount, "the parties table is not two columns").toBe(2);
  expect(sheetGeometry.headers[0], "the right column is not party 2").toContain("مستأجر");
  expect(sheetGeometry.headers[1], "the left column is not party 1").toContain("موجر");
  expect(sheetGeometry.party1LeftOfParty2, "party 1 is not to the left of party 2").toBe(true);
  expect(sheetGeometry.rowTexts[1], "party 1's name is not in the left cell").toContain("مریم");
  expect(sheetGeometry.rowTexts[0], "party 2's name is not in the right cell").toContain("رضا");

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
    letterhead,
    tables,
    sheetGeometry,
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

  // Block B — letterhead: logo and identification sit top-left, the title
  // is centred on its own line, and nothing overlaps anything.
  expect(report.letterhead.logo, "the letterhead logo is missing").toBeTruthy();
  expect(report.letterhead.meta, "the identification block is missing").toBeTruthy();
  expect(report.letterhead.title, "the document title is missing").toBeTruthy();
  expect(report.letterhead.logoOverlapsMeta, "logo overlaps the identification block").toBe(false);
  expect(report.letterhead.logoOverlapsTitle, "logo overlaps the title").toBe(false);
  expect(report.letterhead.metaOverlapsTitle, "identification block overlaps the title").toBe(false);
  expect(report.letterhead.titleCentred, "the document title is not centred").toBe(true);
  // The identification block sits in the LEFT HALF of the sheet (the title
  // spans the full width, so its own box cannot be the reference point).
  const { container } = report.letterhead;
  const midpoint = container.left + container.width / 2;
  expect(report.letterhead.meta!.left).toBeLessThan(midpoint);
  expect(report.letterhead.logo!.left).toBeLessThan(midpoint);

  // Block B — tables: real tables with repeating headings and whole rows.
  expect(report.tables.length, "the document has no tables").toBeGreaterThan(0);
  for (const t of report.tables) {
    expect(t.hasThead, "a table has no heading row").toBe(true);
    expect(t.theadRepeats, "table headings do not repeat across pages").toBe(true);
    expect(t.rowUnsplittable, "a table row may be split across pages").toBe(true);
    expect(t.columns).toBeGreaterThan(1);
    expect(t.rows).toBeGreaterThan(0);
  }
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
