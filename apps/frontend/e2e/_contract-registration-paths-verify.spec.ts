/**
 * ============================================================
 * LEGALIR — the two registration paths, end to end, in the REAL browser
 * ============================================================
 * The route layer is covered by `contract-signing-flows.test.ts`. What
 * that cannot prove is what a PERSON sees, so this spec drives the same
 * decisions through the UI, on throwaway contracts:
 *
 *   ۱. «ارسال برای بررسی در لیگالیر» and «ثبت نهایی» are both offered,
 *      side by side, and neither is a hidden default.
 *   ۲. «ثبت نهایی» is refused until the unreviewed warning is ticked.
 *   ۳. After «ثبت نهایی» the contract goes to the signature stage, the
 *      review stage shows «بدون بررسی لیگالیر» — and no review mark is
 *      drawn on the sheet.
 *   ۴. After «ارسال به بررسی», the admin panel shows the contract IN the
 *      review queue — the unreviewed path never puts one there.
 *   ۵. «دانلود PDF» opens in a NEW tab (never the current one).
 *
 * Every contract this spec creates is deleted at the end.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ensureAdminSession, SESSION_COOKIE as ADMIN_COOKIE } from "./support/admin-session";

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

async function mockAdminAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: ADMIN_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
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

/** A fully-answered rent contract — the same shape the wizard writes. */
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

/** Create a complete, frozen rent contract parked on the review stage. */
async function seedFrozenContract(
  request: APIRequestContext,
  sessionId: string
): Promise<{ id: string; referenceCode: string }> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: { type: "property_rent", propertyKind: "apartment", title: "قرارداد آزمون مسیرهای ثبت" },
  });
  expect(created.ok(), `create failed: ${created.status()}`).toBeTruthy();
  const body = (await created.json()) as { data?: { id?: string; referenceCode?: string } };
  const id = body.data?.id;
  const referenceCode = body.data?.referenceCode;
  if (!id || !referenceCode) throw new Error("create returned no id/referenceCode");

  const detailRes = await request.get(`/api/v1/property-contracts/${id}`, { headers: { cookie } });
  const detail = ((await detailRes.json()) as { data?: { data?: Record<string, unknown> } }).data;
  const base = (detail?.data ?? {}) as Record<string, unknown>;

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { data: filledRentData(base), currentStep: "review" },
  });
  if (!patched.ok()) throw new Error(`patch failed: ${patched.status()} ${await patched.text()}`);

  for (const party of rentParties()) {
    const res = await request.put(`/api/v1/property-contracts/${id}/parties`, {
      headers: { cookie },
      data: party,
    });
    if (!res.ok()) throw new Error(`party failed: ${res.status()} ${await res.text()}`);
  }

  // The three documents the rent type makes compulsory. Without them the
  // contract is not "ready for review" and neither path may be entered —
  // which is itself the gate being tested elsewhere.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  for (const category of ["deed", "landlord_id", "tenant_id"] as const) {
    const uploaded = await request.post(`/api/v1/property-contracts/${id}/documents`, {
      headers: { cookie },
      multipart: {
        category,
        file: { name: `${category}.png`, mimeType: "image/png", buffer: png },
      },
    });
    if (!uploaded.ok()) throw new Error(`upload ${category} failed: ${uploaded.status()}`);
  }

  // Freeze the content — the review stage can do nothing until a version
  // exists, and both registration paths are bound to that version's hash.
  const frozen = await request.post(`/api/v1/property-contracts/${id}/review`, {
    headers: { cookie },
    data: { action: "submit" },
  });
  if (!frozen.ok()) throw new Error(`submit failed: ${frozen.status()} ${await frozen.text()}`);

  return { id, referenceCode };
}

async function waitForWizard(page: Page) {
  await expect(page.getByRole("button", { name: "مرحله قبل" })).toBeVisible({
    timeout: 120_000,
  });
}

async function openReviewStage(page: Page, id: string) {
  await page.goto(`/contracts/${id}`, { waitUntil: "domcontentloaded" });
  await waitForWizard(page);
  await expect(page.locator("main h2").first()).toHaveText("بازبینی و پیش‌نمایش", {
    timeout: 60_000,
  });
}

