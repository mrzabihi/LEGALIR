import { test, expect } from "@playwright/test";

/**
 * The source-detail action row is one row of four peers, and it used to render
 * three different boxes: `Button` at 40px desktop / 44px mobile, the
 * «مشاهده منبع» link at a hard-coded 48px (`.touch-target`), and the
 * «لینک منبع ثبت نشده است» status chip at **62px** on a phone because its
 * sentence wrapped to two lines beside three icon-only buttons.
 *
 * The row is `items-center`, so nothing overlapped — it read as a
 * mis-alignment rather than a hierarchy, which is exactly the kind of thing
 * that survives review and regresses quietly. So it is pinned by measurement:
 * every direct child of the row shares one height at every width.
 *
 * This covers the guest-visible branch. A source *with* a `sourceUrl` swaps the
 * status chip for a `<a>` styled through `buttonClasses()`, and no seeded source
 * carries a URL — that branch is verified by creating one through the admin API,
 * which needs a session and therefore does not belong in this spec.
 */

const DETAIL = "/legal-library/src-law-civil-230";

const WIDTHS = [
  { name: "small phone", width: 320 },
  { name: "phone", width: 390 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1440 },
] as const;

for (const vp of WIDTHS) {
  test(`source actions share one height — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: 900 });
    await page.goto(DETAIL, { waitUntil: "networkidle" });

    // The row is the only `.scrollbar-hide` strip on this page, and the only
    // place four action peers sit side by side.
    const row = page.locator(".scrollbar-hide").first();
    await expect(row).toBeVisible();

    const boxes = await row.evaluate((el) =>
      Array.from(el.children).map((c) => {
        const r = c.getBoundingClientRect();
        return {
          label: c.getAttribute("aria-label") ?? (c.textContent ?? "").trim().replace(/\s+/g, " "),
          height: Math.round(r.height),
          width: Math.round(r.width),
          // A child must never be narrower than its content: `Button` is
          // `overflow-hidden` and the scrollbar is hidden, so a squeezed
          // button clips its own label with no way for the user to recover it.
          squeezed: c.scrollWidth > c.clientWidth + 1,
        };
      }),
    );

    expect(boxes).toHaveLength(4);
    for (const b of boxes) expect(b.label, "every action needs a name").not.toBe("");

    const heights = [...new Set(boxes.map((b) => b.height))];
    expect(
      heights,
      `actions must share one height; got ${boxes.map((b) => `${b.label}=${b.height}`).join(", ")}`,
    ).toHaveLength(1);

    // 40px above the desktop breakpoint, 44px below it (the touch minimum the
    // `Button` primitive enforces) — never a third value.
    expect([40, 44]).toContain(heights[0]);

    for (const b of boxes) {
      expect(b.squeezed, `«${b.label}» is clipped instead of letting the row scroll`).toBe(false);
    }
  });
}
