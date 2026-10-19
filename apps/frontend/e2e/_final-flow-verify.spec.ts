/**
 * Verifies the SIMPLIFIED FINAL FLOW end to end, on a throwaway contract:
 *
 *   تکمیل اطلاعات تکمیلی → بازبینی و پیش‌نمایش → امضای طرفین → نسخه نهایی
 *
 * It pins the acceptance criteria that are about the flow itself:
 *
 *   • the wizard advances through the four final stages with no skipped
 *     and no duplicated stage;
 *   • the lifecycle rail inside the review stage names exactly the five
 *     real stages — a status («آمادهٔ بازبینی» و مانند آن) is never a
 *     separate step;
 *   • an unapproved contract's sheet carries the «پیش‌نویس» watermark and
 *     NO review mark — an unapproved version must never look approved;
 *   • the identity header on the sheet carries the contract's REAL
 *     reference code, the version label and a real state;
 *   • saving is durable: an edit survives a reload.
 *
 * Every contract this spec creates is deleted at the end. The walk starts
 * from the supplementary stage on a fully-answered contract, because the
 * wizard's own «مرحله بعد» refuses to advance a step that still owns
 * missing required data — that gate is itself part of the flow.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

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

/** Suppress the "complete your profile" modal so it never covers the wizard. */
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

/** A fully-answered rent contract, so the four final stages are reachable. */
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
}

/**
 * Create a throwaway rent contract, fill every owned section and park the
 * wizard on the requested stage — the same server write the wizard itself
 * performs (`PATCH currentStep` + `data`).
 */
async function seedContract(
  request: APIRequestContext,
  sessionId: string,
  currentStep: "supplementary" | "review"
): Promise<{ id: string; referenceCode: string }> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: {
      type: "property_rent",
      propertyKind: "apartment",
      title: "قرارداد آزمون جریان نهایی",
    },
  });
  expect(created.ok(), `create failed: ${created.status()}`).toBeTruthy();
  const body = (await created.json()) as {
    data?: { id?: string; referenceCode?: string };
  };
  const id = body.data?.id;
  const referenceCode = body.data?.referenceCode;
  if (!id || !referenceCode) throw new Error("create returned no id/referenceCode");

  const detailRes = await request.get(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
  });
  const detail = ((await detailRes.json()) as {
    data?: { data?: Record<string, unknown> };
  }).data;
  const base = (detail?.data ?? {}) as Record<string, unknown>;

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { data: filledRentData(base), currentStep },
  });
  if (!patched.ok()) {
    throw new Error(`patch failed: ${patched.status()} ${await patched.text()}`);
  }

  for (const party of rentParties()) {
    const res = await request.put(`/api/v1/property-contracts/${id}/parties`, {
      headers: { cookie },
      data: party,
    });
    if (!res.ok()) throw new Error(`party failed: ${res.status()} ${await res.text()}`);
  }

  return { id, referenceCode };
}

