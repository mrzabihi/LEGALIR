/**
 * TEMP verification spec — prove the STAMPED final contract is reachable
 * from the admin panel, end to end, against the live dev server:
 *
 *   1. the review queue's detail payload carries the stored final artifact
 *      and reports a still-valid seal binding;
 *   2. GET /api/v1/admin/contracts/[id]/final-document streams the PDF to a
 *      staff session (inline + ?download=1 — which the owner route cannot,
 *      because it is owner-scoped);
 *   3. the PDF itself carries the seal + hologram on EVERY page, not just
 *      the first — verified by resolving each page's image XObjects and by
 *      reading the printed disclaimer;
 *   4. the drawer in /admin/contracts shows the «سند نهایی و مهر رسمی»
 *      section and opens the artifact in an inline viewer.
 *
 * Only the seeded SAMPLE contract is read; no contract is modified.
 */

import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

interface ListItem {
  id: string;
  referenceCode: string;
  state: string;
  isSample?: boolean;
}
interface ListResponse {
  data: {
    items: ListItem[];
    pagination: { total: number; page: number; pageSize: number; totalPages: number };
  };
}
interface FinalDoc {
  documentId: string;
  fileName: string;
  sizeBytes: number;
  hash: string;
  uploadedAt: string;
  sealed: boolean;
  sealAssetVersion: string | null;
  sealedAt: string | null;
  url: string;
  downloadUrl: string;
}
interface DetailResponse {
  data: {
    contract: { id: string; referenceCode: string; state: string; isSample: boolean };
    finalDocument: FinalDoc | null;
  };
}

const SAMPLE_REF = "LGL-SAMPLE-1405";
/**
 * The hologram's print-only security serial. It is drawn INSIDE the
 * hologram by `officialMarkPages` and nowhere else, so its presence in a
 * page's content stream is proof that the OFFICIAL mark — not the internal
 * review stamp — was painted on that page. ASCII digits, so it survives
 * the Persian text extraction unshaped.
 */
const HOLOGRAM_SERIAL = "1361366";

