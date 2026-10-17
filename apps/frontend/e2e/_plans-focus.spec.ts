/**
 * TEMP reproduction spec (not committed) — focus retention while typing in the
 * /admin/plans create/edit Dialog. Reproduces the "focus jumps to another
 * field / text lands in the wrong field" bug reported for the admin panel.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;

let sessionId: string | null = null;

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`admin OTP request failed: ${JSON.stringify(reqBody)}`);
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`admin OTP verify failed: ${JSON.stringify(verifyBody)}`);
  sessionId = sid;
  return sid;
}

async function seedAdmin(page: Page, sid: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: sid,
          userId: "admin-user-id",
          mobileE164: ADMIN_MOBILE_E164,
          mobileDisplay: ADMIN_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

test("typing a multi-word name in the create-plan dialog stays in the field", async ({
  page,
  request,
}) => {
  const sid = await ensureSession(request);
  await seedAdmin(page, sid);

  await page.goto("/admin/plans");
  await expect(page).toHaveURL(/\/admin\/plans$/, { timeout: READY });

  await page.getByRole("button", { name: "ایجاد پلن" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: READY });

  const nameField = dialog.getByLabel("نام نمایشی");
  const codeField = dialog.getByLabel("شناسهٔ سیستمی");

  await nameField.click();
  await page.keyboard.type("پلن طلایی سالانه", { delay: 20 });

  // The full text must remain in the name field...
  await expect(nameField).toHaveValue("پلن طلایی سالانه");
  // ...must NOT leak into the sibling "system id" field...
  await expect(codeField).toHaveValue("");
  // ...and the name field must still be the active element.
  await expect(nameField).toBeFocused();
});
