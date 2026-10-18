// ============================================================
// LEGALIR — Immutable contract PDF renderer (server-only)
// ============================================================
// Renders a finalized contract into a Persian PDF from an IMMUTABLE
// version snapshot — never from the mutable working data. The PDF
// carries the contract reference code, the version number, the
// template version, the document hash and a QR code pointing at the
// public verification page, so a printed copy can always be traced
// back to the exact content it was generated from.
//
// The sheet mirrors the A4 preview: a letterhead with the LEGALIR mark
// and the identifying group at the physical top-left, the contract
// title centred beneath it, a slim identity head on pages 2+ and
// «صفحه N از M» on every page. Screen preview and print are the same
// document, so neither can drift from the other.
//
// Persian text is shaped with the Vazirmatn font (embedded via
// fontkit) and laid out right-to-left.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { PropertyContractVersion, PropertyContract } from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_RGB,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";
import { renderContract, type RenderedBlock, type RenderedTable } from "./template";
import { buildLegalBasisReport, legalBasisReportLines } from "./legal-basis";
import { formatIsoJalali } from "./dates";
import { qrMatrix } from "./qr";
import { HOLOGRAM_PRINT_INK, loadDocumentLogo, loadHologram, loadReviewStamp } from "./stamp-asset";

/**
 * The review mark to draw on the document. When `applied` is true the
 * blue «بررسی شد» stamp is drawn; when false the unapproved-draft
 * watermark is drawn instead. The renderer NEVER decides this itself —
 * it is told, so the same rule (a valid bound admin approval) governs
 * every surface.
 */
