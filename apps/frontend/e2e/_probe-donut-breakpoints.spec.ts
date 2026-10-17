/** TEMPORARY — verify the KPI/donut grid at the exact breakpoint edges. */
import { test } from "@playwright/test";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

test("donut breakpoint edges", async ({ page, request }) => {
  test.setTimeout(180_000);
  const s = await ensureAdminSession(request);
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: s.sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: s.sessionId,
          userId: "admin-user-id",
          mobileE164: `+98${s.mobile.replace(/^0/, "")}`,
          mobileDisplay: s.mobile,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    }
  );

  for (const width of [1024, 1100, 1150, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);

    const out = await page.evaluate(() => {
      const doc = document.documentElement;
      const rings = Array.from(document.querySelectorAll<SVGSVGElement>("svg[role=img]"))
        .filter((el) => el.querySelectorAll("circle").length > 1)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const card = el.closest<HTMLElement>("a, div.rounded-large");
          const c = card?.getBoundingClientRect();
          return {
            ring: Math.round(r.width),
            card: c ? Math.round(c.width) : null,
            spill: c ? r.left < c.left - 1 || r.right > c.right + 1 : null,
          };
        });
      // Widest offenders when the page overflows.
      const spill = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(
          (el) =>
            el.scrollWidth > el.clientWidth + 1 &&
            el.clientWidth > 0 &&
            !el.closest(".sr-only") &&
            !el.className.includes?.("overflow-x-auto") &&
            !String(el.className).includes("truncate")
        )
        .slice(0, 6)
        .map((el) => {
          const chain: string[] = [];
          let p: HTMLElement | null = el;
          for (let i = 0; i < 4 && p; i++) {
            chain.push(`${p.tagName.toLowerCase()}.${String(p.className).slice(0, 40)}`);
            p = p.parentElement;
          }
          const txt = (el.textContent ?? "").trim().slice(0, 40);
          return (
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} ` +
            `[${el.clientWidth}<-${el.scrollWidth}] "${txt}"\n    <- ${chain.slice(1).join("  <-  ")}`
          );
        });
      const header = document.querySelector("header");
      const hkids = header
        ? Array.from(header.children).map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName.toLowerCase()}:${Math.round(r.width)}`;
          })
        : [];
      return {
        sw: doc.scrollWidth,
        cw: doc.clientWidth,
        rings,
        spill,
        header: header ? Math.round(header.getBoundingClientRect().width) : null,
        hkids,
      };
    });
    console.log(
      `W=${width} pageOverflow=${out.sw > out.cw + 1} header=${out.header} [${out.hkids.join(" ")}]\n` +
        `  rings=${JSON.stringify(out.rings)}\n  ${out.spill.join("\n  ")}`
    );
  }
});
