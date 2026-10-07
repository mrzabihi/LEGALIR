// ============================================================
// LEGALIR — Dependency-free OOXML (.xlsx) writer
// ============================================================
// Server-side Excel export without any third-party dependency. Produces a
// minimal, valid Excel 2007+ workbook:
//
//   [Content_Types].xml
//   _rels/.rels
//   xl/workbook.xml
//   xl/_rels/workbook.xml.rels
//   xl/styles.xml                (bold header + number/date formats)
//   xl/worksheets/sheetN.xml
//
// Strings are written inline (`t="inlineStr"`) so there is no shared-string
// table to reconcile; numbers are written raw. The container is a ZIP built
// with the "stored" method (no compression) — valid per the spec and avoids a
// deflate implementation. Callers pass already-localised cell text (Persian
// dates, Persian digits) — this module never formats values.
// ============================================================

/** A single cell value. `null`/`undefined` render as an empty cell. */
export type CellValue = string | number | null | undefined;

/** One column of a sheet. Cells are read from `row[column.key]`. */
export interface ColumnSpec {
  key: string;
  /** Persian header text shown in the first row (bold + tinted). */
  header: string;
  /** Column width in Excel character units. Defaults to 18. */
  width?: number;
  /** Render numbers as integers. Defaults to true for numeric columns. */
  integer?: boolean;
}

/** One worksheet. Extra keys in a row beyond `columns` are ignored. */
export interface SheetSpec {
  /** Tab name. Invalid chars are stripped; truncated to 31 chars. */
  name: string;
  columns: ColumnSpec[];
  rows: Record<string, CellValue>[];
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

/** Escape a value for XML text/attribute context. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert a 0-based column index to its A1 letters (0 → A, 26 → AA). */
function colName(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Sanitise a worksheet (tab) name per the OOXML rules. */
function sheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim() || `Sheet${index + 1}`;
  return cleaned.slice(0, 31);
}

// ---------------------------------------------------------------------------
// Worksheet
// ---------------------------------------------------------------------------

function sheetXml(sheet: SheetSpec): string {
  const columnCount = sheet.columns.length;

  // <cols> — declared widths.
  const cols = sheet.columns
    .map((col, i) => {
      const width = col.width ?? 18;
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  // Header row (style 1 = bold, tinted, frozen).
  const headerCells = sheet.columns
    .map(
      (col, i) =>
        `<c r="${colName(i)}1" s="1" t="inlineStr"><is><t>${esc(col.header)}</t></is></c>`
    )
    .join("");
  const headerRow = `<row r="1">${headerCells}</row>`;

  // Data rows (style 0 = default; style 2 = integer number format).
  const bodyRows = sheet.rows
    .map((row, r) => {
      const rowIndex = r + 2;
      const cells = sheet.columns
        .map((col, i) => {
          const ref = `${colName(i)}${rowIndex}`;
          const raw = row[col.key];
          if (raw === null || raw === undefined || raw === "") return "";
          if (typeof raw === "number" && Number.isFinite(raw)) {
            const s = col.integer === false ? 0 : 2;
            return `<c r="${ref}" s="${s}"><v>${raw}</v></c>`;
          }
          return `<c r="${ref}" s="0" t="inlineStr"><is><t xml:space="preserve">${esc(String(raw))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex}">${cells}</row>`;
    })
    .join("");

  const dimension = `A1:${colName(Math.max(columnCount - 1, 0))}${sheet.rows.length + 1}`;
  const pane = "<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
</worksheet>`;
}

// ---------------------------------------------------------------------------
// Static workbook parts
// ---------------------------------------------------------------------------

const CONTENT_TYPES = (sheetCount: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${Array.from({ length: sheetCount }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = (sheetCount: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${Array.from({ length: sheetCount }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Style 0 default, 1 bold header (tinted fill), 2 integer (#,##0).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E4E8C"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookXml(sheets: SheetSpec[]): string {
  const entries = sheets
    .map((s, i) => `<sheet name="${esc(sheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${entries}</sheets>
</workbook>`;
}

// ---------------------------------------------------------------------------
// ZIP (stored) writer
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
  crc: number;
  offset: number;
}

/** Build a ZIP archive using the "stored" (no compression) method. */
function zip(files: { name: string; content: string }[]): Buffer {
  const entries: ZipEntry[] = [];
  const chunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // flags — UTF-8 names
    header.writeUInt16LE(0, 8); // method: stored
    header.writeUInt16LE(0, 10); // mod time
    header.writeUInt16LE(0x21, 12); // mod date (1980-01-01)
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // extra length
    chunks.push(header, nameBuf, data);
    entries.push({ name: file.name, data, crc, offset });
    offset += header.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rec = Buffer.alloc(46);
    rec.writeUInt32LE(0x02014b50, 0); // central dir signature
    rec.writeUInt16LE(20, 4); // version made by
    rec.writeUInt16LE(20, 6); // version needed
    rec.writeUInt16LE(0x0800, 8); // flags
    rec.writeUInt16LE(0, 10); // method
    rec.writeUInt16LE(0, 12); // time
    rec.writeUInt16LE(0x21, 14); // date
    rec.writeUInt32LE(entry.crc, 16);
    rec.writeUInt32LE(entry.data.length, 20);
    rec.writeUInt32LE(entry.data.length, 24);
    rec.writeUInt16LE(nameBuf.length, 28);
    rec.writeUInt16LE(0, 30); // extra
    rec.writeUInt16LE(0, 32); // comment
    rec.writeUInt16LE(0, 34); // disk number
    rec.writeUInt16LE(0, 36); // internal attrs
    rec.writeUInt32LE(0, 38); // external attrs
    rec.writeUInt32LE(entry.offset, 42);
    chunks.push(rec, nameBuf);
    offset += rec.length + nameBuf.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(offset - centralStart, 12); // central dir size
  eocd.writeUInt32LE(centralStart, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length
  chunks.push(eocd);

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete `.xlsx` workbook from one or more sheets.
 *
 * @param sheets At least one sheet. Empty `rows` produce a header-only sheet.
 * @returns The workbook bytes, ready to stream with
 *   `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
 */
export function buildXlsx(sheets: SheetSpec[]): Buffer {
  const safeSheets = sheets.length ? sheets : [{ name: "Sheet1", columns: [], rows: [] }];
  const sheetCount = safeSheets.length;

  const files: { name: string; content: string }[] = [
    { name: "[Content_Types].xml", content: CONTENT_TYPES(sheetCount) },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "xl/workbook.xml", content: workbookXml(safeSheets) },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS(sheetCount) },
    { name: "xl/styles.xml", content: STYLES },
  ];
  safeSheets.forEach((sheet, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(sheet) });
  });

  return zip(files);
}

/** A conservative ASCII-safe filename with a `.xlsx` suffix and date stamp. */
export function exportFilename(base: string, stamp = new Date()): string {
  const safe = base.replace(/[^\w\u0600-\u06FF-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  const iso = stamp.toISOString().slice(0, 10);
  return `${safe}-${iso}.xlsx`;
}