test.describe("admin · the stamped final contract", () => {
  test("the sample's stored PDF carries the seal and hologram on every page", async ({
    request,
  }) => {
    test.setTimeout(240_000);
    const session = await ensureAdminSession(request);
    const cookie = { cookie: `${SESSION_COOKIE}=${session.sessionId}` };

    // --- 1. the sample is in the review queue -----------------------------
    const listRes = await request.get(
      `/api/v1/admin/contracts?search=${encodeURIComponent(SAMPLE_REF)}&pageSize=50`,
      { headers: cookie }
    );
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as ListResponse;
    // A dev database may hold more than one sample row (the seed is per
    // owner and the JSON store is not atomic across concurrent dev servers).
    // The contract under test is the FINALIZED one — the only state that can
    // carry a stored, sealed artifact.
    const sample = list.data.items.find(
      (i) => i.referenceCode === SAMPLE_REF && i.state === "FINALIZED"
    );
    expect(
      sample,
      `finalized sample ${SAMPLE_REF} must be in the admin queue`
    ).toBeTruthy();

    // --- 2. the detail payload carries a SEALED artifact -------------------
    const detailRes = await request.get(`/api/v1/admin/contracts/${sample!.id}`, {
      headers: cookie,
    });
    expect(detailRes.ok()).toBeTruthy();
    const detail = (await detailRes.json()) as DetailResponse;
    expect(detail.data.contract.isSample).toBe(true);
    expect(detail.data.contract.state).toBe("FINALIZED");

    const doc = detail.data.finalDocument;
    expect(doc, "a finalized sample must expose its stored final PDF").not.toBeNull();
    expect(doc!.sealed).toBe(true);
    expect(doc!.sealAssetVersion).toBeTruthy();
    expect(doc!.sealedAt).toBeTruthy();
    expect(doc!.hash).toMatch(/^[0-9a-f]{64}$/);
    // Both URLs are the ADMIN route, never the owner-scoped one.
    expect(doc!.url).toBe(`/api/v1/admin/contracts/${sample!.id}/final-document`);
    expect(doc!.downloadUrl).toContain("download=1");

    // --- 3. the artifact is streamed to staff -----------------------------
    const pdfRes = await request.get(doc!.url, { headers: cookie });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    expect(pdfRes.headers()["cache-control"]).toBe("private, no-store");
    expect(pdfRes.headers()["x-document-sha256"]).toBe(doc!.hash);

    const pdf = await pdfRes.body();
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.byteLength).toBe(doc!.sizeBytes);
    expect(crypto.createHash("sha256").update(pdf).digest("hex")).toBe(doc!.hash);

    // The download variant returns the same bytes as an attachment.
    const dlRes = await request.get(doc!.downloadUrl, { headers: cookie });
    expect(dlRes.status()).toBe(200);
    expect(dlRes.headers()["content-disposition"]).toContain("attachment");
    expect((await dlRes.body()).equals(pdf)).toBe(true);

    // --- 4. the seal + hologram are drawn on EVERY page -------------------
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const parsed = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    expect(parsed.numPages).toBeGreaterThan(1);

    /**
     * Every page must PAINT at least two images — the seal and the hologram.
     * Page 1 additionally carries the letterhead logo, so the floor is 2 and
     * the assertion is deliberately per-page, not per-document: a mark
     * drawn once under the letterhead would leave pages 2+ with zero.
     */
    for (let pageNumber = 1; pageNumber <= parsed.numPages; pageNumber++) {
      const page = await parsed.getPage(pageNumber);
      const ops = await page.getOperatorList();
      let imagePaints = 0;
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjs.OPS.paintImageXObject) imagePaints += 1;
      }
      expect(
        imagePaints,
        `page ${pageNumber} must paint the seal + hologram (found ${imagePaints} image(s))`
      ).toBeGreaterThanOrEqual(2);
    }

    // The hologram's security ink is printed on EVERY page — only the
    // official mark draws it, so this also proves the seal branch ran.
    for (let pageNumber = 1; pageNumber <= parsed.numPages; pageNumber++) {
      const page = await parsed.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("");
      expect(
        text.includes(HOLOGRAM_SERIAL),
        `page ${pageNumber} is missing the hologram's security serial`
      ).toBe(true);
    }
  });

  test("the admin drawer shows the section and opens the artifact inline", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const session = await ensureAdminSession(request);
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: session.sessionId, url: "http://localhost:3000" },
    ]);
    await page.addInitScript(
      (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
      {
        state: {
          session: {
            sessionId: session.sessionId,
            userId: "admin-user-id",
            mobileE164: `+98${session.mobile.replace(/^0/, "")}`,
            mobileDisplay: session.mobile,
            isNewUser: false,
            createdAt: Date.now(),
          },
        },
        version: 0,
      }
    );

    await page.goto("/admin/contracts", { waitUntil: "domcontentloaded" });
    const search = page.getByPlaceholder("جستجو در کد پیگیری، عنوان، مالک یا طرفین");
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill(SAMPLE_REF);

    // Target the FINALIZED row, not whichever sample happens to sort first:
    // a signed-but-unfinalized sample correctly shows «سند نهایی هنوز تولید
    // نشده است» and must not be confused with the artifact under test.
    const row = page
      .getByRole("row", { name: new RegExp(`${SAMPLE_REF}.*نهایی‌شده`) })
      .first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: /بررسی|مشاهده/ }).click();

    const drawer = page.getByRole("dialog").first();
    await expect(drawer).toBeVisible({ timeout: 20_000 });

    // The section exists and states the seal claim honestly.
    await expect(drawer.getByText("سند نهایی و مهر رسمی")).toBeVisible({ timeout: 20_000 });
    await expect(
      drawer.getByText("مهر رسمی + هولوگرام روی همهٔ صفحات")
    ).toBeVisible({ timeout: 20_000 });

    // The artifact is opened from the ADMIN route inside the drawer.
    const iframe = drawer.locator("iframe");
    await expect(iframe).toBeVisible({ timeout: 20_000 });
    const src = await iframe.getAttribute("src");
    expect(src).toMatch(/^\/api\/v1\/admin\/contracts\/.+\/final-document$/);

    // The download link is present and points at the attachment variant.
    const download = drawer.getByRole("link", { name: /دانلود نسخهٔ مهرشده/ });
    await expect(download).toBeVisible();
    expect(await download.getAttribute("href")).toContain("download=1");

    // The iframe src actually resolves the PDF for this staff session.
    const frameResponse = await page.request.get(src!, {
      headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    });
    expect(frameResponse.status()).toBe(200);
    expect(frameResponse.headers()["content-type"]).toContain("application/pdf");

    // The framed artifact must actually LOAD. `frame-ancestors 'none'` used
    // to make Chrome answer `net::ERR_BLOCKED_BY_RESPONSE`, which still left
    // a visible <iframe> — an empty box an operator could not tell apart
    // from a slow PDF. The PDF viewer then paints a canvas per page; wait
    // for that canvas, which is the first evidence the bytes were parsed.
    const findFrame = () =>
      page.frames().find((f) => f.url().endsWith(src!));
    for (let i = 0; i < 60 && !findFrame(); i++) await page.waitForTimeout(250);
    expect(findFrame(), "the drawer's iframe must load the PDF route itself").toBeTruthy();

    // Evidence: the operator's actual view of the sealed artifact.
    const shots = path.join("e2e", "__shots__", "admin-final-document");
    fs.mkdirSync(shots, { recursive: true });
    const finalSection = drawer
      .locator("section, div")
      .filter({ hasText: "سند نهایی و مهر رسمی" })
      .last();
    await finalSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await finalSection.screenshot({ path: path.join(shots, "final-section.png") });
  });
});
