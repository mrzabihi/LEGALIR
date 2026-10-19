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
import type {
  ContractPreSignTip,
  PropertyContractVersion,
  PropertyContract,
} from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_RGB,
  CONTRACT_REVIEW_STAMP_TEXT,
  PROPERTY_CONTRACT_STATE_LABELS,
} from "@legalir/types";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";
import { renderContract, type RenderedBlock, type RenderedTable } from "./template";
import {
  LEGAL_BASIS_SEED,
  buildLegalBasisReport,
  legalBasisReportLines,
  preSignTipsAnnexLines,
  seedPreSignTips,
  type LegalBasisCatalog,
} from "./legal-basis";
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

/**
 * A party's REAL signature state, keyed by the rendered role label. It is
 * supplied by the caller from the signature request bound to the version
 * being rendered — the renderer never infers or invents a signature.
 */
export interface SignatureMark {
  signedAt?: string | null;
  /** Human-readable state, e.g. «امضا شده» / «در انتظار امضا». */
  statusFa?: string;
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
 * review mark, the official seal/hologram, the paraphe strip and the
 * mandatory disclaimer — can never overlap body text, the signature table
 * or page numbers. The band is reserved unconditionally, because EVERY
 * page now carries a review mark and a paraphe strip (§2.6).
 *
 * Layout inside the band (bottom → top): the mark row starts at
 * MARGIN+20 — the hologram and seal at the PHYSICAL LEFT, the review block
 * on the right — and the paraphe strip sits at the top of the band. The
 * band is 170pt tall so the seal's new 40mm height (113.4pt) still clears
 * the paraphes even when tilted by 8°.
 */
export const FOOTER_BAND = 170;
/** The seal's drawn height: 40mm on the sheet — 2.5× the old 16mm mark. */
const SEAL_DRAW_HEIGHT = 113.4;
/** The hologram's drawn height: 32mm on the sheet — 2× the old mark. */
const HOLOGRAM_DRAW_HEIGHT = 90.7;
/** The bottom edge every member of the mark row is anchored to. */
const MARK_ROW_BOTTOM = MARGIN + 16;
/** Width of the per-page review block on the reading side of the band. */
const REVIEW_BOX_WIDTH = 208;
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
   * The cover letterhead. The LEGALIR mark keeps the physical TOP-LEFT
   * corner; the identifying group is RIGHT-ALIGNED against the right
   * margin, where a Persian reader looks for the document identity. The
   * contract title is a separate, centred line BELOW both, so the mark,
   * the metadata and the title can never overlap. Mirrors the A4 sheet's
   * `.a4-letterhead` rules so the PDF and the preview are one document.
   */
  letterhead(args: {
    logo: PDFImage | null;
    titleFa: string;
    typeFa: string;
    referenceCode: string;
    contractDateFa: string;
    versionLabelFa: string;
    stateFa: string;
    documentHash: string;
  }): void {
    const top = this.y;

    if (args.logo) {
      const logoWidth = (args.logo.width / args.logo.height) * LETTERHEAD_LOGO_HEIGHT;
      this.page.drawImage(args.logo, {
        x: MARGIN,
        y: top - LETTERHEAD_LOGO_HEIGHT,
        width: logoWidth,
        height: LETTERHEAD_LOGO_HEIGHT,
      });
    }

    // Identity lines, in the same order and hierarchy as the sheet: type
    // first and in the brand accent, then reference, contract date, version
    // + template version, status and the integrity hash — all flush with
    // the RIGHT margin, exactly like the sheet's right-aligned block.
    const meta = [
      { text: args.typeFa, size: 11, bold: true, accent: true },
      { text: `شناسه قرارداد: ${args.referenceCode}`, size: 9, bold: false, accent: false },
      { text: `تاریخ قرارداد: ${args.contractDateFa}`, size: 9, bold: false, accent: false },
      { text: args.versionLabelFa, size: 9, bold: false, accent: false },
      { text: `وضعیت: ${args.stateFa}`, size: 9, bold: false, accent: false },
      { text: `SHA-256: ${args.documentHash}`, size: 7, bold: false, accent: false },
    ];

    let metaY = top;
    for (const line of meta) {
      drawRtl(this.page, line.bold ? this.fonts.bold : this.fonts.regular, line.text, {
        y: metaY - line.size,
        size: line.size,
        color: line.accent ? BRAND_ACCENT : MUTED_INK,
        right: RIGHT,
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
   * The blue ink-like review mark, its real per-contract metadata and the
   * mandatory disclaimer — drawn inside the reserved footer band of EVERY
   * page, on the READING side (physical right). Drawn ONLY when a bound
   * admin approval exists — the caller decides that, not this method.
   *
   * Every field falls back to «ثبت نشده» rather than disappearing, so a
   * printed sheet can never look approved without saying who reviewed it.
   * The disclaimer is the last line of the block, so a mark can never be
   * printed without it, and it is emitted exactly once per page.
   */
  reviewMarkPages(info: ReviewStampInfo): void {
    const [r, g, b] = CONTRACT_REVIEW_STAMP_RGB;
    const blue = rgb(r / 255, g / 255, b / 255);

    const titleSize = 8.5;
    const metaSize = 6.4;
    const noteSize = 6;
    const padX = 7;
    const padY = 5;
    const lineGap = 2.2;

    const meta = [
      `تاریخ بررسی: ${
        info.reviewedAt ? formatIsoJalali(info.reviewedAt.slice(0, 10)) : "ثبت نشده"
      }`,
      `بررسی‌کننده: ${info.reviewerInitials || info.reviewingOfficeFa || "ثبت نشده"}`,
      `شناسه بررسی: ${info.reviewId || "ثبت نشده"}`,
    ];
    const noteLines = wrapText(
      CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
      this.fonts.regular,
      noteSize,
      REVIEW_BOX_WIDTH - padX * 2
    );

    const titleH = titleSize + lineGap;
    const metaH = meta.length * (metaSize + lineGap);
    const noteH = noteLines.length * (noteSize + 1.4);
    const boxH = padY * 2 + titleH + metaH + 5 + noteH;
    const boxX = RIGHT - REVIEW_BOX_WIDTH;
    const boxY = MARK_ROW_BOTTOM;

    for (const page of this.doc.getPages()) {
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: REVIEW_BOX_WIDTH,
        height: boxH,
        borderColor: blue,
        borderWidth: 0.9,
        borderDashArray: [3, 2],
      });

      let cursor = boxY + boxH - padY;
      const titleW = measureRtl(this.fonts.bold, CONTRACT_REVIEW_STAMP_TEXT, titleSize);
      drawRtl(page, this.fonts.bold, CONTRACT_REVIEW_STAMP_TEXT, {
        y: cursor - titleSize,
        size: titleSize,
        color: blue,
        right: boxX + padX + titleW,
      });
      cursor -= titleH;

      for (const line of meta) {
        drawRtl(page, this.fonts.regular, line, {
          y: cursor - metaSize,
          size: metaSize,
          color: blue,
          right: RIGHT - padX,
        });
        cursor -= metaSize + lineGap;
      }

      // The disclaimer is separated by a hairline so it reads as a caveat,
      // never as another review field.
      cursor -= 4;
      page.drawLine({
        start: { x: boxX + padX, y: cursor },
        end: { x: RIGHT - padX, y: cursor },
        thickness: 0.4,
        color: blue,
        opacity: 0.5,
      });
      cursor -= 2;
      for (const line of noteLines) {
        drawRtl(page, this.fonts.regular, line, {
          y: cursor - noteSize,
          size: noteSize,
          color: MUTED_INK,
          right: RIGHT - padX,
        });
        cursor -= noteSize + 1.4;
      }
    }
  }

  /**
   * Draw the OFFICIAL LEGALIR seal and the print-only hologram on EVERY
   * page, at the PHYSICAL BOTTOM-LEFT of the reserved footer band — the
   * same corner the on-screen sheet paints them in. A PDF IS the print
   * output, so the hologram's security ink is drawn here: the wordmark and
   * serial exist only on the printed/PDF copy, never on the screen preview.
   *
   * The seal is drawn at 40mm (2.5× the old mark) and the hologram at
   * 32mm (2×), both with their source aspect ratio preserved. They sit in
   * a band whose height was raised to 170pt, so the larger mark still
   * clears the paraphe strip above it and never touches body text.
   *
   * Only ever called when a valid, bound Super-Admin stamp approval
   * exists — the caller decides that.
   */
  officialMarkPages(seal: PDFImage, hologram: PDFImage | null): void {
    const sealHeight = SEAL_DRAW_HEIGHT;
    const sealWidth = (seal.width / seal.height) * sealHeight;
    const gap = 14;
    const holoHeight = HOLOGRAM_DRAW_HEIGHT;
    const holoWidth = hologram ? (hologram.width / hologram.height) * holoHeight : 0;
    const theta = (STAMP_ANGLE * Math.PI) / 180;

    // The hologram is the LEFTMOST item, so the pair reads «holo · seal»
    // from the physical bottom-left corner — identical to the sheet.
    const holoX = MARGIN;
    const sealLeft = MARGIN + (hologram ? holoWidth + gap : 0);
    const sealCy = MARK_ROW_BOTTOM + sealHeight / 2;

    for (const page of this.doc.getPages()) {
      if (hologram) {
        page.drawImage(hologram, {
          x: holoX,
          y: MARK_ROW_BOTTOM,
          width: holoWidth,
          height: holoHeight,
        });

        // The security ink INSIDE the hologram — print/PDF only. Its
        // position mirrors the source asset (49.3% / 57% of the label,
        // centred) so the printed text lands where the artwork expects it.
        // The ink scales with the larger hologram, never overflows it.
        const inkSize = 4.2 * (holoHeight / 46);
        const inkTop = MARK_ROW_BOTTOM + holoHeight;
        const brandW = measureRtl(this.fonts.bold, HOLOGRAM_PRINT_INK.brand, inkSize);
        drawRtl(page, this.fonts.bold, HOLOGRAM_PRINT_INK.brand, {
          y: inkTop - holoHeight * 0.493 - inkSize,
          size: inkSize,
          color: rgb(0, 0, 0),
          x: holoX + holoWidth / 2 - brandW / 2,
        });
        const serialW = measureRtl(this.fonts.bold, HOLOGRAM_PRINT_INK.serial, inkSize);
        drawRtl(page, this.fonts.bold, HOLOGRAM_PRINT_INK.serial, {
          y: inkTop - holoHeight * 0.57 - inkSize,
          size: inkSize,
          color: rgb(0, 0, 0),
          x: holoX + holoWidth / 2 - serialW / 2,
        });
      }

      // The seal, tilted like a hand-applied mark. pdf-lib rotates around
      // the anchor, so the anchor is offset to keep the IMAGE's visual
      // centre where the layout puts it.
      const sx = sealLeft + (sealWidth / 2) * Math.cos(theta) + (sealHeight / 2) * Math.sin(theta);
      const sy = sealCy - (sealWidth / 2) * Math.sin(theta) - (sealHeight / 2) * Math.cos(theta);
      page.drawImage(seal, {
        x: sx,
        y: sy,
        width: sealWidth,
        height: sealHeight,
        rotate: degrees(STAMP_ANGLE),
        opacity: 0.9,
      });
    }
  }

  /**
   * §2.6 — the FULL signature block, as ONE unbreakable RTL table.
   *
   * Four columns, right → left, exactly like the on-screen sheet:
   * «نقش» / «نام کامل» / «محل امضا» / «وضعیت امضا». The whole block is
   * measured first; if it does not fit in the space left on the current
   * page, a fresh page is opened before anything is drawn — so a table
   * row is never split and the final page always holds the complete block
   * together with the QR that verifies it.
   *
   * The signing-state cell shows ONLY what the caller passed in `marks`
   * (read from the real signature request bound to this version). With no
   * mark for a role the cell reads «در انتظار امضا» — a signature is never
   * invented, and an unconfirmed one is never presented as real.
   */
  signatureBlock(
    lines: readonly { roleFa: string; nameFa: string; nationalId: string }[],
    footerFa: string,
    /** The verification QR that closes the document, drawn INSIDE the same
     *  unbreakable block so it too can never be separated from the
     *  signatures or spill onto extra sheets. */
    qr?: { payload: string; caption: string },
    /** Real per-role signature state, keyed by the rendered role label. */
    marks: Readonly<Record<string, SignatureMark>> = {}
  ): void {
    const headingSize = 13;
    /**
     * 11pt = 14.67 CSS px at 96dpi, so the party's name is never below
     * the 14px floor the brief requires — and it is drawn bold.
     */
    const nameSize = 11;
    const idSize = 8;
    const roleSize = 8.5;
    const stateSize = 9;
    const cellPad = 8;
    /** A row holds the role, a 14px+ name, the national id, the ruling and
     *  the state, so a wet signature has real, unambiguous space. */
    const rowH = 66;
    const headerH = 22;

    const footerLines = wrapText(footerFa, this.fonts.regular, 9, CONTENT_WIDTH);
    const qrLines = qr
      ? wrapText(qr.caption, this.fonts.regular, 9, CONTENT_WIDTH - 96 - 16)
      : [];
    /** The QR code, its gap, and the closing space after it. */
    const qrHeight = qr ? 96 + 24 : 0;
    const rows = Math.max(1, lines.length);
    const tableH = headerH + rows * rowH;
    // Everything this method actually consumes, measured from the top:
    // top rule + gap, the heading line, the table, the separator, the
    // footer note lines, then the QR band. The fit test uses the SAME sum,
    // so the block can never end below the reserved footer band.
    const needed =
      10 + (headingSize + 10) + tableH + 6 + footerLines.length * 13 + qrHeight + 8;

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

    // Column geometry, RTL: index 0 is the RIGHTMOST column.
    const weights = [0.2, 0.3, 0.28, 0.22];
    const widths = weights.map((w) => CONTENT_WIDTH * w);
    const rights = widths.map(
      (_, i) => RIGHT - widths.slice(0, i).reduce((sum, w) => sum + w, 0)
    );
    const lefts = widths.map((w, i) => rights[i]! - w);

    const tableTop = this.y;
    const tableBottom = tableTop - tableH;

    // Header band — a tinted strip so the column roles read at a glance.
    this.page.drawRectangle({
      x: MARGIN,
      y: tableTop - headerH,
      width: CONTENT_WIDTH,
      height: headerH,
      color: rgb(0.955, 0.965, 0.958),
    });
    const headers = ["نقش", "نام کامل", "محل امضا", "وضعیت امضا"];
    headers.forEach((label, i) => {
      drawRtl(this.page, this.fonts.bold, label, {
        y: tableTop - headerH / 2 - 4.5,
        size: 9,
        color: BRAND_INK,
        right: rights[i]! - cellPad,
      });
    });

    let rowTop = tableTop - headerH;
    for (const [rowIndex, line] of lines.entries()) {
      const mark = marks[line.roleFa];

      // نقش
      drawRtl(this.page, this.fonts.bold, line.roleFa, {
        y: rowTop - cellPad - roleSize,
        size: roleSize,
        color: MUTED_INK,
        right: rights[0]! - cellPad,
      });

      // نام کامل — always 11pt bold; the identifier sits beneath it.
      drawRtl(this.page, this.fonts.bold, line.nameFa, {
        y: rowTop - cellPad - nameSize,
        size: nameSize,
        color: BRAND_INK,
        right: rights[1]! - cellPad,
      });
      if (line.nationalId && line.nationalId !== "……………") {
        drawRtl(this.page, this.fonts.regular, `کد ملی / شناسه: ${line.nationalId}`, {
          y: rowTop - cellPad - nameSize - 5 - idSize,
          size: idSize,
          color: MUTED_INK,
          right: rights[1]! - cellPad,
        });
      }

      // محل امضا — the ruling a wet signature or paraphe physically goes on.
      const ruleY = tableBottom + (rows - (rowIndex + 1)) * rowH + cellPad + 6;
      this.page.drawLine({
        start: { x: lefts[2]! + cellPad, y: ruleY },
        end: { x: rights[2]! - cellPad, y: ruleY },
        thickness: 0.6,
        color: rgb(0.62, 0.69, 0.66),
      });
      drawRtl(this.page, this.fonts.regular, "امضا / پاراف", {
        y: ruleY - 10,
        size: 7.5,
        color: MUTED_INK,
        right: rights[2]! - cellPad,
      });

      // وضعیت امضا — REAL state only; a role with no mark is pending.
      const stateRight = rights[3]! - cellPad;
      if (mark?.statusFa) {
        drawRtl(this.page, this.fonts.bold, mark.statusFa, {
          y: rowTop - cellPad - stateSize,
          size: stateSize,
          color: mark.signedAt ? BRAND_ACCENT : MUTED_INK,
          right: stateRight,
        });
        if (mark.signedAt) {
          drawRtl(
            this.page,
            this.fonts.regular,
            `تاریخ امضا: ${formatIsoJalali(mark.signedAt.slice(0, 10))}`,
            {
              y: rowTop - cellPad - stateSize - 5 - 8,
              size: 8,
              color: MUTED_INK,
              right: stateRight,
            }
          );
        }
      } else {
        drawRtl(this.page, this.fonts.regular, "در انتظار امضا", {
          y: rowTop - cellPad - stateSize,
          size: stateSize,
          color: MUTED_INK,
          right: stateRight,
        });
      }

      // Row hairline, then advance.
      this.page.drawLine({
        start: { x: MARGIN, y: rowTop - rowH },
        end: { x: RIGHT, y: rowTop - rowH },
        thickness: 0.5,
        color: HAIRLINE,
      });
      rowTop -= rowH;
    }

    // The table's own frame and the column separators.
    this.page.drawRectangle({
      x: MARGIN,
      y: tableBottom,
      width: CONTENT_WIDTH,
      height: tableH,
      borderColor: HAIRLINE,
      borderWidth: 0.8,
    });
    for (let i = 1; i < 4; i++) {
      this.page.drawLine({
        start: { x: rights[i]!, y: tableBottom },
        end: { x: rights[i]!, y: tableTop },
        thickness: 0.4,
        color: HAIRLINE,
      });
    }
    this.y = tableBottom;

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
  /**
   * §7 — the merged legal catalog (seed + stored reviewer records). Omit to
   * render from the reviewed seed, which keeps every existing caller
   * byte-identical.
   */
  legalBasisCatalog?: LegalBasisCatalog;
  /**
   * §7 — the type's non-compulsory «before you sign» tips, printed as their
   * own annex. Omit to fall back to the reviewed seed.
   */
  preSignTips?: ContractPreSignTip[];
  /**
   * The REAL signature state per party role, read from the signature
   * request bound to this version. Omit it and every row reads «در انتظار
   * امضا» — a signature is never assumed.
   */
  signatureMarks?: Record<string, SignatureMark>;
  /** The contract's human-readable state, printed in the letterhead. */
  stateFa?: string;
}

/**
 * Render the immutable PDF for a finalized contract version. The
 * content comes from `version.snapshot`, so the PDF always matches
 * the hash recorded on the version.
 */
export async function renderContractPdf(params: RenderPdfParams): Promise<Uint8Array> {
  const {
    contract,
    version,
    baseUrl,
    stamp,
    legalBasisCatalog = LEGAL_BASIS_SEED,
    preSignTips = seedPreSignTips(contract.type),
    signatureMarks = {},
    stateFa,
  } = params;

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

  // The contract date mirrors the sheet: the rent wizard stores its own
  // date, every other type uses the immutable creation date.
  const durations = (contract.data as { durations?: { contractDate?: string } } | null)?.durations;
  const storedDate = contract.type === "property_rent" ? durations?.contractDate : null;
  const contractDateFa = formatIsoJalali(
    (storedDate || contract.createdAt).slice(0, 10)
  );
  const stateLabel =
    stateFa ?? PROPERTY_CONTRACT_STATE_LABELS[contract.state] ?? String(contract.state);

  layout.letterhead({
    logo: logoImage,
    titleFa: rendered.titleFa,
    typeFa: contract.typeFa,
    referenceCode,
    contractDateFa,
    versionLabelFa,
    stateFa: stateLabel,
    documentHash: version.documentHash,
  });

  // The review mark is NOT a header element: it is drawn inside the
  // reserved footer band of EVERY page by `reviewMarkPages` below, exactly
  // where the on-screen sheet paints it. An unapproved document gets no
  // mark at all; its watermark is drawn across every page at the end.

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
  const legalBasisLines = legalBasisReportLines(
    buildLegalBasisReport(contract, rendered, legalBasisCatalog)
  );
  if (legalBasisLines.length > 0) {
    layout.spacer(8);
    layout.heading("پیوست — مبنای حقوقی و گزارش بررسی", 12);
    for (const line of legalBasisLines) {
      layout.paragraph(line, 9);
    }
  }

  // --- Pre-sign tips annex (§7) — a SEPARATE, non-compulsory block ---
  // Belongs to the contract TYPE, never to the text. It prints in both the
  // draft and the final version, always after the legal-basis annex and with
  // its own «informational only» framing line.
  const tipsLines = preSignTipsAnnexLines(preSignTips);
  if (tipsLines.length > 0) {
    layout.spacer(8);
    layout.heading("پیوست — نکات پیش از امضا (غیرالزام‌آور)", 12);
    for (const line of tipsLines) {
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
  layout.signatureBlock(
    rendered.signatureLines,
    rendered.footerFa,
    {
      payload: verifyUrl,
      caption: `برای بررسی اصالت این سند، کد QR را اسکن کنید یا به نشانی زیر مراجعه کنید:\n${verifyUrl}`,
    },
    signatureMarks
  );

  // The REVIEW mark is drawn on EVERY page inside the reserved footer band,
  // on the reading side. It carries the contract's real review fields and
  // the mandatory disclaimer, so it can never read as confirmed without a
  // record. The OFFICIAL seal + hologram then join the same band at the
  // physical bottom-left. An unapproved contract gets neither — only the
  // diagonal draft watermark on every page — so the two can never mix.
  if (stamp?.applied) {
    layout.reviewMarkPages(stamp);
    if (officialImage) layout.officialMarkPages(officialImage, hologramImage);
  } else {
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
