/**
 * TEMP verification spec — the OWNER's on-screen A4 sheet must show the
 * official seal + hologram at the bottom of every page, the same place the
 * server PDF draws them.
 *
 * Read-only: it opens the seeded sample contract in its review step and
 * inspects the rendered DOM. Nothing is edited, submitted or deleted.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SAMPLE_REF = "LGL-SAMPLE-1405";
const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

let cachedSessionId: string | null = null;

async function ownerSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sessionId) throw new Error("could not open the sample owner's session");
  cachedSessionId = sessionId;
  return sessionId;
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

/** The seeded sample contract's id, read from the owner's own list. */
async function sampleId(request: APIRequestContext, sessionId: string): Promise<string> {
  const res = await request.get("/api/v1/property-contracts?pageSize=100", {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    data?: { items?: { id: string; referenceCode: string }[] };
  };
  const row = body.data?.items?.find((i) => i.referenceCode === SAMPLE_REF);
  expect(row, `sample ${SAMPLE_REF} must be listed for its owner`).toBeTruthy();
  return row!.id;
}

test.describe("owner · the A4 sheet carries the official mark on every page", () => {
  test("each rendered page paints the seal and hologram in its footer", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const sessionId = await ownerSession(request);
    await mockAuth(page, sessionId);
    const id = await sampleId(request, sessionId);

    await page.goto(`/contracts/${id}`, { waitUntil: "domcontentloaded" });

    // Reach the live A4 sheet regardless of which wizard step the sample is
    // parked on. The review step embeds it inline (LivePreview); the
    // signature step links to it with «مشاهدهٔ پیش‌نمایش کامل (A4)». The
    // sheet is what is under test, not the rail that leads to it — and the
    // server-side `currentStep` may legitimately differ between runs.
    const pages = page.locator(".a4-pages-inner .a4-page");
    const openSheet = page.getByRole("button", { name: "مشاهدهٔ پیش‌نمایش کامل (A4)" });
    const proceed = page.getByRole("button", { name: "مرحله بعد" });

    // Cold-compile a heavy client route in dev; 30s was not enough after a
    // server restart, so wait for the wizard shell itself first.
    await expect(page.getByRole("button", { name: "مرحله قبل" })).toBeVisible({
      timeout: 120_000,
    });

    for (let hop = 0; hop < 5; hop++) {
      if (await pages.first().isVisible().catch(() => false)) break;
      if (await openSheet.isVisible().catch(() => false)) {
        await openSheet.click();
        break;
      }
      if (!(await proceed.isEnabled().catch(() => false))) break;
      const heading = page.locator("main h2").first();
      const before = (await heading.textContent()) ?? "";
      await proceed.click();
      // The step body re-renders in place; wait for its title to change.
      await expect
        .poll(async () => (await heading.textContent()) ?? "", { timeout: 20_000 })
        .not.toBe(before);
    }

    await expect(pages.first()).toBeVisible({ timeout: 60_000 });
    const count = await pages.count();
    expect(count, "a finalized contract renders more than one A4 page").toBeGreaterThan(1);

    // Every page: one seal + one hologram inside its footer, both decoded.
    for (let i = 0; i < count; i++) {
      const footer = pages.nth(i).locator(".a4-page-footer");
      const seal = footer.locator("img.a4-seal");
      const hologram = footer.locator("img.a4-hologram");
      await expect(seal).toHaveCount(1);
      await expect(hologram).toHaveCount(1);
      // `naturalWidth > 0` proves the permission-gated asset really loaded
      // for this owner — a 401/404 would leave a broken image at width 0.
      // The masters are large PNGs, so wait for the decode rather than
      // sampling `complete` on the same tick the node was inserted.
      await expect
        .poll(
          async () =>
            seal.evaluate(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0
            ),
          { message: `page ${i + 1}: the seal image did not load`, timeout: 30_000 }
        )
        .toBe(true);
      await expect
        .poll(
          async () =>
            hologram.evaluate(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0
            ),
          { message: `page ${i + 1}: the hologram image did not load`, timeout: 30_000 }
        )
        .toBe(true);
    }

    // Nothing ever overlaps: the letterhead must not carry a seal image.
    const letterheadSeals = await page.locator(".a4-letterhead img.a4-seal").count();
    expect(letterheadSeals).toBe(0);

    // §4 — the enlarged marks are the SAME size and place on every page:
    // the seal is 40mm tall (2.5× the old 16mm), the hologram 32mm (2×),
    // and the pair sits at the physical BOTTOM-LEFT of the sheet.
    const MM = 96 / 25.4;
    for (let i = 0; i < count; i++) {
      const sheet = pages.nth(i);
      const sheetBox = (await sheet.boundingBox())!;
      const sealBox = (await sheet.locator("img.a4-seal").boundingBox())!;
      const holoBox = (await sheet.locator("img.a4-hologram").boundingBox())!;

      expect(Math.abs(sealBox.height - 40 * MM), `page ${i + 1}: seal is not 40mm`).toBeLessThan(2);
      expect(Math.abs(holoBox.height - 32 * MM), `page ${i + 1}: hologram is not 32mm`).toBeLessThan(2);

      // Bottom-left: the hologram is the leftmost item and both sit in the
      // footer band, well below the mid-line of the sheet.
      expect(
        holoBox.x,
        `page ${i + 1}: the hologram is not to the left of the seal`
      ).toBeLessThan(sealBox.x);
      expect(
        holoBox.x - sheetBox.x,
        `page ${i + 1}: the hologram is not near the physical left edge`
      ).toBeLessThan(40 * MM);
      expect(
        sealBox.y - sheetBox.y,
        `page ${i + 1}: the marks are not in the lower half of the sheet`
      ).toBeGreaterThan(sheetBox.height / 2);

      // Neither mark may spill outside the sheet it belongs to.
      for (const [label, b] of [
        ["seal", sealBox],
        ["hologram", holoBox],
      ] as const) {
        expect(b.x, `page ${i + 1}: the ${label} starts left of the sheet`).toBeGreaterThanOrEqual(
          sheetBox.x - 1
        );
        expect(
          b.y + b.height,
          `page ${i + 1}: the ${label} overflows the sheet bottom`
        ).toBeLessThanOrEqual(sheetBox.y + sheetBox.height + 1);
      }
    }

    // --- the SIGNING half is visible on the same document ----------------
    // The sheet is the evidence of who signed what: one real RTL table row
    // per party, each carrying its own stored status and, when signed, the
    // Jalali date. Scoped to the VISIBLE sheet — the hidden measurer
    // renders the same blocks and would otherwise double the count.
    const rows = page.locator(".a4-pages-inner .a4-signature-table tbody tr");
    await expect(rows).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const row = rows.nth(i);
      // A stored state, never the blank «در انتظار امضا» placeholder.
      await expect(row.locator(".a4-signature-state-label")).toHaveText(/امضا/);
      // A real Jalali date beside it — never the un-dated rule «……………».
      const dateText = (await row.locator(".a4-signature-date").textContent()) ?? "";
      expect(dateText).toMatch(/[۰-۹0-9]/);
      expect(dateText).not.toContain("……………");
    }
    // The document is NOT watermarked: a finalized, sealed contract.
    await expect(page.locator(".a4-pages-inner .a4-watermark")).toHaveCount(0);

    // Evidence: the footer band of page 1 and of the last page, which is
    // exactly where the seal + hologram must appear on every sheet.
    const shots = path.join("e2e", "__shots__", "a4-live-seal");
    fs.mkdirSync(shots, { recursive: true });
    for (const [label, index] of [
      ["page1", 0],
      ["last", count - 1],
    ] as const) {
      await pages.nth(index).locator(".a4-page-footer").screenshot({
        path: path.join(shots, `footer-band-${label}.png`),
      });
    }
  });
});
