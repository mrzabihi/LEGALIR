// ============================================================
// LEGALIR — Favicon / Web App Icon generator
// Derives the full PWA icon set from the approved master mark
// (scripts/assets/legalir-app-icon.png — the gold emblem on a
// green squircle). Preserves the brand; does NOT redesign it.
// Run: node scripts/generate-icons.mjs
// ============================================================

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const source = path.resolve(__dirname, "assets/legalir-app-icon.png");

// Gold-emblem bounding box inside the 1254x1254 master (measured).
const EMBLEM_BBOX = { left: 287, top: 209, width: 680, height: 841 };

// maskable / home-screen icons use a full-bleed brand green so the system mask
// and the app's own theme colour stay consistent; the "any" icons keep the
// master's own squircle silhouette (transparent corners) so they read on both
// light and dark host chrome.
const GREEN_FLATTEN = { r: 0x1d, g: 0x62, b: 0x4e };

// Live emblem is inset to sit inside the OS maskable safe circle / iOS corners.
const MASKABLE_EMBLEM_SCALE = 0.6; // of the canvas height
const APPLE_EMBLEM_SCALE = 0.62;

async function main() {
  const any = (size) => anyIcon(size);
  const green = (size, scale) => greenIcon(size, scale);

  const pngBuffers = {
    "favicon-16.png": await any(16),
    "favicon-32.png": await any(32),
    "favicon-48.png": await any(48),
    "apple-touch-icon.png": await green(180, APPLE_EMBLEM_SCALE),
    "icon-192.png": await any(192),
    "icon-512.png": await any(512),
    "icon-maskable-192.png": await green(192, MASKABLE_EMBLEM_SCALE),
    "icon-maskable-512.png": await green(512, MASKABLE_EMBLEM_SCALE),
  };

  for (const [name, buf] of Object.entries(pngBuffers)) {
    fs.writeFileSync(path.join(publicDir, name), buf);
  }

  // Pack favicon.ico from the 16/32/48 PNGs (Vista+ PNG-encoded ICO)
  fs.writeFileSync(
    path.join(publicDir, "favicon.ico"),
    buildIco([pngBuffers["favicon-16.png"], pngBuffers["favicon-32.png"], pngBuffers["favicon-48.png"]]),
  );

  console.log("Generated:", Object.keys(pngBuffers).join(", "), "+ favicon.ico");
}

// The master's squircle is drawn to the canvas-edge midpoints with black matte
// corners. Reproduce that silhouette as real transparency so the icon drops
// cleanly onto any surface; the interior is untouched.
async function squircleRGBA(size) {
  const { data, info } = await sharp(source)
    .resize(size, size, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const mx = Math.max(r, g, b);
    // The squircle darkens toward its edge but stays green-dominant (g above
    // both r and b); the matte corners are neutral black. Key on both so the
    // dark edge stays opaque while the corners vanish cleanly.
    const greenness = g - Math.min(r, b);
    let a;
    if (mx >= 64) a = 255; // bright ⇒ interior (gold highlights included)
    else if (mx <= 16 && greenness <= 8) a = 0; // neutral black matte
    else a = Math.round(Math.min(1, Math.max((mx - 12) / 40, (greenness - 3) / 18)) * 255);
    data[o + 3] = a;
  }
  return { buf: Buffer.from(data), width, height };
}

// Extract the gold emblem from the master and key its dark-green surround to
// transparency, preserving the metallic interior so it re-composites onto the
// brand-green backgrounds without a seam.
async function emblemRGBA(height) {
  const width = Math.round(EMBLEM_BBOX.width * (height / EMBLEM_BBOX.height));
  const { data, info } = await sharp(source)
    .extract(EMBLEM_BBOX)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  for (let i = 0; i < w * h; i++) {
    const o = i * channels;
    const r = data[o]; // the gold mark is red-dominant; its green surround is not
    data[o + 3] = r <= 52 ? 0 : r >= 92 ? 255 : Math.round(((r - 52) / 40) * 255);
  }
  return { buf: Buffer.from(data), width: w, height: h };
}

// Brand-green field with a subtle top-centred sheen (matches the master mood).
function greenBackground(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <radialGradient id="g" cx="50%" cy="44%" r="66%">
          <stop offset="0%" stop-color="#256F59"/>
          <stop offset="58%" stop-color="#1D624E"/>
          <stop offset="100%" stop-color="#143D30"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`,
  );
}

// "any" icon: the master's green squircle, corners keyed to transparency.
async function anyIcon(size) {
  const sq = await squircleRGBA(size);
  return sharp(sq.buf, { raw: { width: sq.width, height: sq.height, channels: 4 } })
    .png()
    .toBuffer();
}

// maskable / apple icon: opaque full-bleed brand green + centred emblem, sized
// to survive the maskable safe zone and iOS rounded corners without clipping.
async function greenIcon(size, scale) {
  const h = Math.round(size * scale);
  const em = await emblemRGBA(h);
  const top = Math.round((size - h) / 2);
  const left = Math.round((size - em.width) / 2);
  return sharp(greenBackground(size))
    .composite([{ input: em.buf, raw: { width: em.width, height: em.height, channels: 4 }, top, left }])
    .flatten({ background: GREEN_FLATTEN })
    .png()
    .toBuffer();
}

// Minimal ICO container that embeds PNG frames directly.
function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4); // count

  const dirSize = 16;
  const entries = [];
  let offset = 6 + dirSize * count;
  const blobs = [];

  for (const png of pngs) {
    const entry = Buffer.alloc(dirSize);
    const dim = png.readUInt32BE(16); // width
    const size = Math.min(dim, 256);
    entry.writeUInt8(size % 256, 0); // width (0 == 256)
    entry.writeUInt8(size % 256, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(png.length, 8); // bytesInRes
    entry.writeUInt32LE(offset, 12); // imageOffset
    entries.push(entry);
    blobs.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...blobs]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
