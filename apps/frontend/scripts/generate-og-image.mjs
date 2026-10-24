// ============================================================
// LEGALIR — social share card (Open Graph / Twitter)
// Produces public/assets/social/legalir-og.png at the 1.91:1 size social
// crawlers expect (1200x630). Without it `og:image` was absent, so a shared
// link rendered as a bare text row.
//
// Compositing is sharp + an inline SVG, NOT next/og, so the card is a
// build-time asset: no font fetch or image render on the first share, and the
// bytes can be inspected and committed. Mirrors generate-icons.mjs.
//
// Vazirmatn is embedded into the SVG as a base64 @font-face. librsvg cannot
// see node_modules fonts, and a fallback face shapes Persian badly — the
// letter joining lives in the font's own OpenType tables. Measured: without
// the embed the headline renders with disconnected letters.
//
// Run: node scripts/generate-og-image.mjs
// ============================================================

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const publicDir = path.resolve(__dirname, "../public");
const outDir = path.join(publicDir, "assets/social");
const outFile = path.join(outDir, "legalir-og.png");

// Brand palette — must stay in step with the `--brand-*` tokens in
// src/app/globals.css. Duplicated because this script runs in Node, outside
// the CSS cascade; if the palette moves, move it here too.
const TEAL = "#222E2D";
const GREEN = "#1D624E";
const GOLD = "#C69B38";
const IVORY = "#FCF6E8";

const W = 1200;
const H = 630;

const EMBLEM = path.resolve(__dirname, "assets/legalir-favicon.png");
const FONT = path.join(repoRoot, "node_modules/vazirmatn/fonts/ttf/Vazirmatn-Bold.ttf");

async function emblemDataUri(file, height) {
  const buf = await sharp(file)
    .resize({ height, fit: "inside" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function main() {
  for (const required of [EMBLEM, FONT]) {
    if (!fs.existsSync(required)) throw new Error(`missing source: ${required}`);
  }

  const fontB64 = fs.readFileSync(FONT).toString("base64");
  const emblem = await emblemDataUri(EMBLEM, 132);

  // Left column carries the mark and the name; the right column the sentence.
  // Persian reads right-to-left, so the headline's visual weight sits right.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: "VazirmatnOG";
        src: url(data:font/ttf;base64,${fontB64}) format("truetype");
        font-weight: 700;
        font-style: normal;
      }
      .fa { font-family: "VazirmatnOG"; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}"/>
      <stop offset="0.62" stop-color="#1A2423"/>
      <stop offset="1" stop-color="#14201F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.12" r="0.75">
      <stop offset="0" stop-color="${GREEN}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldglow" cx="0.92" cy="0.95" r="0.6">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#goldglow)"/>

  <!-- Gold hairline frame: a quiet, print-like edge that reads at thumbnail size. -->
  <rect x="28.5" y="28.5" width="${W - 57}" height="${H - 57}"
        fill="none" stroke="${GOLD}" stroke-opacity="0.28" stroke-width="1"/>

  <!-- Emblem + wordmark -->
  <image x="76" y="86" width="132" height="132" href="${emblem}"/>
  <text x="76" y="286" class="fa" font-size="46" font-weight="700"
        fill="${IVORY}" letter-spacing="1">لیگالیر</text>
  <rect x="76" y="312" width="86" height="3" fill="${GOLD}"/>

  <!-- Headline, right-aligned for Persian -->
  <text x="${W - 76}" y="150" class="fa" font-size="58" font-weight="700"
        fill="${IVORY}" text-anchor="end">دستیار هوشمند حقوقی ایران</text>
  <text x="${W - 76}" y="238" class="fa" font-size="34" font-weight="700"
        fill="${GOLD}" opacity="0.95" text-anchor="end">قانون، قرارداد و مشاورهٔ تخصصی</text>
  <text x="${W - 76}" y="318" class="fa" font-size="27" font-weight="700"
        fill="${IVORY}" opacity="0.66" text-anchor="end">در یک پلتفرم، با پشتیبانی هوش مصنوعی</text>

  <!-- Footer rule + capability row -->
  <rect x="76" y="470" width="${W - 152}" height="1" fill="${IVORY}" opacity="0.14"/>
  <text x="${W - 76}" y="536" class="fa" font-size="25" font-weight="700"
        fill="${IVORY}" opacity="0.8" text-anchor="end">تحلیل قرارداد · تولید سند · مشاورهٔ وکیل</text>
  <text x="76" y="536" class="fa" font-size="25" font-weight="700"
        fill="${GOLD}" opacity="0.9">legalir.ir</text>
</svg>`;

  fs.mkdirSync(outDir, { recursive: true });

  // Composite over an opaque backdrop: several crawlers flatten a transparent
  // PNG onto white, which would halve this card's contrast.
  const png = await sharp({
    create: { width: W, height: H, channels: 3, background: TEAL },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  fs.writeFileSync(outFile, png);

  const meta = await sharp(png).metadata();
  if (meta.width !== W || meta.height !== H) {
    throw new Error(`wrong dimensions: ${meta.width}x${meta.height}`);
  }
  console.log(
    `Generated ${path.relative(repoRoot, outFile)} — ${meta.width}x${meta.height}, ` +
      `${Math.round(png.length / 1024)} KB`,
  );
}

await main();
