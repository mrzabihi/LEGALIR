// ============================================================
// LEGALIR — Favicon / Web App Icon generator
// Resizes the approved brand mark (public/legalir-logo.png) into
// the full icon set. Preserves the brand; does NOT redesign it.
// Run: node scripts/generate-icons.mjs
// ============================================================

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const source = path.join(publicDir, "legalir-logo.png");

async function main() {
  const src = sharp(source);

  // 1) Single-size PNGs (used directly + packed into favicon.ico)
  const pngSizes = [16, 32, 48, 180, 192, 512];
  const pngBuffers = {};
  for (const size of pngSizes) {
    const buf = await src.clone().resize(size, size, { fit: "contain" }).png().toBuffer();
    pngBuffers[size] = buf;
  }

  fs.writeFileSync(path.join(publicDir, "favicon-16.png"), pngBuffers[16]);
  fs.writeFileSync(path.join(publicDir, "favicon-32.png"), pngBuffers[32]);
  fs.writeFileSync(path.join(publicDir, "favicon-48.png"), pngBuffers[48]);
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), pngBuffers[180]);
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), pngBuffers[192]);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), pngBuffers[512]);

  // 2) Pack favicon.ico from the 16/32/48 PNGs (Vista+ PNG-encoded ICO)
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), buildIco([pngBuffers[16], pngBuffers[32], pngBuffers[48]]));

  console.log("Generated icons:", Object.keys(pngBuffers).map((s) => `${s}px`).join(", "), "+ favicon.ico");
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
