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
// Persian text is shaped with the Vazirmatn font (embedded via
// fontkit) and laid out right-to-left.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import type { PropertyContractVersion, PropertyContract } from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_RGB,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";
import { renderContract } from "./template";
import { buildLegalBasisReport, legalBasisReportLines } from "./legal-basis";
import { formatIsoJalali } from "./dates";
import { qrMatrix } from "./qr";

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
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;

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

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensure(space: number): void {
    if (this.y - space < MARGIN) {
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
   * exists — the caller decides that, not this method.
   */
  stampBlock(info: ReviewStampInfo): void {
    const [r, g, b] = CONTRACT_REVIEW_STAMP_RGB;
    const blue = rgb(r / 255, g / 255, b / 255);
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

    const meta: string[] = [];
    if (info.reviewedAt) meta.push(`تاریخ بررسی: ${formatIsoJalali(info.reviewedAt.slice(0, 10))}`);
    if (info.reviewingOfficeFa) meta.push(`واحد بررسی: ${info.reviewingOfficeFa}`);
    if (info.reviewId) meta.push(`شناسهٔ بررسی: ${info.reviewId}`);
    if (info.reviewerInitials) meta.push(`بررسی‌کننده: ${info.reviewerInitials}`);
    if (meta.length > 0) this.paragraph(meta.join(" — "), 9);
    this.paragraph(CONTRACT_REVIEW_STAMP_DISCLAIMER_FA, 8.5);
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

  const layout = new Layout(doc, fonts);

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
  // across every page at the end.
  if (stamp?.applied) {
    layout.stampBlock(stamp);
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
    for (const paragraph of clause.paragraphs) {
      layout.paragraph(paragraph);
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

  // An unapproved contract is watermarked on every page so a printed
  // copy can never pass for an approved one.
  if (!stamp?.applied) {
    layout.draftWatermark();
  }

  return doc.save();
}
