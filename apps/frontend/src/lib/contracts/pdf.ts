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
import {
  PDFDocument,
  rgb,
  degrees,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
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
  /**
   * Which registration path authorised the document. `legalir_review`
   * (the default) draws the blue «بررسی شد» mark; `self_final` draws an
   * amber «بدون بررسی لیگالیر» notice in the same slot instead — the
   * unreviewed path must never borrow the reviewed mark.
   */
  path?: "legalir_review" | "self_final";
  /** Who registered a `self_final` document, and why. */
  selfFinal?: {
    actorLabelFa?: string | null;
    registeredAt?: string | null;
    reasonFa?: string | null;
  } | null;
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

/**
 * One uploaded signature scan, to be drawn in the cell of the party it
 * belongs to. The caller resolves the file from private storage; a role
 * with no image keeps the ruled line and its status text, never a fake
 * mark.
 */
export interface ContractSignatureImage {
  /** The rendered role label — the same key the signature table uses. */
  roleFa: string;
  mime: "image/png" | "image/jpeg";
  bytes: Uint8Array;
}

/** One annex file to append AFTER the contract pages, in registration order. */
export interface ContractAnnexInput {
  /** «عنوان پیوست» — printed above the annexed content. */
  titleFa: string;
  /** Original file name, printed for traceability. */
  fileName?: string;
  mime: string;
  bytes: Uint8Array;
}

/** The red admin message printed on the last contract page. */
export interface ContractAdminMessageInput {
  messageFa: string;
}

/**
 * The facts the «تأییدیهٔ اصالت» page prints. Every field comes from the
 * real contract record — the page is a STATEMENT BY LEGALIR about its
 * own records, never a claim that any external authority confirmed it.
 */
export interface AuthenticityInfo {
  path: "legalir_review" | "self_final";
  reviewedByLegalir: boolean;
  /** When the document reached the signature stage. */
  registeredAt: string | null;
  registeredByLabelFa: string | null;
  reviewId: string | null;
  reviewedAt: string | null;
  participants: {
    roleFa: string;
    nameFa: string;
    statusFa: string;
    signedAt: string | null;
    methodFa: string | null;
  }[];
  stampApplied: boolean;
  stampSha256: string | null;
  hologramApplied: boolean;
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

/**
 * Annex/certificate pages reuse the SAME reserved geometry as the body,
 * so every page LEGALIR emits — contract text, annexed file, authenticity
 * certificate — carries the seal, hologram, paraphes and page number in
 * the identical place, and no annexed content is ever covered by them.
 */
const ANNEX_HEADER_HEIGHT = 30;
/** Height of the reserved red message strip on the last contract page. */
const ADMIN_MESSAGE_HEIGHT = 40;
/** The amber ink the unreviewed notice is drawn in (#B45309). */
const SELF_FINAL_INK = rgb(0.706, 0.325, 0.035);
/** The red ink of the admin message (#B91C1C). */
const ADMIN_MESSAGE_INK = rgb(0.725, 0.11, 0.11);

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
  /**
   * The floor content may not cross. Normally the top of the reserved
   * footer band; `reserveBand` raises it for a section that must leave
   * room for the admin message card on the FINAL page.
   */
  private bottom: number;

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

  /**
   * Raise the content floor so the LAST page of the document keeps the
   * admin message card's band free. Called before the closing section
   * (the authenticity certificate) is laid out — everything after it,
   * including a page break, respects the raised floor.
   */
  reserveBand(extra: number): void {
    this.bottom = MARGIN + FOOTER_BAND + Math.max(0, extra);
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
  runningHeads(
    typeFa: string,
    referenceCode: string,
    versionLabelFa: string,
    /** Section pages (annexes, certificate) draw their own head. */
    bodyPageCount = this.doc.getPages().length
  ): void {
    const pages = this.doc.getPages();
    const size = 8;
    const ruleY = PAGE_HEIGHT - MARGIN + 12;
    for (let i = 1; i < Math.min(bodyPageCount, pages.length); i++) {
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
   * The UNREVIEWED notice, drawn in the SAME footer slot the blue review
   * mark occupies. It says plainly that LEGALIR did not review the text —
   * a `self_final` document must never borrow the reviewed mark, and a
   * printed copy must never be mistakable for an approved one.
   */
  selfFinalMarkPages(info: ReviewStampInfo): void {
    const amber = SELF_FINAL_INK;
    const titleSize = 8.5;
    const metaSize = 6.4;
    const noteSize = 6;
    const padX = 7;
    const padY = 5;
    const lineGap = 2.2;

    const meta = [
      `ثبت‌کننده: ${info.selfFinal?.actorLabelFa || "طرف قرارداد"}`,
      `تاریخ ثبت نهایی: ${
        info.selfFinal?.registeredAt
          ? formatIsoJalali(info.selfFinal.registeredAt.slice(0, 10))
          : "ثبت نشده"
      }`,
      info.selfFinal?.reasonFa || "بدون بررسی لیگالیر",
    ];
    const noteLines = wrapText(
      "این سند بدون بررسی واحد حقوقی لیگالیر ثبت نهایی شده است و «بررسی‌شده» محسوب نمی‌شود.",
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
        borderColor: amber,
        borderWidth: 0.9,
        borderDashArray: [3, 2],
      });

      let cursor = boxY + boxH - padY;
      const title = "ثبت نهایی بدون بررسی لیگالیر";
      const titleW = measureRtl(this.fonts.bold, title, titleSize);
      drawRtl(page, this.fonts.bold, title, {
        y: cursor - titleSize,
        size: titleSize,
        color: amber,
        right: boxX + padX + titleW,
      });
      cursor -= titleH;

      for (const line of meta) {
        drawRtl(page, this.fonts.regular, line, {
          y: cursor - metaSize,
          size: metaSize,
          color: amber,
          right: RIGHT - padX,
        });
        cursor -= metaSize + lineGap;
      }

      cursor -= 4;
      page.drawLine({
        start: { x: boxX + padX, y: cursor },
        end: { x: RIGHT - padX, y: cursor },
        thickness: 0.4,
        color: amber,
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
   * The red admin message, printed on the page it is called on at a FIXED
   * position just above the reserved footer band. The dashed frame reads
   * as a stamped/perforated strip, and because the band below it is
   * reserved, it can never touch the seal, the hologram, the paraphes or
   * the page number. When there is no message this is never called, so
   * no empty space is printed.
   */
  adminMessageBlock(messageFa: string): void {
    const page = this.page;
    const size = 9;
    const labelSize = 6.5;
    const padX = 8;
    const padY = 6;
    const lines = wrapText(
      messageFa,
      this.fonts.bold,
      size,
      CONTENT_WIDTH - padX * 2
    ).slice(0, 2);

    const boxH = Math.min(
      ADMIN_MESSAGE_HEIGHT,
      padY * 2 + labelSize + 2 + lines.length * (size + 3)
    );
    const boxX = MARGIN;
    const boxY = MARGIN + FOOTER_BAND + 8;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: CONTENT_WIDTH,
      height: boxH,
      color: rgb(1, 0.965, 0.965),
      borderColor: ADMIN_MESSAGE_INK,
      borderWidth: 0.9,
      borderDashArray: [4, 2],
    });
    drawRtl(page, this.fonts.regular, "پیام ادمین", {
      y: boxY + boxH - padY - labelSize,
      size: labelSize,
      color: ADMIN_MESSAGE_INK,
      right: RIGHT - padX,
    });
    let ty = boxY + boxH - padY - labelSize - 5 - size;
    for (const line of lines) {
      drawRtl(page, this.fonts.bold, line, {
        y: ty,
        size,
        color: ADMIN_MESSAGE_INK,
        right: RIGHT - padX,
      });
      ty -= size + 3;
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
    marks: Readonly<Record<string, SignatureMark>> = {},
    /** Uploaded signature scans, keyed by the SAME role label. A role with
     *  no image keeps its ruled line and status text — never a fake mark. */
    images: Readonly<Record<string, PDFImage>> = {},
    /** Extra space the last page must keep free (the red admin message). */
    reserveExtra = 0
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
      10 +
      (headingSize + 10) +
      tableH +
      6 +
      footerLines.length * 13 +
      qrHeight +
      8 +
      reserveExtra;

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

      // The party's OWN uploaded signature, fitted into the cell with its
      // aspect ratio preserved (never stretched, never cropped, never in
      // another party's row). The ruling stays beneath it so the cell
      // still reads as a signature place on a blank copy.
      const image = images[line.roleFa];
      if (image) {
        const maxW = rights[2]! - lefts[2]! - cellPad * 2;
        const maxH = Math.max(12, rowTop - cellPad - (ruleY + 4));
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        this.page.drawImage(image, {
          x: rights[2]! - cellPad - w - (maxW - w) / 2,
          y: ruleY + 3,
          width: w,
          height: h,
        });
      } else {
        drawRtl(this.page, this.fonts.regular, "امضا / پاراف", {
          y: ruleY - 10,
          size: 7.5,
          color: MUTED_INK,
          right: rights[2]! - cellPad,
        });
      }

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
   * Start a new page that is NOT contract body: an annexed file page or
   * the authenticity certificate. It carries the same reserved footer
   * band and the same identification head as body pages 2+, so every
   * page of the file is uniform — and the next `ensure()` can never
   * place content in the band.
   */
  sectionPage(args: {
    titleFa: string;
    partFa?: string;
    referenceCode: string;
    typeFa: string;
  }): PDFPage {
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page = page;
    const headY = PAGE_HEIGHT - MARGIN - ANNEX_HEADER_HEIGHT + 14;
    page.drawLine({
      start: { x: MARGIN, y: headY },
      end: { x: RIGHT, y: headY },
      thickness: 0.5,
      color: HAIRLINE,
    });
    drawRtl(page, this.fonts.bold, args.titleFa, {
      y: headY + 5,
      size: 9,
      color: BRAND_ACCENT,
      right: RIGHT,
    });
    drawRtl(page, this.fonts.regular, args.referenceCode, {
      y: headY + 5,
      size: 8,
      color: MUTED_INK,
      x: MARGIN,
    });
    if (args.partFa) {
      drawRtl(page, this.fonts.regular, args.partFa, {
        y: headY + 5,
        size: 8,
        color: MUTED_INK,
        right: RIGHT - measureRtl(this.fonts.bold, args.titleFa, 9) - 12,
      });
    }
    this.y = PAGE_HEIGHT - MARGIN - ANNEX_HEADER_HEIGHT;
    return page;
  }

  /** The rectangle annexed content may occupy on a section page. */
  private annexedContentBox(): { left: number; bottom: number; width: number; height: number } {
    // `this.bottom` is the live floor: the reserved footer band, raised
    // further when the admin card will be printed on the closing page.
    const bottom = this.bottom + 4;
    return {
      left: MARGIN,
      bottom,
      width: CONTENT_WIDTH,
      height: PAGE_HEIGHT - MARGIN - ANNEX_HEADER_HEIGHT - bottom,
    };
  }

  /**
   * Append ONE annex file AFTER the contract pages. A PDF's pages are
   * embedded verbatim (all of them, in order) and fitted into the
   * content box; an image is scaled with its aspect ratio preserved and
   * centred. Neither is ever cropped, stretched or split by our layout —
   * the reserved band keeps it clear of the seal and page number.
   *
   * Returns the number of pages added (0 when the file produced none).
   */
  async addAnnexedFile(args: {
    titleFa: string;
    fileName?: string;
    mime: string;
    bytes: Uint8Array;
    referenceCode: string;
    typeFa: string;
    /**
     * `totalPages` is known only after the file is read; the label is
     * therefore drawn as «برگ N» and the final «صفحه X از Y» at the
     * bottom of every page remains the authoritative count.
     */
  }): Promise<number> {
    const box = this.annexedContentBox();
    let added = 0;

    if (args.mime === "application/pdf") {
      let source: PDFDocument;
      try {
        source = await PDFDocument.load(args.bytes, { ignoreEncryption: true });
      } catch {
        throw new Error(`ANNEX_PDF_UNREADABLE:${args.titleFa}`);
      }
      const sourcePages = source.getPages();
      for (const [index, sourcePage] of sourcePages.entries()) {
        const embedded: PDFEmbeddedPage = await this.doc.embedPage(sourcePage);
        const page = this.sectionPage({
          titleFa: args.titleFa,
          partFa: `برگ ${toPersianDigits(index + 1)} از ${toPersianDigits(sourcePages.length)}`,
          referenceCode: args.referenceCode,
          typeFa: args.typeFa,
        });
        const scale = Math.min(box.width / embedded.width, box.height / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawPage(embedded, {
          x: box.left + (box.width - w) / 2,
          y: box.bottom + (box.height - h) / 2,
          width: w,
          height: h,
        });
        added += 1;
      }
      return added;
    }

    const isPng = args.mime === "image/png";
    const isJpeg = args.mime === "image/jpeg";
    if (!isPng && !isJpeg) throw new Error(`ANNEX_MIME_UNPRINTABLE:${args.titleFa}`);
    let image: PDFImage;
    try {
      image = isPng ? await this.doc.embedPng(args.bytes) : await this.doc.embedJpg(args.bytes);
    } catch {
      throw new Error(`ANNEX_IMAGE_UNREADABLE:${args.titleFa}`);
    }
    const page = this.sectionPage({
      titleFa: args.titleFa,
      ...(args.fileName ? { partFa: args.fileName } : {}),
      referenceCode: args.referenceCode,
      typeFa: args.typeFa,
    });
    const scale = Math.min(box.width / image.width, box.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: box.left + (box.width - w) / 2,
      y: box.bottom + (box.height - h) / 2,
      width: w,
      height: h,
    });
    return 1;
  }

  /**
   * Draw the verification QR at the current cursor. Used by the
   * authenticity page; the signature block draws its own inside the
   * unbreakable block so the two can never separate.
   */
  qrBlock(qr: { payload: string; caption: string }): void {
    // 88pt ≈ 31mm — comfortably scannable, and small enough that the
    // authenticity certificate stays one page.
    const boxSize = 88;
    const captionLines = wrapText(
      qr.caption,
      this.fonts.regular,
      9,
      CONTENT_WIDTH - boxSize - 16
    );
    // The QR is drawn at the cursor, not inside a flowing block: keep the
    // whole square above the content floor (the reserved band, or the
    // admin card's band on the closing page) instead of letting it run
    // into the seal, the hologram or the card. Reserve what the block
    // really needs — the square, the gap above it and one line below —
    // so a page that has room for the block does not break for it.
    const need = Math.max(8 + boxSize + 8, 20 + captionLines.length * 12 + 8);
    this.ensure(need);
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
    for (const line of captionLines) {
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
  /**
   * The parties' uploaded signature scans, drawn in their OWN row of the
   * signature table. A party with no scan keeps its rule and status text.
   */
  signatureImages?: ContractSignatureImage[];
  /**
   * Annex files appended AFTER the contract pages, in registration order.
   * Only printable formats reach here — the caller reports anything else
   * as a print issue before finalisation, so nothing is silently lost.
   */
  annexes?: ContractAnnexInput[];
  /** The admin's ≤100-character message, printed in red on the last
   *  contract page. Omitted ⇒ no strip is printed at all. */
  adminMessage?: ContractAdminMessageInput | null;
  /** The «تأییدیهٔ اصالت» page appended after every annex. */
  authenticity?: AuthenticityInfo | null;
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
    signatureImages = [],
    annexes = [],
    adminMessage = null,
    authenticity = null,
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

  // The parties' uploaded signatures. Each image is embedded ONCE and
  // drawn only in its own role's cell. A file that cannot be decoded is a
  // hard error: shipping a contract whose signature silently vanished is
  // worse than refusing to render.
  const signatureImageMap: Record<string, PDFImage> = {};
  for (const image of signatureImages) {
    try {
      signatureImageMap[image.roleFa] =
        image.mime === "image/png"
          ? await doc.embedPng(image.bytes)
          : await doc.embedJpg(image.bytes);
    } catch {
      throw new Error(`SIGNATURE_IMAGE_UNREADABLE:${image.roleFa}`);
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
  const messageFa = adminMessage?.messageFa?.trim() ?? "";
  // The card band is needed on the document's LAST page. When an
  // authenticity certificate closes the file it is the certificate page
  // that must keep the band free (reserved below); when annexes follow
  // the body it is the last annex page, which reserves the band on its
  // own. Only a bare render leaves the signature block as the last page,
  // and only then must it reserve the card's room.
  const cardOnSignaturePage = Boolean(messageFa) && !authenticity && annexes.length === 0;
  layout.signatureBlock(
    rendered.signatureLines,
    rendered.footerFa,
    {
      payload: verifyUrl,
      caption: `برای بررسی اصالت این سند، کد QR را اسکن کنید یا به نشانی زیر مراجعه کنید:\n${verifyUrl}`,
    },
    signatureMarks,
    signatureImageMap,
    cardOnSignaturePage ? ADMIN_MESSAGE_HEIGHT + 10 : 0
  );

  // Everything up to here is the contract body. Annexed files and the
  // authenticity certificate follow it in a fixed order, so the reading
  // order is always: contract → annexes → certificate.
  const bodyPageCount = doc.getPageCount();

  // No certificate ⇒ the LAST annex page is the closing page, so it must
  // keep the card's band free. Reserve before that annex is laid out; the
  // earlier annex pages take the full content box.
  const cardOnLastAnnex = Boolean(messageFa) && !authenticity && annexes.length > 0;

  for (const [index, annex] of annexes.entries()) {
    if (cardOnLastAnnex && index === annexes.length - 1) {
      layout.reserveBand(ADMIN_MESSAGE_HEIGHT + 10);
    }
    await layout.addAnnexedFile({
      titleFa: annex.titleFa,
      ...(annex.fileName ? { fileName: annex.fileName } : {}),
      mime: annex.mime,
      bytes: annex.bytes,
      referenceCode,
      typeFa: contract.typeFa,
    });
  }

  if (authenticity) {
    // This section closes the document, so it is where the admin message
    // card is printed. Raise the floor FIRST so no row, paragraph or QR
    // can be laid out where the card will sit.
    layout.reserveBand(messageFa ? ADMIN_MESSAGE_HEIGHT + 10 : 0);
    layout.sectionPage({
      titleFa: "تأییدیهٔ اصالت سند",
      partFa: `نسخه ${toPersianDigits(version.versionNumber)}`,
      referenceCode,
      typeFa: contract.typeFa,
    });
    layout.heading("تأییدیهٔ اصالت سند", 13);
    layout.paragraph(
      "این تأییدیه به‌صورت خودکار از دادهٔ ثبت‌شدهٔ همین قرارداد در سامانهٔ لیگالیر ساخته شده است. " +
        "هدف آن، قابل‌ردیابی‌کردن نسخهٔ چاپی است و به معنای تأیید هیچ مرجع بیرونی یا ثبت رسمی نیست.",
      9
    );

    const pathFa = authenticity.reviewedByLegalir
      ? "ارسال برای بررسی لیگالیر — بررسی‌شده"
      : "ثبت نهایی بدون بررسی لیگالیر — بررسی‌نشده";
    layout.table(
      {
        columnsFa: ["موضوع", "مقدار"],
        rowsFa: [
          ["نوع سند", contract.typeFa],
          ["شناسهٔ قرارداد", referenceCode],
          ["نسخه", `${toPersianDigits(version.versionNumber)} — قالب ${version.templateVersion}`],
          ["مسیر ثبت", pathFa],
          [
            "بررسی لیگالیر",
            authenticity.reviewedByLegalir
              ? [
                  "بررسی‌شده و تأییدشده",
                  authenticity.reviewId || null,
                  authenticity.reviewedAt
                    ? formatIsoJalali(authenticity.reviewedAt.slice(0, 10))
                    : null,
                ]
                  .filter(Boolean)
                  .join(" — ")
              : "بررسی‌نشده توسط لیگالیر",
          ],
          ["ثبت‌کننده", authenticity.registeredByLabelFa || "—"],
          [
            "تاریخ ورود به مرحلهٔ امضا",
            authenticity.registeredAt
              ? formatIsoJalali(authenticity.registeredAt.slice(0, 10))
              : "—",
          ],
          ["اثر انگشت محتوا (SHA-256)", version.documentHash],
          [
            "مهر رسمی لیگالیر",
            authenticity.stampApplied
              ? authenticity.stampSha256
                ? `درج شده — ${authenticity.stampSha256}`
                : "درج شده"
              : "درج نشده",
          ],
          ["هولوگرام", authenticity.hologramApplied ? "درج شده" : "درج نشده"],
        ],
      },
      8.5
    );

    layout.heading("وضعیت امضای طرفین", 11);
    layout.table(
      {
        columnsFa: ["نقش", "نام", "وضعیت", "روش", "تاریخ"],
        rowsFa: authenticity.participants.map((p) => [
          p.roleFa,
          p.nameFa || "—",
          p.statusFa,
          p.methodFa || "—",
          p.signedAt ? formatIsoJalali(p.signedAt.slice(0, 10)) : "—",
        ]),
      },
      8.5
    );

    // The QR carries its own caption («… کد QR را اسکن کنید یا به این
    // نشانی مراجعه کنید: <url>»), so a separate sentence repeating the
    // same URL would only push the certificate onto a second page.
    layout.qrBlock({
      payload: verifyUrl,
      caption: `برای بررسی اصالت، کد QR را اسکن کنید یا به این نشانی مراجعه کنید: ${verifyUrl}`,
    });
  }

  // §6 — the admin's message, in red, at the FIXED position just above the
  // reserved footer band of the document's LAST page. Nothing is drawn
  // when no message is set, so no empty space is reserved and no marker
  // appears.
  if (messageFa) layout.adminMessageBlock(messageFa);

  // The REVIEW mark is drawn on EVERY page inside the reserved footer band,
  // on the reading side. It carries the contract's real review fields and
  // the mandatory disclaimer, so it can never read as confirmed without a
  // record. The OFFICIAL seal + hologram then join the same band at the
  // physical bottom-left. An unapproved contract gets neither — only the
  // diagonal draft watermark on every page — so the two can never mix.
  if (stamp?.applied) {
    // A `self_final` document gets the amber unreviewed notice in the
    // SAME slot — never the blue mark it did not earn.
    if (stamp.path === "self_final") layout.selfFinalMarkPages(stamp);
    else layout.reviewMarkPages(stamp);
    if (officialImage) layout.officialMarkPages(officialImage, hologramImage);
  } else {
    layout.draftWatermark();
  }

  // Pages 2+ repeat the identification in a slim running head, drawn in
  // the top margin so it never takes space from the body. Section pages
  // (annexes, certificate) draw their own head instead.
  layout.runningHeads(contract.typeFa, referenceCode, versionLabelFa, bodyPageCount);

  // §2.6 — every page carries a legible paraphe strip, inside the reserved
  // footer band so it can never collide with body text or the page number.
  layout.parapheStrip(rendered.signatureLines.map((line) => line.roleFa));

  // Page numbers on every page, below the content margin.
  layout.pageNumbers();

  return doc.save();
}
