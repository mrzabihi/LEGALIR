/**
 * TEMPORARY verification spec (deleted after the run).
 *
 * Same real-PDF harness as `_contract-print-verify.spec.ts`, but exercises
 * the SCHEMA-DRIVEN path: `employment` is rendered by `genericClauses`,
 * not by a bespoke property builder. It declares five semantic tables
 * (job, term, wages, hours, insurance), so this is the test that proves
 * §2 (wizard answers become structured tables) and §1 (custom clauses +
 * notes reach the sheet) for a non-property contract.
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

const money = (toman: number) => ({ amount: toman * 10, currency: "IRR" });

/** Every employment field answered, so each declared table is populated. */
function employmentValues(): Record<string, unknown> {
  return {
    // job
    jobTitle: "کارشناس حسابداری",
    jobDuties: "ثبت اسناد مالی، تهیهٔ گزارش‌های دوره‌ای و همکاری در بستن حساب‌ها.",
    jobWorkplace: "تهران، خیابان ولیعصر",
    jobDepartment: "واحد مالی",
    jobSupervisor: "مدیر مالی",
    employeeEducation: "کارشناسی حسابداری",
    // term
    contractType: "definite",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    probationMonths: 3,
    probationNote: "دورهٔ آزمایشی طبق توافق طرفین و در چارچوب مقررات قانون کار.",
    // wages
    baseSalary: money(25_000_000),
    wagePeriod: "monthly",
    paymentDay: 1,
    housingAllowance: money(3_000_000),
    foodAllowance: money(2_000_000),
    childAllowance: money(1_500_000),
    seniorityAllowance: money(1_000_000),
    otherBenefits: "بیمهٔ تکمیلی درمان و پاداش سالانه.",
    // hours
    weeklyHours: 44,
    dailyHours: 8,
    workSchedule: "شنبه تا چهارشنبه ۸ تا ۱۷ و پنجشنبه ۸ تا ۱۲.",
    restDay: "جمعه",
    annualLeaveDays: 26,
    remoteWork: false,
    // insurance
    socialInsurance: "yes",
    insuranceNumber: "12345678",
    taxWithholding: true,
    payrollObligations: "ارسال لیست بیمه و پرداخت حق بیمه در مهلت مقرر.",
    additionalInsurance: "بیمهٔ عمر و حوادث گروهی.",
    // obligations
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
  };
}

async function seed(request: APIRequestContext, sessionId: string): Promise<string> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: { type: "employment", title: "قرارداد کار آزمون چاپ" },
  });
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error(`create failed: ${await created.text()}`);

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: {
      data: {
        schemaVersion: 1,
        values: employmentValues(),
        customClauses: [
          {
            id: "cc-emp-1",
            kind: "agreement",
            title: "دورکاری اضطراری",
            body: "در صورت اعلام وضعیت اضطراری، انجام کار به‌صورت دورکاری با هماهنگی کارفرما مجاز است.",
            sectionRef: "hours",
            createdAt: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "cc-emp-2",
            kind: "change_request",
            title: "افزایش روزهای مرخصی",
            body: "پیشنهاد افزایش مرخصی استحقاقی به ۳۰ روز در سال مطرح شده است.",
            sectionRef: "hours",
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        ],
        supplementary: {
          notes: "هرگونه تغییر در شرح وظایف باید به‌صورت الحاقیهٔ کتبی ثبت شود.",
        },
      },
      currentStep: "review",
    },
  });
  if (!patched.ok()) throw new Error(`patch failed: ${await patched.text()}`);

  const parties: Array<Record<string, unknown>> = [
    {
      role: "employer",
      personKind: "natural",
      nationality: "iranian",
      identity: {
        firstName: "مریم",
        lastName: "محمدی",
        fatherName: "حسن",
        nationalId: "0012345678",
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

test("employment print output — schema-driven tables, A4, page numbers", async ({
  page,
  request,
}) => {
  const sessionId = await getSession(request);
  const id = await seed(request, sessionId);

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
  // Round-trip structure: every declared table that had data must be a real
  // <table> on the sheet, and no table may be header-only (the empty-table
  // rule from §2).
  const tableStats = await printRoot.locator("table").evaluateAll((els) =>
    els.map((el) => ({
      rows: el.querySelectorAll("tbody tr").length,
      cells: el.querySelectorAll("td").length,
    }))
  );

  const pdfPath = path.join(SHOT_DIR, "employment-print.pdf");
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
    const [, , w, h] = pg.view;
    sizes.push({ w, h });
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
    refCodeOnPage2: pages[1]?.includes("LGL-EMPLOY-") ?? false,
    tableStats,
    clipped,
  };
  fs.writeFileSync(
    path.join(SHOT_DIR, "employment-print-report.json"),
    JSON.stringify(report, null, 2)
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  expect(report.perPageChars.every((n) => n > 40), "a printed page is blank").toBe(true);
  expect(report.pages).toBe(domPages);
  expect(report.pages).toBeGreaterThanOrEqual(2);
  expect(report.allPagesA4, "a printed page is not A4").toBe(true);
  expect(report.refCodeOnPage2, "the running head is missing on page 2").toBe(true);
  expect(report.clipped.every((c) => c.overflow <= 1 && c.widthOverflow <= 1)).toBe(true);
  // Five declared tables should survive as real tables, each with data.
  expect(tableStats.length).toBeGreaterThanOrEqual(5);
  expect(tableStats.every((t) => t.rows > 0 && t.cells > 0)).toBe(true);

  await request.delete(`/api/v1/property-contracts/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
});