export interface ReviewStampInfo {
  applied: boolean;
  reviewId?: string;
  /** ISO date of the review decision. */
  reviewedAt?: string;
  reviewingOfficeFa?: string;
  reviewerInitials?: string | null;
  /**
   * The OFFICIAL LEGALIR stamp, present only when a Super Admin has
   * authorised the exact version hash AND the stamp master is byte-identical
   * to what was approved. When present the real PNG is drawn, at a slight
   * angle, on EVERY page inside a reserved footer band so it never overlaps
   * text, signatures or page numbers. When absent, the legacy text mark is
   * used instead.
   */
  officialStamp?: {
    /** SHA-256 of the stamp master this approval was bound to. */
    sha256: string;
    /** Version label of the stamp master. */
    version: string;
    /** ISO timestamp the stamp was applied. */
    approvedAt?: string | null;
    /** Public-safe initials of the authorising Super Admin, e.g. «م.م». */
    approvedByInitials?: string | null;
  } | null;
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;

/** LEGALIR brand colours for the printed sheet (#222E2D / #1D624E). */
const BRAND_INK = rgb(0.1333, 0.1804, 0.1765);
const BRAND_ACCENT = rgb(0.1137, 0.3843, 0.3059);
const MUTED_INK = rgb(0.35, 0.35, 0.4);
const HAIRLINE = rgb(0.85, 0.87, 0.86);

/** Letterhead logo height, matching the A4 sheet's 42px mark (~32pt). */
const LETTERHEAD_LOGO_HEIGHT = 32;

/**
 * The footer band reserved at the bottom of EVERY page. Contract text never
 * flows into it (the cursor bottoms out above it), so its occupants — the
 * per-page paraphe strip, the official stamp/hologram and the mandatory
 * disclaimer — can never overlap body text, signature boxes or page
 * numbers. The band is reserved unconditionally, because EVERY page now
 * carries a paraphe strip (§2.6), not only a stamped one.
 *
 * Layout inside the band (bottom → top): disclaimer at MARGIN+2, the
 * seal/hologram centred at MARGIN+40, and the paraphe strip at
 * MARGIN+76. The page number stays below MARGIN at y=22.
 */
const FOOTER_BAND = 104;
/** Height of the drawn stamp image, in points. */
const STAMP_DRAW_HEIGHT = 46;
/** The slight angle of the stamp — a hand-applied look, never a straight box. */
const STAMP_ANGLE = -8;

/** Locate the Vazirmatn TTF, searching up from the app directory. */
function findFontPath(fileName: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), "node_modules", "vazirmatn", "fonts", "ttf", fileName),
    path.resolve(process.cwd(), "..", "..", "node_modules", "vazirmatn", "fonts", "ttf", fileName),
    path.resolve(process.cwd(), "..", "node_modules", "vazirmatn", "fonts", "ttf", fileName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Render an integer with Persian digits for page numbering. */
function toPersianDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

/** Wrap `text` to `maxWidth`, returning the lines. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureRtl(font, candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** A cursor that flows text down the page, adding pages as needed. */
class Layout {
  page: PDFPage;
  y: number;
  /** Lowest Y the cursor may reach — raised when a footer band is reserved. */
  private readonly bottom: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    /**
     * Every page carries a paraphe strip (§2.6), so the footer band is
     * ALWAYS reserved. The parameter is kept so a future full-bleed layout
     * can opt out explicitly; it defaults to true rather than false because
     * silently letting body text run into the band is the defect the brief
     * calls out.
     */
    reserveFooter = true
  ) {
    this.bottom = MARGIN + (reserveFooter ? FOOTER_BAND : 0);
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensure(space: number): void {
    if (this.y - space < this.bottom) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  heading(text: string, size = 13): void {
    this.ensure(size + 14);
    drawRtl(this.page, this.fonts.bold, text, {
      y: this.y - size,
      size,
      color: BRAND_INK,
      right: RIGHT,
    });
    this.y -= size + 10;
  }

  /**
   * The cover letterhead. The LEGALIR mark and the identifying group sit
   * at the physical TOP-LEFT (logo first, identity to its right); the
   * contract title is a separate, centred line BELOW them, so the mark,
   * the metadata and the title can never overlap. Mirrors the A4 sheet's
   * `.a4-letterhead` rules so the PDF and the preview are one document.
   */
  letterhead(args: {
    logo: PDFImage | null;
    titleFa: string;
    typeFa: string;
    referenceCode: string;
    issuedOnFa: string;
    versionLabelFa: string;
    documentHash: string;
  }): void {
    const top = this.y;
    const gap = 12;
    let identLeft = MARGIN;

    if (args.logo) {
      const logoWidth = (args.logo.width / args.logo.height) * LETTERHEAD_LOGO_HEIGHT;
      this.page.drawImage(args.logo, {
        x: MARGIN,
        y: top - LETTERHEAD_LOGO_HEIGHT,
        width: logoWidth,
        height: LETTERHEAD_LOGO_HEIGHT,
      });
      identLeft = MARGIN + logoWidth + gap;
    }

    // Identity lines, in the same order and hierarchy as the sheet: type
    // first and in the brand accent, then reference, issue date, version
    // and the integrity hash. A missing logo never shifts them off the
    // left margin.
    const meta = [
      { text: args.typeFa, size: 11, bold: true, accent: true },
      { text: `شناسه قرارداد: ${args.referenceCode}`, size: 9, bold: false, accent: false },
      { text: `تاریخ صدور: ${args.issuedOnFa}`, size: 9, bold: false, accent: false },
      { text: args.versionLabelFa, size: 9, bold: false, accent: false },
      { text: `SHA-256: ${args.documentHash}`, size: 7, bold: false, accent: false },
    ];
    // Lines are right-aligned to the widest line's right edge, exactly as
    // a shrink-to-fit RTL block behaves in the sheet.
    const metaRight =
      identLeft +
      Math.max(
        ...meta.map((line) =>
          measureRtl(line.bold ? this.fonts.bold : this.fonts.regular, line.text, line.size)
        )
      );

    let metaY = top;
    for (const line of meta) {
      drawRtl(this.page, line.bold ? this.fonts.bold : this.fonts.regular, line.text, {
        y: metaY - line.size,
        size: line.size,
        color: line.accent ? BRAND_ACCENT : MUTED_INK,
        right: metaRight,
      });
      metaY -= line.size + 3.5;
    }

    // Close the letterhead with the brand rule, then centre the title.
    const headBottom = Math.min(top - (args.logo ? LETTERHEAD_LOGO_HEIGHT : 0), metaY);
    this.page.drawLine({
      start: { x: MARGIN, y: headBottom - 7 },
      end: { x: RIGHT, y: headBottom - 7 },
      thickness: 1,
      color: BRAND_ACCENT,
    });

    const titleSize = 15;
    const titleW = measureRtl(this.fonts.bold, args.titleFa, titleSize);
    const titleY = headBottom - 7 - 10 - titleSize;
    drawRtl(this.page, this.fonts.bold, args.titleFa, {
      y: titleY,
      size: titleSize,
      color: BRAND_INK,
      x: PAGE_WIDTH / 2 - titleW / 2,
    });
    this.y = titleY - 14;
  }

  /**
   * A slim identity head on every page AFTER the first — type, reference
   * and version, drawn in the top margin so it repeats the identification
   * without taking any space from the body. A loose printed sheet still
   * says which contract and which revision it belongs to.
   */
  runningHeads(typeFa: string, referenceCode: string, versionLabelFa: string): void {
    const pages = this.doc.getPages();
    const size = 8;
    const ruleY = PAGE_HEIGHT - MARGIN + 12;
    for (let i = 1; i < pages.length; i++) {
      const page = pages[i]!;
      page.drawLine({
        start: { x: MARGIN, y: ruleY },
        end: { x: RIGHT, y: ruleY },
        thickness: 0.5,
        color: HAIRLINE,
      });
      drawRtl(page, this.fonts.bold, typeFa, {
        y: ruleY + 5,
        size,
        color: BRAND_ACCENT,
        right: RIGHT,
      });
      drawRtl(page, this.fonts.regular, referenceCode, {
        y: ruleY + 5,
        size,
        color: MUTED_INK,
        x: MARGIN,
      });
      drawRtl(page, this.fonts.regular, versionLabelFa, {
        y: ruleY + 5,
        size,
        color: MUTED_INK,
        right: RIGHT - measureRtl(this.fonts.bold, typeFa, size) - 14,
      });
    }
  }

  paragraph(text: string, size = 10.5): void {
    const lines = wrapText(text, this.fonts.regular, size, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensure(size + 6);
      drawRtl(this.page, this.fonts.regular, line, {
        y: this.y - size,
        size,
        color: rgb(0.15, 0.15, 0.2),
        right: RIGHT,
      });
      this.y -= size + 5;
    }
    this.y -= 4;
  }

  spacer(height = 10): void {
    this.y -= height;
  }

  /**
   * Draw a RTL table. The heading row is repeated whenever the table
   * continues on a new page, and a row is never split across pages — the
   * same rules the screen sheet applies.
   */
  table(t: RenderedTable, size = 8.5): void {
    const padX = 5;
    const padY = 3.5;
    const lineHeight = size + 3.2;
    const colCount = t.columnsFa.length;
    if (colCount === 0 || t.rowsFa.length === 0) return;
    const colWidth = CONTENT_WIDTH / colCount;

    if (t.captionFa) {
      this.ensure(size + 10);
      drawRtl(this.page, this.fonts.bold, t.captionFa, {
        y: this.y - size,
        size: size + 0.5,
        color: rgb(0.11, 0.29, 0.24),
        right: RIGHT,
      });
      this.y -= size + 6;
    }

    const wrapCell = (text: string, bold: boolean) =>
      wrapText(text, bold ? this.fonts.bold : this.fonts.regular, size, colWidth - padX * 2);

    const rowHeight = (cells: string[], bold: boolean) => {
      const lines = Math.max(1, ...cells.map((c) => wrapCell(c, bold).length));
      return lines * lineHeight + padY * 2;
    };

    const drawRow = (cells: string[], bold: boolean, header: boolean) => {
      const h = rowHeight(cells, bold);
      const top = this.y;
      // RTL: the first column sits at the right edge.
      for (let c = 0; c < colCount; c++) {
        const xRight = RIGHT - c * colWidth;
        const xLeft = xRight - colWidth;
        this.page.drawRectangle({
          x: xLeft,
          y: top - h,
          width: colWidth,
          height: h,
          ...(header ? { color: rgb(0.945, 0.965, 0.953) } : {}),
          borderColor: rgb(0.8, 0.84, 0.82),
          borderWidth: 0.5,
        });
        const lines = wrapCell(cells[c] ?? "", bold);
        let ly = top - padY - size;
        for (const line of lines) {
          drawRtl(this.page, bold ? this.fonts.bold : this.fonts.regular, line, {
            y: ly,
            size,
            color: header ? rgb(0.11, 0.29, 0.24) : rgb(0.15, 0.17, 0.18),
            right: xRight - padX,
          });
          ly -= lineHeight;
        }
      }
      this.y = top - h;
    };

    const allRows: { cells: string[]; bold: boolean; header: boolean }[] = [
      { cells: t.columnsFa, bold: true, header: true },
      ...t.rowsFa.map((cells) => ({ cells, bold: false, header: false })),
    ];

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i]!;
      const h = rowHeight(row.cells, row.bold);
      if (this.y - h < this.bottom) {
        // New page, and the heading row comes with it.
        this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        this.y = PAGE_HEIGHT - MARGIN;
        if (i > 0) drawRow(t.columnsFa, true, true);
      }
      drawRow(row.cells, row.bold, row.header);
    }
    this.y -= 6;
  }

  /**
   * The blue ink-like review stamp, plus its mandatory disclaimer and the
   * public-safe review metadata. Drawn ONLY when a bound admin approval
   * exists — the caller decides that, not this method. When the OFFICIAL
   * PNG stamp is drawn instead (`drawBox: false`), only the metadata lines
   * are emitted here so the two marks never duplicate.
   */
  stampBlock(info: ReviewStampInfo, drawBox = true): void {
    const [r, g, b] = CONTRACT_REVIEW_STAMP_RGB;
    const blue = rgb(r / 255, g / 255, b / 255);

    if (drawBox) {
      const boxW = 250;
      const boxH = 46;
      this.ensure(boxH + 60);

      const boxX = RIGHT - boxW;
      const boxY = this.y - boxH;
      this.page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: blue,
        borderWidth: 1.5,
        borderDashArray: [4, 3],
        color: undefined,
      });

      const size = 15;
      const textWidth = measureRtl(this.fonts.bold, CONTRACT_REVIEW_STAMP_TEXT, size);
      drawRtl(this.page, this.fonts.bold, CONTRACT_REVIEW_STAMP_TEXT, {
        y: boxY + boxH / 2 - size / 2,
        size,
        color: blue,
        right: boxX + (boxW + textWidth) / 2,
      });
      this.y = boxY - 8;
    }

    const meta: string[] = [];
    if (info.reviewedAt) meta.push(`تاریخ بررسی: ${formatIsoJalali(info.reviewedAt.slice(0, 10))}`);
    if (info.reviewingOfficeFa) meta.push(`واحد بررسی: ${info.reviewingOfficeFa}`);
    if (info.reviewId) meta.push(`شناسهٔ بررسی: ${info.reviewId}`);
    if (info.reviewerInitials) meta.push(`بررسی‌کننده: ${info.reviewerInitials}`);
    if (meta.length > 0) this.paragraph(meta.join(" — "), 9);
    this.paragraph(CONTRACT_REVIEW_STAMP_DISCLAIMER_FA, 8.5);
  }

  /**
   * Draw the OFFICIAL LEGALIR seal and the print-only hologram inside the
   * reserved footer band on EVERY page. A PDF IS the print output, so the
   * hologram's security ink is drawn here — that is the whole point of
   * `PrintOnly`: the wordmark and serial exist only on the printed/PDF
   * copy, never on the screen preview.
   *
   * Only ever called when a valid, bound Super-Admin stamp approval
   * exists — the caller decides that.
   */
  officialMarkPages(seal: PDFImage, hologram: PDFImage | null, disclaimerFa: string): void {
    const sealHeight = STAMP_DRAW_HEIGHT;
    const sealWidth = (seal.width / seal.height) * sealHeight;
    const gap = 18;
    const holoHeight = STAMP_DRAW_HEIGHT;
    const holoWidth = hologram ? (hologram.width / hologram.height) * holoHeight : 0;
    const totalWidth = sealWidth + (hologram ? gap + holoWidth : 0);

    // Vertical centre of the seal row inside the band: above the
    // disclaimer (MARGIN+2, 7pt) and below the paraphe strip
    // (MARGIN+78). The three rows never touch.
    const cy = MARGIN + 34;
    const left = PAGE_WIDTH / 2 - totalWidth / 2;
    const theta = (STAMP_ANGLE * Math.PI) / 180;

    for (const page of this.doc.getPages()) {
      // Seal, tilted like a hand-applied mark.
      const sx = left + (sealWidth / 2) * Math.cos(theta) + (sealHeight / 2) * Math.sin(theta);
      const sy = cy - (sealWidth / 2) * Math.sin(theta) - (sealHeight / 2) * Math.cos(theta);
      page.drawImage(seal, {
        x: sx,
        y: sy,
        width: sealWidth,
        height: sealHeight,
        rotate: degrees(STAMP_ANGLE),
        opacity: 0.9,
      });

      if (hologram) {
        const hx = left + sealWidth + gap;
        page.drawImage(hologram, { x: hx, y: cy - holoHeight / 2, width: holoWidth, height: holoHeight });

        // The security ink INSIDE the hologram — print/PDF only. Its
        // position mirrors the source asset (49.3% / 57% of the label,
        // centred) so the printed text lands where the artwork expects it.
        const inkSize = 4.2;
        const brandW = measureRtl(this.fonts.bold, HOLOGRAM_PRINT_INK.brand, inkSize);
        drawRtl(page, this.fonts.bold, HOLOGRAM_PRINT_INK.brand, {
          y: cy + holoHeight / 2 - holoHeight * 0.493 - inkSize,
          size: inkSize,
          color: rgb(0, 0, 0),
          x: hx + holoWidth / 2 - brandW / 2,
        });
        const serialW = measureRtl(this.fonts.bold, HOLOGRAM_PRINT_INK.serial, inkSize);
        drawRtl(page, this.fonts.bold, HOLOGRAM_PRINT_INK.serial, {
          y: cy + holoHeight / 2 - holoHeight * 0.57 - inkSize,
          size: inkSize,
          color: rgb(0, 0, 0),
          x: hx + holoWidth / 2 - serialW / 2,
        });
      }

      // The mandatory disclaimer, centred at the very bottom of the band.
      const size = 7;
      const textW = measureRtl(this.fonts.regular, disclaimerFa, size);
      drawRtl(page, this.fonts.regular, disclaimerFa, {
        y: MARGIN + 3,
        size,
        color: rgb(0.35, 0.35, 0.4),
        x: PAGE_WIDTH / 2 - textW / 2,
      });
    }
  }

  /**
   * @deprecated kept for callers that predate the hologram; use
   * `officialMarkPages`. The image is placed in a fixed relative position
   * so every page carries the same mark, and it never reaches the text
   * area above the band.
   */
  officialStampPages(image: PDFImage, disclaimerFa: string): void {
    const height = STAMP_DRAW_HEIGHT;
    const width = (image.width / image.height) * height;
    const cx = PAGE_WIDTH / 2;
    // Vertical centre of the band, nudged up so the disclaimer fits below.
    const cy = MARGIN + FOOTER_BAND / 2 + 4;

    const theta = (STAMP_ANGLE * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const x = cx - (width / 2) * cos + (height / 2) * sin;
    const y = cy - (width / 2) * sin - (height / 2) * cos;

    for (const page of this.doc.getPages()) {
      page.drawImage(image, {
        x,
        y,
        width,
        height,
        rotate: degrees(STAMP_ANGLE),
        opacity: 0.9,
      });

      // The mandatory disclaimer, centred at the very bottom of the band.
      const size = 7;
      const textW = measureRtl(this.fonts.regular, disclaimerFa, size);
      drawRtl(page, this.fonts.regular, disclaimerFa, {
        y: MARGIN + 3,
        size,
        color: rgb(0.35, 0.35, 0.4),
        x: cx - textW / 2,
      });
    }
  }

  /**
   * §2.6 — the FULL signature block, as one unbreakable unit.
   *
   * The whole block is measured first; if it does not fit in the space
   * left on the current page, a fresh page is opened before anything is
   * drawn. So a page can never carry half a signature block, and the
   * final page always holds the complete block, directly above the QR.
   * Each signer gets a ruled signing area, so a wet signature or paraphe
   * has real space that is never confused with the typed name.
   */
  signatureBlock(
    lines: readonly { roleFa: string; nameFa: string; nationalId: string }[],
    footerFa: string,
    /** The verification QR that closes the document, drawn INSIDE the same
     *  unbreakable block so it too can never be separated from the
     *  signatures or spill onto extra sheets. */
    qr?: { payload: string; caption: string }
  ): void {
    const headingSize = 13;
    const lineSize = 10.5;
    const idSize = 9;
    /** Height of the ruled area a wet signature is written in. */
    const ruleH = 34;
    /**
     * One signer row = three label lines (role, name, national id) + the
     * ruled signing area + the caption BELOW the rule + a gap to the next
     * row. The signed box encloses the rule, so the ruling is never
     * mistaken for the edge of the box.
     */
    const rowH = 38 + ruleH + 18;
    const footerLines = wrapText(footerFa, this.fonts.regular, 9, CONTENT_WIDTH);
    const qrLines = qr
      ? wrapText(qr.caption, this.fonts.regular, 9, CONTENT_WIDTH - 96 - 16)
      : [];
    /** The QR code, its gap, and the closing space after it. */
    const qrHeight = qr ? 96 + 24 : 0;
    // Two signers per row, exactly like the sheet.
    const rows = Math.max(1, Math.ceil(lines.length / 2));
    // Everything this method actually consumes, measured from the top:
    // top rule + gap, the heading line, the signer rows, the separator, the
    // footer note lines, then the QR band. The fit test uses the SAME sum,
    // so the block can never end below the reserved footer band.
    const needed =
      10 + (headingSize + 10) + rows * rowH + 6 + footerLines.length * 13 + qrHeight + 8;

    // Unbreakable: move the whole block to a fresh page rather than split.
    if (this.y - needed < this.bottom) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }

    // A top rule separates the block from the material above it.
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 2 },
      end: { x: RIGHT, y: this.y - 2 },
      thickness: 0.7,
      color: HAIRLINE,
    });
    this.y -= 10;
    this.heading("امضای طرفین", headingSize);

    const colW = CONTENT_WIDTH / 2;
    for (let i = 0; i < lines.length; i += 2) {
      const rowTop = this.y;
      for (let c = 0; c < 2; c++) {
        const line = lines[i + c];
        if (!line) continue;
        // RTL: the FIRST signer sits in the RIGHT column.
        const colRight = c === 0 ? RIGHT : RIGHT - colW;
        const boxW = colW - 14;
        const boxX = colRight - boxW;

        // The signing box encloses the ruled area, so the ruling reads as a
        // writing line rather than as the box's own border. It ends ABOVE
        // the caption, so «امضا / پاراف» is never inside the signing space.
        this.page.drawRectangle({
          x: boxX,
          y: rowTop - 74,
          width: boxW,
          height: 70,
          borderColor: HAIRLINE,
          borderWidth: 0.7,
          borderDashArray: [3, 2],
        });

        drawRtl(this.page, this.fonts.bold, line.roleFa, {
          y: rowTop - 12,
          size: 9,
          color: MUTED_INK,
          right: colRight - 7,
        });
        drawRtl(this.page, this.fonts.bold, line.nameFa, {
          y: rowTop - 26,
          size: lineSize,
          color: BRAND_INK,
          right: colRight - 7,
        });
        drawRtl(this.page, this.fonts.regular, `کد ملی / شناسه: ${line.nationalId}`, {
          y: rowTop - 38,
          size: idSize,
          color: MUTED_INK,
          right: colRight - 7,
        });

        // The ruled area a signature/paraphe physically goes on.
        this.page.drawLine({
          start: { x: boxX + 7, y: rowTop - 38 - ruleH },
          end: { x: colRight - 7, y: rowTop - 38 - ruleH },
          thickness: 0.7,
          color: rgb(0.62, 0.69, 0.66),
        });
        // The caption stays BELOW the rule, so it is never mistaken for
        // handwriting space.
        drawRtl(this.page, this.fonts.regular, "امضا / پاراف", {
          y: rowTop - 38 - ruleH - 10,
          size: 8,
          color: MUTED_INK,
          right: colRight - 7,
        });
      }
      this.y = rowTop - rowH;
    }

    this.y -= 6;
    for (const line of footerLines) {
      drawRtl(this.page, this.fonts.regular, line, {
        y: this.y - 9,
        size: 9,
        color: MUTED_INK,
        right: RIGHT,
      });
      this.y -= 13;
    }

    if (!qr) return;

    // §2.8 — the verification QR closes the SAME block, so the signatures
    // and the way to verify them are always on one sheet.
    const boxSize = 96;
    const matrix = qrMatrix(qr.payload);
    const modules = matrix.length;
    const moduleSize = boxSize / modules;
    const originX = MARGIN;
    const originY = this.y - 8 - boxSize;
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (!matrix[r]![c]) continue;
        this.page.drawRectangle({
          x: originX + c * moduleSize,
          y: originY + (modules - 1 - r) * moduleSize,
          width: moduleSize,
          height: moduleSize,
          color: rgb(0, 0, 0),
        });
      }
    }
    let ty = this.y - 20;
    for (const line of qrLines) {
      drawRtl(this.page, this.fonts.regular, line, {
        y: ty,
        size: 9,
        color: rgb(0.25, 0.25, 0.3),
        right: RIGHT,
      });
      ty -= 12;
    }
    this.y = originY - 16;
  }

  /**
   * §2.6 — the per-page paraphe strip inside the reserved footer band.
   * One initialled box per signing role on EVERY page, so each sheet can
   * be initialled. Drawn at a fixed height inside the band, so it can
   * never touch body text, tables, the seal or the page number.
   */
  parapheStrip(roles: readonly string[]): void {
    const bandTop = MARGIN + FOOTER_BAND;
    const y = bandTop - 16;
    const size = 7.5;

    this.doc.getPages().forEach((page) => {
      // The strip's own hairline, set apart from the body.
      page.drawLine({
        start: { x: MARGIN, y: y + 12 },
        end: { x: RIGHT, y: y + 12 },
        thickness: 0.4,
        color: HAIRLINE,
        dashArray: [2, 2],
      });

      const caption = "پاراف صفحه";
      const captionW = measureRtl(this.fonts.bold, caption, size);
      drawRtl(page, this.fonts.bold, caption, {
        y,
        size,
        color: BRAND_ACCENT,
        right: RIGHT,
      });

      // Each role gets a labelled box, laid out right → left (RTL).
      let cursor = RIGHT - captionW - 10;
      for (const role of roles) {
        const boxW = 40;
        const labelW = measureRtl(this.fonts.regular, role, size);
        // The role label sits to the LEFT of its box, following reading order.
        drawRtl(page, this.fonts.regular, role, {
          y,
          size,
          color: MUTED_INK,
          right: cursor,
        });
        const boxRight = cursor - labelW - 3;
        page.drawRectangle({
          x: boxRight - boxW,
          y: y - 2,
          width: boxW,
          height: 11,
          borderColor: HAIRLINE,
          borderWidth: 0.5,
        });
        cursor = boxRight - boxW - 12;
        if (cursor < MARGIN + 30) break;
      }
    });
  }

  /**
   * «صفحه N از M» at the bottom of every page. Drawn below the content
   * margin (and below any reserved footer band), so a page number can
   * never be covered by the stamp.
   */
  pageNumbers(): void {
    const pages = this.doc.getPages();
    const total = pages.length;
    const size = 8;
    pages.forEach((page, i) => {
      const label = `صفحه ${toPersianDigits(i + 1)} از ${toPersianDigits(total)}`;
      const w = measureRtl(this.fonts.regular, label, size);
      drawRtl(page, this.fonts.regular, label, {
        y: 22,
        size,
        color: rgb(0.4, 0.4, 0.45),
        x: PAGE_WIDTH / 2 - w / 2,
      });
    });
  }

  /**
   * The faint diagonal «پیش‌نویس ـ تأییدنشده» watermark, drawn on EVERY
   * page. Used when no valid admin approval exists, so a printed draft
   * can never be mistaken for an approved document.
   */
  draftWatermark(): void {
    const size = 58;
    const gray = rgb(0.63, 0.63, 0.67);
    const angle = Math.PI / 4;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (const page of this.doc.getPages()) {
      const w = measureRtl(this.fonts.bold, CONTRACT_DRAFT_WATERMARK_FA, size);
      const cx = PAGE_WIDTH / 2;
      const cy = PAGE_HEIGHT / 2;
      // The text baseline runs from (startX, startY) along (dx, dy); place
      // its midpoint at the page center.
      const startX = cx - (w / 2) * dx;
      const startY = cy - (w / 2) * dy - (size / 2) * dx;
      drawRtl(page, this.fonts.bold, CONTRACT_DRAFT_WATERMARK_FA, {
        y: startY,
        size,
        color: gray,
        x: startX,
        rotate: degrees(45),
      });
    }
  }
}

