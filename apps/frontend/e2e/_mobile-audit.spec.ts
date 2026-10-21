import { test, expect } from "@playwright/test";
import fs from "node:fs";

// TEMP audit spec — measures and screenshots the landing at every phone width
// the brief names. Deleted once the redesign is verified.

const OUT = ".tmp-mobile";

test.describe.configure({ mode: "serial", timeout: 300_000 });

const VIEWPORTS = [
  { name: "w320", width: 320, height: 800 },
  { name: "w360", width: 360, height: 800 },
  { name: "w390", width: 390, height: 844 },
  { name: "w430", width: 430, height: 932 },
  { name: "tablet", width: 834, height: 1000 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`audit — ${vp.name}`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += Math.round(vp.height * 0.7)) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(140);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);

    await page.screenshot({ path: `${OUT}/${vp.name}-full.png`, fullPage: true });

    // Section-by-section geometry: how much of each band is picture, and does
    // any one image own most of a screen?
    const report = await page.evaluate(() => {
      const vh = window.innerHeight;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("main section, main > div.landing-container")
      );
      return {
        pageHeight: document.body.scrollHeight,
        viewportHeight: vh,
        horizontal: {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        },
        sections: sections.map((s, i) => {
          const label =
            s.getAttribute("aria-labelledby") ??
            s.querySelector("h1,h2")?.textContent?.trim().slice(0, 40) ??
            `#${i}`;
          const r = s.getBoundingClientRect();
          const imgs = Array.from(s.querySelectorAll("img")).map((img) => {
            const ir = img.getBoundingClientRect();
            return {
              src: img.currentSrc.split("/").slice(-1)[0] || img.src.split("/").pop(),
              w: Math.round(ir.width),
              h: Math.round(ir.height),
              ratio: ir.width ? +(ir.height / ir.width).toFixed(2) : 0,
              shareOfBand: r.height ? +(ir.height / r.height).toFixed(2) : 0,
              screens: +(ir.height / vh).toFixed(2),
              natural: `${img.naturalWidth}x${img.naturalHeight}`,
              loading: img.loading,
              wAttr: img.getAttribute("width"),
              hAttr: img.getAttribute("height"),
            };
          });
          return {
            label,
            height: Math.round(r.height),
            screens: +(r.height / vh).toFixed(2),
            imgs,
          };
        }),
      };
    });

    fs.writeFileSync(`${OUT}/${vp.name}.json`, JSON.stringify(report, null, 2));

    const tall = report.sections
      .filter((s) => s.imgs.some((i) => i.screens > 0.5))
      .map((s) => `${s.label}: ${s.imgs.map((i) => `${i.src} ${i.screens}vh`).join(", ")}`);

    console.log(
      `\n[${vp.name}] page=${report.pageHeight}px overflow=${report.horizontal.scrollWidth}/${report.horizontal.clientWidth} errors=${errors.length}`
    );
    if (tall.length) console.log(`  images owning >0.5 screen: ${tall.join(" | ")}`);
    if (errors.length) console.log(`  ERRORS: ${errors.join(" ;; ")}`);

    expect(report.horizontal.scrollWidth).toBeLessThanOrEqual(report.horizontal.clientWidth + 1);
  });
}
