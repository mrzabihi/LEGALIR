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
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { PropertyContractVersion, PropertyContract } from "@legalir/types";
import { renderContract } from "./template";
import { formatIsoJalali } from "./dates";
import { qrMatrix } from "./qr";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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

/** Reverse a string for RTL rendering (pdf-lib draws LTR). */
function rtl(text: string): string {
  return Array.from(text).reverse().join("");
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
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
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
    this.page.drawText(rtl(text), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: rgb(0.1, 0.1, 0.15),
    });
    this.y -= size + 10;
  }

  paragraph(text: string, size = 10.5): void {
    const lines = wrapText(text, this.fonts.regular, size, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensure(size + 6);
      this.page.drawText(rtl(line), {
        x: MARGIN,
        y: this.y - size,
        size,
        font: this.fonts.regular,
        color: rgb(0.15, 0.15, 0.2),
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

    const textX = originX + boxSize + 16;
    const lines = wrapText(caption, this.fonts.regular, 9, CONTENT_WIDTH - boxSize - 16);
    let ty = this.y - 12;
    for (const line of lines) {
      this.page.drawText(rtl(line), {
        x: textX,
        y: ty,
        size: 9,
        font: this.fonts.regular,
        color: rgb(0.25, 0.25, 0.3),
      });
      ty -= 12;
    }
    this.y = originY - 16;
  }
}

export interface RenderPdfParams {
  contract: PropertyContract;
  version: PropertyContractVersion;
  /** Absolute base URL used to build the verification link. */
  baseUrl: string;
}

/**
 * Render the immutable PDF for a finalized contract version. The
 * content comes from `version.snapshot`, so the PDF always matches
 * the hash recorded on the version.
 */
export async function renderContractPdf(params: RenderPdfParams): Promise<Uint8Array> {
  const { contract, version, baseUrl } = params;

  const regularPath = findFontPath("Vazirmatn-Regular.ttf");
  const boldPath = findFontPath("Vazirmatn-Bold.ttf");
  if (!regularPath || !boldPath) {
    throw new Error("Vazirmatn font files are missing");
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
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

  // --- QR + verification link ---
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/contracts/verify/${contract.publicVerificationId}`;
  layout.qrBlock(
    verifyUrl,
    `برای بررسی اصالت این سند، کد QR را اسکن کنید یا به نشانی زیر مراجعه کنید:\n${verifyUrl}`
  );

  return doc.save();
}