export interface RenderPdfParams {
  contract: PropertyContract;
  version: PropertyContractVersion;
  /** Absolute base URL used to build the verification link. */
  baseUrl: string;
  /**
   * The review mark to draw. When omitted the document is treated as an
   * unapproved draft and carries the watermark — a caller can never
   * accidentally produce an unmarked document.
   */
  stamp?: ReviewStampInfo;
}

/**
 * Render the immutable PDF for a finalized contract version. The
 * content comes from `version.snapshot`, so the PDF always matches
 * the hash recorded on the version.
 */
export async function renderContractPdf(params: RenderPdfParams): Promise<Uint8Array> {
  const { contract, version, baseUrl, stamp } = params;

  const regularPath = findFontPath("Vazirmatn-Regular.ttf");
  const boldPath = findFontPath("Vazirmatn-Bold.ttf");
  if (!regularPath || !boldPath) {
    throw new Error("Vazirmatn font files are missing");
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(orientedFontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(fs.readFileSync(regularPath), { subset: true }),
    bold: await doc.embedFont(fs.readFileSync(boldPath), { subset: true }),
  };

  // The OFFICIAL stamp is drawn only when the caller supplied a bound stamp
  // approval AND the stamp master is byte-identical to the approved hash.
  // Any mismatch silently degrades to the legacy text mark — never a wrong
  // or stale image.
  let officialImage: PDFImage | null = null;
  let hologramImage: PDFImage | null = null;
  if (stamp?.applied && stamp.officialStamp) {
    const asset = loadReviewStamp();
    if (asset && asset.sha256 === stamp.officialStamp.sha256) {
      try {
        officialImage = await doc.embedPng(asset.bytes);
      } catch {
        officialImage = null;
      }
      // The hologram is the print-only companion. It is optional: a
      // missing hologram never blocks the seal, and it is never faked.
      const hologram = loadHologram();
      if (hologram) {
        try {
          hologramImage = await doc.embedPng(hologram.bytes);
        } catch {
          hologramImage = null;
        }
      }
    }
  }

  // The public LEGALIR mark is the letterhead of every printed contract.
  // A missing file degrades to a mark-less letterhead — never a broken
  // embed and never a substitute image.
  let logoImage: PDFImage | null = null;
  const logoBytes = loadDocumentLogo();
  if (logoBytes) {
    try {
      logoImage = await doc.embedPng(logoBytes);
    } catch {
      logoImage = null;
    }
  }

  // The footer band is ALWAYS reserved: every page carries a paraphe strip
  // (§2.6), not only a stamped one.
  const layout = new Layout(doc, fonts, true);

  // --- Letterhead: mark + identity group top-left, title centred below ---
  const snapshot = version.snapshot;
  const rendered = renderContract(
    { ...contract, data: snapshot.data },
    snapshot.parties,
    snapshot.payments
  );

  const referenceCode = contract.referenceCode;
  const versionLabelFa = `نسخه ${toPersianDigits(version.versionNumber)} — نسخه قالب: ${version.templateVersion}`;

  layout.letterhead({
    logo: logoImage,
    titleFa: rendered.titleFa,
    typeFa: contract.typeFa,
    referenceCode,
    issuedOnFa: formatIsoJalali(version.createdAt.slice(0, 10)),
    versionLabelFa,
    documentHash: version.documentHash,
  });

  // The approved-by-LEGALIR mark sits at the top, where a reader looks
  // first. An unapproved document gets NO stamp; its watermark is drawn
  // across every page at the end. When the official PNG is drawn, the blue
  // box is suppressed and only the review metadata is printed here.
  if (stamp?.applied) {
    layout.stampBlock(stamp, officialImage === null);
    layout.spacer(6);
  }

  // --- Preamble ---
  layout.paragraph(rendered.preambleFa);
  layout.spacer(4);

  // --- Clauses ---
  // The closing note (§2.2) is not a numbered article: it prints AFTER the
  // annex, immediately before the signatures, so it never reads as a term.
  const materialClauses = rendered.clauses.filter(
    (c) => c.id !== "common.supplementary_note"
  );
  const closingNote = rendered.clauses.find((c) => c.id === "common.supplementary_note");

  for (const clause of materialClauses) {
    layout.heading(clause.headingFa, 12);
    const blocks: RenderedBlock[] =
      clause.blocks ?? clause.paragraphs.map((textFa) => ({ kind: "paragraph", textFa }));
    for (const block of blocks) {
      if (block.kind === "paragraph") layout.paragraph(block.textFa);
      else layout.table(block.table);
    }
    layout.spacer(4);
  }

  // --- Legal-basis annex (§2) ---
  // A non-binding appendix; the same reviewed citations the preview shows.
  const legalBasisLines = legalBasisReportLines(buildLegalBasisReport(contract, rendered));
  if (legalBasisLines.length > 0) {
    layout.spacer(8);
    layout.heading("پیوست — مبنای حقوقی و گزارش بررسی", 12);
    for (const line of legalBasisLines) {
      layout.paragraph(line, 9);
    }
  }

  // --- Closing note (§2.2) — after every article and annex, separate ---
  if (closingNote) {
    layout.spacer(8);
    layout.heading(closingNote.headingFa, 12);
    const blocks: RenderedBlock[] =
      closingNote.blocks ??
      closingNote.paragraphs.map((textFa) => ({ kind: "paragraph", textFa }));
    for (const block of blocks) {
      if (block.kind === "paragraph") layout.paragraph(block.textFa);
      else layout.table(block.table);
    }
  }

  // --- Signatures + verification QR (§2.6 / §2.8) — ONE unbreakable block,
  // so the final page always holds the complete signature block and the QR
  // that verifies it; no page break can ever split them apart. ---
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/contracts/verify/${contract.publicVerificationId}`;
  layout.signatureBlock(rendered.signatureLines, rendered.footerFa, {
    payload: verifyUrl,
    caption: `برای بررسی اصالت این سند، کد QR را اسکن کنید یا به نشانی زیر مراجعه کنید:\n${verifyUrl}`,
  });

  // The official stamp, once authorised, is drawn on EVERY page inside the
  // reserved footer band. An unapproved contract gets the diagonal draft
  // watermark on every page instead, so a printed copy can never pass for
  // an approved one. The two are mutually exclusive.
  if (officialImage) {
    layout.officialMarkPages(officialImage, hologramImage, CONTRACT_REVIEW_STAMP_DISCLAIMER_FA);
  } else if (!stamp?.applied) {
    layout.draftWatermark();
  }

  // Pages 2+ repeat the identification in a slim running head, drawn in
  // the top margin so it never takes space from the body.
  layout.runningHeads(contract.typeFa, referenceCode, versionLabelFa);

  // §2.6 — every page carries a legible paraphe strip, inside the reserved
  // footer band so it can never collide with body text or the page number.
  layout.parapheStrip(rendered.signatureLines.map((line) => line.roleFa));

  // Page numbers on every page, below the content margin.
  layout.pageNumbers();

  return doc.save();
}
