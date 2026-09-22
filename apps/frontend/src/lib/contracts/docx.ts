// ============================================================
// LEGALIR — Contract Word (.docx) renderer (server-only)
// ============================================================
// Produces a real Office Open XML document from an IMMUTABLE version
// snapshot — the same source the PDF uses — so the .docx always
// matches the recorded document hash.
//
// No third-party dependency: a .docx is a ZIP of XML parts, and the
// only part that carries content is `word/document.xml`. We build the
// ZIP by hand (stored, uncompressed entries) which keeps the renderer
// deterministic and dependency-free.
//
// Persian text is written right-to-left via `w:bidi` + `w:rtl`, and
// the document default font is Vazirmatn so Word renders it correctly
// on a machine that has the font installed.
// ============================================================

import type { PropertyContract, PropertyContractVersion } from "@legalir/types";
import { renderContract } from "./template";
import { formatIsoJalali } from "./dates";

// ---------------------------------------------------------------------------
// Minimal ZIP writer (stored / no compression)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** CRC-32 (IEEE 802.3) — required by the ZIP central directory. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a ZIP archive from stored entries. */
function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const writeU16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const writeU32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);

  for (const entry of entries) {
    const nameBytes = utf8(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // --- Local file header ---
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50);
    writeU16(lv, 4, 20); // version needed
    writeU16(lv, 6, 0x0800); // UTF-8 name flag
    writeU16(lv, 8, 0); // stored
    writeU16(lv, 10, 0); // time
    writeU16(lv, 12, 0); // date
    writeU32(lv, 14, crc);
    writeU32(lv, 18, size);
    writeU32(lv, 22, size);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0);
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    // --- Central directory record ---
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    writeU32(cv, 0, 0x02014b50);
    writeU16(cv, 4, 20); // version made by
    writeU16(cv, 6, 20); // version needed
    writeU16(cv, 8, 0x0800);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, 0);
    writeU16(cv, 14, 0);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, size);
    writeU32(cv, 24, size);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0);
    writeU16(cv, 32, 0);
    writeU16(cv, 34, 0);
    writeU16(cv, 36, 0);
    writeU32(cv, 38, 0);
    writeU32(cv, 42, offset);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054b50);
  writeU16(ev, 4, 0);
  writeU16(ev, 6, 0);
  writeU16(ev, 8, entries.length);
  writeU16(ev, 10, entries.length);
  writeU32(ev, 12, centralSize);
  writeU32(ev, 16, offset);
  writeU16(ev, 20, 0);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  for (const chunk of central) {
    out.set(chunk, at);
    at += chunk.length;
  }
  out.set(end, at);
  return out;
}

// ---------------------------------------------------------------------------
// OOXML parts
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A right-to-left paragraph. `size` is in half-points. */
function paragraph(text: string, opts?: { bold?: boolean; size?: number; align?: "right" | "center" }): string {
  const size = opts?.size ?? 22; // 11pt
  const align = opts?.align ?? "right";
  const bold = opts?.bold ? "<w:b/><w:bCs/>" : "";
  const rPr =
    `<w:rFonts w:ascii="Vazirmatn" w:hAnsi="Vazirmatn" w:cs="Vazirmatn"/>${bold}` +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rtl/>`;
  return (
    `<w:p><w:pPr><w:bidi/><w:jc w:val="${align}"/><w:rPr>${rPr}</w:rPr></w:pPr>` +
    `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  );
}

function documentXml(body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
    `<w:bidi/></w:sectPr>` +
    `</w:body></w:document>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOC_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr>` +
  `<w:rFonts w:ascii="Vazirmatn" w:hAnsi="Vazirmatn" w:cs="Vazirmatn"/>` +
  `<w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/>` +
  `</w:rPr></w:rPrDefault></w:docDefaults>` +
  `</w:styles>`;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface RenderDocxParams {
  contract: PropertyContract;
  version: PropertyContractVersion;
}

/**
 * Render the immutable .docx for a contract version. Content comes from
 * `version.snapshot`, so the file always matches the recorded hash.
 */
export function renderContractDocx(params: RenderDocxParams): Uint8Array {
  const { contract, version } = params;
  const snapshot = version.snapshot;
  const rendered = renderContract(
    { ...contract, data: snapshot.data },
    snapshot.parties,
    snapshot.payments
  );

  const parts: string[] = [];

  parts.push(paragraph(rendered.titleFa, { bold: true, size: 32, align: "center" }));
  parts.push(paragraph(`کد قرارداد: ${contract.referenceCode}`, { size: 20 }));
  parts.push(paragraph(`نسخه: ${version.versionNumber} — نسخه قالب: ${version.templateVersion}`, { size: 20 }));
  parts.push(paragraph(`تاریخ صدور: ${formatIsoJalali(version.createdAt.slice(0, 10))}`, { size: 20 }));
  parts.push(paragraph(`اثر انگشت سند (SHA-256): ${version.documentHash}`, { size: 18 }));
  parts.push(paragraph("", { size: 20 }));

  parts.push(paragraph(rendered.preambleFa));
  parts.push(paragraph("", { size: 20 }));

  for (const clause of rendered.clauses) {
    parts.push(paragraph(clause.headingFa, { bold: true, size: 26 }));
    for (const p of clause.paragraphs) parts.push(paragraph(p));
    parts.push(paragraph("", { size: 20 }));
  }

  parts.push(paragraph("امضای طرفین", { bold: true, size: 26 }));
  for (const line of rendered.signatureLines) {
    parts.push(paragraph(`${line.roleFa}: ${line.nameFa} — کد ملی: ${line.nationalId}`));
  }

  parts.push(paragraph("", { size: 20 }));
  parts.push(paragraph(rendered.footerFa, { size: 18 }));

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: utf8(CONTENT_TYPES) },
    { name: "_rels/.rels", data: utf8(ROOT_RELS) },
    { name: "word/document.xml", data: utf8(documentXml(parts.join(""))) },
    { name: "word/_rels/document.xml.rels", data: utf8(DOC_RELS) },
    { name: "word/styles.xml", data: utf8(STYLES) },
  ];

  return buildZip(entries);
}
