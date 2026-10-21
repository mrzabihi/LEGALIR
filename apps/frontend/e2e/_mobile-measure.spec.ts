import { test } from "@playwright/test";

/**
 * Scratch tool, not a contract. `_`-prefixed so `playwright.config.ts`'s
 * `testIgnore` keeps it out of `npm run test:e2e`; it asserts almost nothing
 * and exists to print the numbers `docs/LANDING_MOBILE.md` records.
 *
 *   npx playwright test e2e/_mobile-measure.spec.ts -c playwright.live.config.ts --reporter=list
 *
 * It writes the table; it does not judge it. The invariants live in
 * `landing-polish.spec.ts`.
 */

const WIDTHS = [320, 360, 390, 430, 768, 834, 1024, 1440];

test("emit the mobile measurement table", async ({ page }) => {
  const rows: Record<string, unknown>[] = [];

  for (const width of WIDTHS) {
    // One observer pair per navigation: `buffered: true` replays entries that
    // landed before this script ran, so the hero's paint is never missed.
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __lcp: number; __lcpEl: string };
      w.__cls = 0;
      w.__lcp = 0;
      w.__lcpEl = "";
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!e.hadRecentInput) w.__cls += e.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries() as (PerformanceEntry & { element?: Element })[];
        const last = entries[entries.length - 1];
        if (!last) return;
        w.__lcp = last.startTime;
        const el = last.element;
        w.__lcpEl = el
          ? `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]}`
          : "";
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });

    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // The plates decode lazily as they scroll in; nothing is scrolled here, so
    // this only lets the above-the-fold plate settle before the shutter.
    await page.waitForTimeout(1200);

    const row = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __lcp: number; __lcpEl: string };
      const vh = window.innerHeight;
      const doc = document.documentElement;
      const hero = document.querySelector<HTMLImageElement>(".landing-hero__img");
      const heroFig = document.querySelector(".landing-hero");

      const srcWidth = (img: HTMLImageElement | null) => {
        const q = img?.currentSrc.split("?")[1] ?? "";
        const m = new URLSearchParams(q).get("w");
        return m ?? "orig";
      };

      const plates = Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
        .filter((img) => !heroFig?.contains(img))
        .map((img) => +(img.getBoundingClientRect().height / vh).toFixed(2));

      const exhibits = Array.from(document.querySelectorAll(".landing-exhibit")).map((el) => {
        const r = el.getBoundingClientRect();
        const media = el.querySelector<HTMLElement>(".landing-exhibit__media");
        const m = media?.getBoundingClientRect();
        return {
          h: Math.round(r.height),
          mediaW: m ? Math.round(m.width) : 0,
          mediaH: m ? Math.round(m.height) : 0,
          walltext: el.classList.contains("landing-exhibit--walltext"),
        };
      });

      const imgBytes = (
        performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      )
        .filter((r) => r.initiatorType === "img" && r.name.includes("/_next/image"))
        .reduce((sum, r) => sum + (r.transferSize || 0), 0);

      return {
        overflow: doc.scrollWidth - doc.clientWidth,
        docH: doc.scrollHeight,
        cls: +w.__cls.toFixed(4),
        lcp: Math.round(w.__lcp),
        lcpEl: w.__lcpEl,
        heroSrcW: srcWidth(hero),
        heroRendered: hero
          ? `${Math.round(hero.getBoundingClientRect().width)}x${Math.round(hero.getBoundingClientRect().height)}`
          : "—",
        heroScreens: hero ? +(hero.getBoundingClientRect().height / vh).toFixed(2) : 0,
        maxPlate: plates.length ? Math.max(...plates) : 0,
        imgBytes,
        exhibitMin: exhibits.length ? Math.min(...exhibits.map((e) => e.h)) : 0,
        exhibitMax: exhibits.length ? Math.max(...exhibits.map((e) => e.h)) : 0,
        walltext: exhibits.filter((e) => e.walltext).map((e) => `${e.mediaW}x${e.mediaH}`),
      };
    });

    rows.push({ width, ...row });
  }

  const head =
    "| width | overflow | CLS | LCP | LCP element | hero served | hero box | hero screens | max plate | above-fold img | exhibit h | wall-text tile |";
  const sep =
    "|---|---|---|---|---|---|---|---|---|---|---|---|";
  console.log(`\n@@TABLE@@\n${head}\n${sep}`);
  for (const r of rows) {
    const x = r as Record<string, string | number | string[]>;
    console.log(
      `| ${x["width"]} | ${x["overflow"]} | ${x["cls"]} | ${x["lcp"]} ms | \`${x["lcpEl"]}\` | w=${x["heroSrcW"]} | ${x["heroRendered"]} | ${x["heroScreens"]} | ${x["maxPlate"]} | ${((x["imgBytes"] as number) / 1024).toFixed(0)} KB | ${x["exhibitMin"]}–${x["exhibitMax"]} | ${(x["walltext"] as string[]).join(", ") || "—"} |`,
    );
  }
  console.log("@@END@@\n");
});

test("emit the per-room bento detail at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  const detail = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".landing-exhibit")).map((el, i) => {
      const media = el.querySelector<HTMLElement>(".landing-exhibit__media")!;
      const mark = el.querySelector<HTMLElement>(".landing-exhibit__mark")!;
      const head = el.querySelector<HTMLElement>(".landing-exhibit__head")!;
      const text = el.querySelector<HTMLElement>(".landing-exhibit__text")!;
      const rect = (n: HTMLElement) => n.getBoundingClientRect();
      const num = el.querySelector<HTMLElement>(".landing-chapter__num");
      return {
        room: num?.textContent?.trim() ?? String(i),
        h: Math.round(rect(el as HTMLElement).height),
        media: `${Math.round(rect(media).width)}x${Math.round(rect(media).height)}`,
        // The bento claim: mark and plate share one row, so their tops agree.
        markTop: Math.round(rect(mark).top - rect(el as HTMLElement).top),
        mediaTop: Math.round(rect(media).top - rect(el as HTMLElement).top),
        headFull: Math.round(rect(head).width) === Math.round(rect(el as HTMLElement).width),
        textFull: Math.round(rect(text).width) === Math.round(rect(el as HTMLElement).width),
        room_: el.className,
      };
    });
  });

  console.log("\n@@ROOMS@@");
  for (const d of detail) {
    console.log(
      `| ${d.room} | ${d.h} | ${d.media} | ${d.markTop}/${d.mediaTop} | ${d.headFull ? "full" : "narrow"} | ${d.textFull ? "full" : "narrow"} | ${d.room_}`,
    );
  }
  console.log("@@END@@\n");
});
