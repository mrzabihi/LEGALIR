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

/**
 * The footer band reserved at the bottom of EVERY page when the official
 * stamp is applied. Contract text never flows into it (the cursor bottoms
 * out above it), so the stamp and its mandatory disclaimer can never
 * overlap body text, signatures or page numbers.
 */
const FOOTER_BAND = 72;
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
    reserveFooter = false
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
      color: rgb(0.1, 0.1, 0.15),
      right: RIGHT,
    });
    this.y -= size + 10;
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

  /** Draw the QR code and the verification caption at the bottom. */
  qrBlock(payload: string, caption: string): void {
    const matrix = qrMatrix(payload);
    const modules = matrix.length;
    const boxSize = 96;
    const moduleSize = boxSize / modules;
    this.ensure(boxSize + 40);

    const originX = MARGIN;
    const originY = this.y - boxSize;
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

    const lines = wrapText(caption, this.fonts.regular, 9, CONTENT_WIDTH - boxSize - 16);
    let ty = this.y - 12;
    for (const line of lines) {
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

    // Vertical centre of the band, nudged up so the disclaimer fits below.
    const cy = MARGIN + FOOTER_BAND / 2 + 4;
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

  const layout = new Layout(doc, fonts, officialImage !== null);

  // --- Header: reference code + version + hash ---
  const snapshot = version.snapshot;
  const rendered = renderContract(
    { ...contract, data: snapshot.data },
    snapshot.parties,
    snapshot.payments
  );

  layout.heading(rendered.titleFa, 16);
  // The approved-by-LEGALIR mark sits at the top, where a reader looks
  // first. An unapproved document gets NO stamp; its watermark is drawn
  // across every page at the end. When the official PNG is drawn, the blue
  // box is suppressed and only the review metadata is printed here.
  if (stamp?.applied) {
    layout.stampBlock(stamp, officialImage === null);
    layout.spacer(6);
  }
  layout.paragraph(`کد قرارداد: ${contract.referenceCode}`);
  layout.paragraph(`نسخه: ${version.versionNumber} — نسخه قالب: ${version.templateVersion}`);
  layout.paragraph(`تاریخ صدور: ${formatIsoJalali(version.createdAt.slice(0, 10))}`);
  layout.paragraph(`اثر انگشت سند (SHA-256): ${version.documentHash}`);
  layout.spacer(6);

  // --- Preamble ---
  layout.paragraph(rendered.preambleFa);
  layout.spacer(4);

  // --- Clauses ---
  for (const clause of rendered.clauses) {
    layout.heading(clause.headingFa, 12);
    const blocks: RenderedBlock[] =
      clause.blocks ?? clause.paragraphs.map((textFa) => ({ kind: "paragraph", textFa }));
    for (const block of blocks) {
      if (block.kind === "paragraph") layout.paragraph(block.textFa);
      else layout.table(block.table);
    }
    layout.spacer(4);
  }

  // --- Signatures ---
  layout.spacer(8);
  layout.heading("امضای طرفین", 13);
  for (const line of rendered.signatureLines) {
    layout.paragraph(`${line.roleFa}: ${line.nameFa} — کد ملی: ${line.nationalId}`);
  }

  // --- Footer note ---
  layout.spacer(6);
  layout.paragraph(rendered.footerFa, 9);

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

  // --- QR + verification link ---
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/contracts/verify/${contract.publicVerificationId}`;
  layout.qrBlock(
    verifyUrl,
    `برای بررسی اصالت این سند، کد QR را اسکن کنید یا به نشانی زیر مراجعه کنید:\n${verifyUrl}`
  );

  // The official stamp, once authorised, is drawn on EVERY page inside the
  // reserved footer band. An unapproved contract gets the diagonal draft
  // watermark on every page instead, so a printed copy can never pass for
  // an approved one. The two are mutually exclusive.
  if (officialImage) {
    layout.officialMarkPages(officialImage, hologramImage, CONTRACT_REVIEW_STAMP_DISCLAIMER_FA);
  } else if (!stamp?.applied) {
    layout.draftWatermark();
  }

  // Page numbers on every page, below the content margin.
  layout.pageNumbers();

  return doc.save();
}