test.describe("two registration paths — offered together, never conflated", () => {
  test("both paths are visible, and «ثبت نهایی» needs the acknowledgement", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const sessionId = await getSession(request);
    const draft = await seedFrozenContract(request, sessionId);
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      await openReviewStage(page, draft.id);

      // Both cards are on screen — neither path is buried behind the other.
      // The A4 preview also names each path in its own summary table, so
      // scope the lookup to the first (the action card) match.
      await expect(
        page.getByText("ارسال برای بررسی در لیگالیر", { exact: true }).first()
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("ثبت نهایی", { exact: true }).first()).toBeVisible();

      // The warning is stated up front, not after the fact.
      await expect(
        page.getByText(/بدون بررسی لیگالیر ثبت نهایی می‌شود/, { exact: false }).first()
      ).toBeVisible();

      const finalButton = page.getByRole("button", { name: /ثبت نهایی بدون بررسی/ });
      await expect(finalButton).toBeDisabled();

      // Ticking the acknowledgement unlocks it — the server refuses the
      // same call without the same flag.
      await page.getByRole("checkbox").first().check();
      await expect(finalButton).toBeEnabled();
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("«ثبت نهایی» moves straight to signing and says it was not reviewed", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const sessionId = await getSession(request);
    const draft = await seedFrozenContract(request, sessionId);
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      await openReviewStage(page, draft.id);

      // Do it through the API so the assertion is about the RESULTING
      // state rather than a button's spinner timing.
      const res = await request.post(`/api/v1/property-contracts/${draft.id}/review`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
        data: { action: "final_register", acknowledgedUnreviewed: true },
      });
      expect(res.status()).toBe(200);
      const registered = (await res.json()) as {
        data: {
          contract: { state: string };
          registration: { path: string; reviewedByLegalir: boolean; actorKind: string };
        };
      };
      expect(registered.data.contract.state).toBe("READY_TO_SIGN");
      expect(registered.data.registration.path).toBe("self_final");
      expect(registered.data.registration.reviewedByLegalir).toBe(false);
      expect(registered.data.registration.actorKind).toBe("party");

      // The review stage now says so, in plain words.
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForWizard(page);
      await expect(
        page.getByText("این نسخه بدون بررسی لیگالیر ثبت نهایی شد", { exact: true })
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/این سند «بررسی‌شده» یا/)).toBeVisible();

      // ...and no review mark is drawn on the sheet: registration is not a
      // review, so the blue stamp must be absent.
      const sheet = page.locator(".a4-pages-inner .a4-page").first();
      await expect(sheet).toBeVisible({ timeout: 60_000 });
      await expect(sheet.locator(".a4-review-stamp-title")).toHaveCount(0);
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("«ارسال به بررسی» queues the contract for the admin, unlike «ثبت نهایی»", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const sessionId = await getSession(request);
    const draft = await seedFrozenContract(request, sessionId);
    const admin = await ensureAdminSession(request);
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    try {
      const res = await request.post(`/api/v1/property-contracts/${draft.id}/review`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
        data: { action: "submit_admin" },
      });
      expect(res.status()).toBe(200);
      const submitted = (await res.json()) as {
        data: { contract: { state: string }; review: { id: string; status: string } };
      };
      expect(submitted.data.contract.state).toBe("PENDING_ADMIN_REVIEW");
      expect(submitted.data.review.status).not.toBe("APPROVED");

      // The admin panel lists it. A contract on the unreviewed path would
      // NOT be here, which is the whole point of the separation.
      await mockAdminAuth(page, admin.sessionId);
      await page.goto("/admin/contracts", { waitUntil: "domcontentloaded" });
      // The admin shell re-renders the same title in its banner, so the page
      // heading is scoped to `main`.
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 })
      ).toBeVisible({ timeout: 60_000 });
      // The contract's own reference code is what proves the REAL panel
      // rendered rather than the access-denied shell.
      await expect(page.getByText(draft.referenceCode, { exact: false }).first()).toBeVisible({
        timeout: 60_000,
      });
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("«دانلود PDF» opens the document in a NEW tab — desktop AND phone", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const sessionId = await getSession(request);
    const draft = await seedFrozenContract(request, sessionId);
    await mockAuth(page, sessionId);
    await suppressProfilePrompt(page);

    /**
     * The link must be a real `<a target="_blank">` at every width: that is
     * what makes a DESKTOP CLICK and a PHONE TAP behave the same — the
     * browser opens a new tab from the anchor itself, with no JS download
     * path that a touch device (or a blocked popup) could swallow.
     */
    async function expectNewTabLink() {
      const link = page.getByRole("link", { name: /دانلود PDF/ }).first();
      await expect(link).toBeVisible({ timeout: 60_000 });
      await expect(link).toHaveAttribute("target", "_blank");
      // `noreferrer` implies `noopener`; either is a safe opener policy.
      await expect(link).toHaveAttribute("rel", /(noopener|noreferrer)/);
      // The href must be the real PDF route, not a client-side download.
      await expect(link).toHaveAttribute(
        "href",
        new RegExp(`/property-contracts/${draft.id}/pdf`)
      );
    }

    try {
      await openReviewStage(page, draft.id);
      await expectNewTabLink();

      // Re-check on a phone viewport on the SAME contract: no responsive
      // branch may swap the anchor for a handler that hijacks the tap.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForWizard(page);
      await expectNewTabLink();
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });

  test("the admin drawer shows an unreviewed registration as unreviewed, and the message is capped at 100", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const sessionId = await getSession(request);
    const draft = await seedFrozenContract(request, sessionId);
    const admin = await ensureAdminSession(request);
    const reason = "طرفین فوریت دارند و بررسی دستی صورت گرفته است";

    try {
      // §T4 — an authorised operator advances the contract WITH a written
      // reason. The route is already covered; here it is the setup for what
      // the PANEL must then say.
      const advanced = await request.post(`/api/v1/admin/contracts/${draft.id}/advance-signing`, {
        headers: { cookie: `${SESSION_COOKIE}=${admin.sessionId}` },
        data: { reasonFa: reason },
      });
      expect(advanced.status()).toBe(200);

      await mockAdminAuth(page, admin.sessionId);
      await page.goto("/admin/contracts", { waitUntil: "domcontentloaded" });
      await page
        .getByPlaceholder("جستجو در کد پیگیری، عنوان، مالک یا طرفین")
        .fill(draft.referenceCode);
      const row = page.getByRole("row").filter({ hasText: draft.referenceCode });
      await expect(row).toBeVisible({ timeout: 60_000 });
      await row.getByRole("button", { name: "بررسی" }).click();

      // §3/§4 — the panel must never launder an unreviewed registration into
      // a reviewed one. Three independent statements of the same fact:
      // the warning banner, the status row, and the origin badge.
      await expect(
        page.getByText("این نسخه توسط لیگالیر بررسی نشده است", { exact: true })
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("بررسی‌نشده توسط لیگالیر", { exact: true })).toBeVisible();
      await expect(page.getByText(/\(ادمین\)/).first()).toBeVisible();
      // The operator's own written reason is on record, not hidden.
      await expect(page.getByText(`دلیل ثبت: ${reason}`, { exact: true })).toBeVisible();

      // §6 — the printable message is capped by CODE POINTS, the counter
      // says exactly how many remain, and over-limit blocks the save.
      const messageField = page.getByLabel("متن پیام");
      await messageField.fill("م".repeat(101));
      await expect(page.getByText(/کاراکتر بیش از حد مجاز/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "ذخیرهٔ پیام چاپی" })).toBeDisabled();

      await messageField.fill("م".repeat(100));
      await expect(page.getByText(/۰ کاراکتر باقی مانده/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "ذخیرهٔ پیام چاپی" })).toBeEnabled();
    } finally {
      await request.delete(`/api/v1/property-contracts/${draft.id}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
      });
    }
  });
});
