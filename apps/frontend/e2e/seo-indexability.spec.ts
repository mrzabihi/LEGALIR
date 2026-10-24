import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";

/**
 * The crawl surface, asserted where crawlers actually see it: the HTTP
 * responses.
 *
 * `/legal-library` used to be a contradiction — reachable by guests (200), but
 * `noindex,nofollow` from the `(app)` group layout, `Disallow`ed in robots.txt
 * and absent from the sitemap. Three separate gates each said "private" while
 * the route itself said "public", so nothing was broken loudly enough for any
 * existing test to notice. These assertions pin the resolved policy:
 * the library is a public, indexable section — and every OTHER private surface
 * stays out of the index.
 *
 * The published detail ids are read from `/sitemap.xml` itself rather than
 * hard-coded, so this spec keeps working as operators publish and archive
 * sources (a hard-coded id would silently stop testing anything once that
 * source were archived, which is exactly the failure mode being guarded).
 */

const LIBRARY_PATH = "/legal-library";
const DETAIL_LOC_RE = new RegExp(`<loc>(https?://[^<]*${LIBRARY_PATH}/[^<]+)</loc>`, "g");

async function publishedDetailUrls(page: Page): Promise<string[]> {
  const res = await page.request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  return [...xml.matchAll(DETAIL_LOC_RE)].map((m) => m[1]!);
}

test.describe("Public crawl surface", () => {
  test("robots.txt invites the library and still blocks private surfaces", async ({ page }) => {
    const res = await page.request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();

    // The library is public now — a `Disallow` here would silently undo the
    // whole point of moving it out of the authenticated group.
    expect(body).not.toMatch(/^\s*Disallow:\s*\/legal-library\s*$/m);

    // …while the genuinely private surfaces stay blocked. The middleware and
    // `follow: false` are the real boundaries; this is the crawl directive.
    for (const path of ["/admin", "/dashboard", "/api", "/auth"]) {
      expect(body, `robots.txt must disallow ${path}`).toMatch(
        new RegExp(`^\\s*Disallow:\\s*${path}\\s*$`, "m")
      );
    }
    expect(body).toMatch(/^\s*Sitemap:\s*https?:\/\/\S+\/sitemap\.xml\s*$/m);
  });

  test("sitemap.xml lists the library and its published sources", async ({ page }) => {
    const res = await page.request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    // The listing itself, as an absolute URL (a crawler has no page context).
    expect(xml).toMatch(new RegExp(`<loc>https?://[^<]*${LIBRARY_PATH}</loc>`));

    // At least one source detail. Ids are opaque to this test on purpose.
    expect((await publishedDetailUrls(page)).length, "sitemap lists no library sources").toBeGreaterThan(0);

    // The sitemap must never advertise a private surface.
    expect(xml).not.toMatch(/<loc>https?:\/\/[^<]*\/(admin|dashboard|api|auth)\b/);
  });

  test("the library listing advertises itself as indexable", async ({ page }) => {
    const res = await page.goto(LIBRARY_PATH, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    // `index, follow` is spelled out rather than inferred: the failure this
    // guards against is an inherited `noindex` from a parent layout, which is
    // invisible in the page unless you read this tag.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");

    // A unique title — inheriting the root title would make the library look
    // like a duplicate of the homepage to a crawler.
    await expect(page).toHaveTitle(/کتابخانه حقوقی/);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).not.toBeNull();
    expect(new URL(canonical!).pathname).toBe(LIBRARY_PATH);
  });

  test("a published source detail is indexable and self-canonical", async ({ page }) => {
    const detailUrl = (await publishedDetailUrls(page))[0];
    expect(detailUrl, "no published library source to check").toBeTruthy();

    const path = new URL(detailUrl!).pathname;
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe(path);

    // The title comes from the source's own data, not the site default.
    await expect(page).not.toHaveTitle(/^لیگالیر \| دستیار هوشمند حقوقی ایران/);
  });

  test("an unknown source id is noindex, whatever status the stream reports", async ({ page }) => {
    // `notFound()` renders the nearest not-found page. Next flushes the head
    // before a streamed response finishes, so the transport status on a dynamic
    // route can still read 200 even though the body is the 404 surface — which
    // is exactly the soft-404 shape this assertion guards. Indexability is
    // therefore asserted through the tag a crawler obeys, not the status line.
    await page.goto(`${LIBRARY_PATH}/__does-not-exist__`, { waitUntil: "domcontentloaded" });

    const robots = await page.locator('meta[name="robots"]').first().getAttribute("content");
    expect(robots, "an unknown source must not be indexable").toMatch(/noindex/);

    // And it must not advertise itself as the listing: a canonical on a URL
    // that serves «یافت نشد» is a second, contradictory identity claim. The
    // element must be absent outright, which is why this asserts a count rather
    // than reading an attribute (a missing element would just hang the read).
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});