/** The wizard shell is client-rendered; wait for its own back control. */
async function waitForWizard(page: Page) {
  await expect(page.getByRole("button", { name: "مرحله قبل" })).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("final flow · four ordered stages, honest marks, durable save", () => {
  test("advances through the four final stages without a skipped or duplicated stage", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const sessionId = await getSession(request);
    const draft = await seedContract(request, sessionId, "supplementary");
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      await page.goto(`/contracts/${draft.id}`, { waitUntil: "domcontentloaded" });
      await waitForWizard(page);

      const proceed = page.getByRole("button", { name: "مرحله بعد" });
      const heading = page.locator("main h2").first();
      const seen: string[] = [];

      for (let hop = 0; hop < 6; hop++) {
        const title = (await heading.textContent())?.trim() ?? "";
        if (title && seen.at(-1) !== title) seen.push(title);

        // The review stage draws the lifecycle rail. Its five labels are
        // the REAL stages — no status is promoted to a step of its own.
        if (title === "بازبینی و پیش‌نمایش") {
          const rail = page.getByRole("list", { name: "مراحل قرارداد" });
          await expect(rail).toBeVisible();
          const labels = await rail
            .getByRole("button")
            .evaluateAll((els) =>
              els.map((el) => (el.textContent ?? "").trim().replace(/^\d+/, ""))
            );
          expect(labels).toEqual(["اطلاعات", "پیش‌نمایش", "بررسی", "امضا", "تکمیل"]);
        }

        // The last stage owns no «مرحله بعد»; the walk is over.
        if (!(await proceed.isVisible().catch(() => false))) break;
        if (!(await proceed.isEnabled().catch(() => false))) break;

        await proceed.click();
        // Each hop must land on a NEW title: a stage that re-renders in
        // place would mean the user was never actually moved forward.
        await expect
          .poll(async () => (await heading.textContent())?.trim() ?? "", {
            timeout: 20_000,
          })
          .not.toBe(title);
      }

      // Exactly the four final stages, in order, each exactly once — and
      // review precedes signature, so nobody signs content they never saw.
      expect(seen, `the final flow drew: ${seen.join(" → ")}`).toEqual([
        "تکمیل اطلاعات تکمیلی",
        "بازبینی و پیش‌نمایش",
        "امضای طرفین",
        "نسخه نهایی",
      ]);
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("an unapproved sheet is watermarked, carries no review mark, and keeps a real header", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const sessionId = await getSession(request);
    const draft = await seedContract(request, sessionId, "review");
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      // Content is complete but no version has been frozen yet, so the PDF
      // route answers 409 honestly instead of inventing an artifact.
      const res = await request.get(`/api/v1/property-contracts/${draft.id}/pdf`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
      expect([200, 409]).toContain(res.status());
      if (res.ok()) expect(res.headers()["content-type"]).toContain("application/pdf");

      await page.goto(`/contracts/${draft.id}`, { waitUntil: "domcontentloaded" });
      await waitForWizard(page);
      await expect(page.locator("main h2").first()).toHaveText("بازبینی و پیش‌نمایش", {
        timeout: 30_000,
      });

      const sheet = page.locator(".a4-pages-inner .a4-page").first();
      await expect(sheet).toBeVisible({ timeout: 60_000 });

      // Unapproved ⇒ the watermarked draft, never a fabricated review mark.
      await expect(sheet.locator(".a4-watermark")).toHaveCount(1);
      await expect(sheet.locator(".a4-review-stamp-title")).toHaveCount(0);
      await expect(sheet.locator(".a4-letterhead img.a4-seal")).toHaveCount(0);

      // §5 — the header is the sheet's identity, from REAL data.
      const meta = (await sheet.locator(".a4-letterhead-meta").innerText())
        .replace(/\s+/g, "")
        .replace(/\u200c/g, "");
      expect(meta).toContain(draft.referenceCode);
      expect(meta).toContain("شناسهقرارداد:");
      expect(meta).toContain("تاریخقرارداد:");
      expect(meta).toContain("نسخهقالب:");
      expect(meta).toContain("وضعیت:");
      // No version exists yet, so the label says so rather than printing a
      // made-up version number.
      expect(meta).toContain("پیشنویس(ثبتنشده)");
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("an edit is durable across a reload", async ({ page, request }) => {
    test.setTimeout(240_000);
    const sessionId = await getSession(request);
    const draft = await seedContract(request, sessionId, "review");
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      await page.goto(`/contracts/${draft.id}`, { waitUntil: "domcontentloaded" });
      await waitForWizard(page);

      // The summary row is the wizard's own navigation surface, so this is
      // the control a user presses to reach the financial step.
      await page.getByRole("button", { name: /^شرایط مالی/ }).click();
      await expect(page.locator("main h2").first()).toHaveText("شرایط مالی", {
        timeout: 20_000,
      });

      // The shortest honest edit: the rent due day in the financial section.
      const dueDay = page.getByLabel("روز سررسید پرداخت اجاره").first();
      await dueDay.fill("7");
      // Autosave is debounced, so wait for the header's own confirmation
      // rather than a fixed sleep.
      await expect(page.getByText("همه تغییرات ذخیره شده‌اند")).toBeVisible({
        timeout: 30_000,
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForWizard(page);
      // The wizard also persists the step, so the reload returns to it.
      await expect(page.locator("main h2").first()).toHaveText("شرایط مالی", {
        timeout: 30_000,
      });
      await expect(page.getByLabel("روز سررسید پرداخت اجاره").first()).toHaveValue(
        "7",
        { timeout: 30_000 }
      );
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });
});
