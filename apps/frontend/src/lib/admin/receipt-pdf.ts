// ============================================================
// LEGALIR — Order invoice / payment receipt PDF (server-only)
// ============================================================
// Renders the platform's OWN document for a confirmed purchase. In this
// environment the gateway is simulated, so there is no gateway file to attach:
// the document is generated from the real order row. Every printed field comes
// from the passed descriptor; a field that is unknown is OMITTED, never
// zero-filled or invented (`invoice: null` is a real state — a legacy
// subscription never recorded the itemization).
//
// The document is SECTIONED rather than a flat list, because an invoice has to
// answer four different questions: what was bought, who bought it, what each
// amount line is, and how it was paid.
//
// The official LEGALIR seal and its print-only hologram are drawn on every
// page. This is NOT the contract-review stamp: that one is bound to a
// Super-Admin's SHA-256 approval of a specific document, and it is never drawn
// without one. Here the platform is the author of its own financial record, so
// the seal certifies ISSUANCE — and the caption beside it says exactly that,
// so a printed invoice can never be mistaken for a reviewed contract.
//
// Persian is laid out right-to-left by the shared RTL shaping module
// (`@/lib/pdf/rtl`). Vazirmatn is embedded via fontkit.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { AdminOrderReceipt } from "@legalir/types";
import { formatIsoJalali } from "@/lib/contracts/dates";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";
import {
  HOLOGRAM_PRINT_INK,
  loadDocumentLogo,
  loadHologram,
  loadReviewStamp,
} from "@/lib/contracts/stamp-asset";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;

/** Content stops here so the seal band below is never written over. */
const FOOTER_TOP = 184;

/** One body line: the type size and the leading below it. */
const ROW_SIZE = 10.5;
const ROW_LEAD = 9.5;

const INK = rgb(0.09, 0.13, 0.2); // matches the brand navy
const MUTED = rgb(0.35, 0.38, 0.44);
const RULE = rgb(0.85, 0.86, 0.89);
const BAND = rgb(0.96, 0.965, 0.972);
const BAND_INK = rgb(0.13, 0.17, 0.24);

/** The seal, at a print-legible size in the reserved band. */
const SEAL_DRAW_HEIGHT = 96;
const HOLOGRAM_DRAW_HEIGHT = 76;
const STAMP_ANGLE = -8;
const STAMP_BASE_Y = 44;

/** Format an integer amount with Persian digits and thousands separators. */
function formatAmount(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u066C");
  return grouped.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

/** Format a percentage the same way (Persian digits, no forced decimals). */
function formatPercent(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return text.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!).replace(".", "\u066B");
}

/**
 * The document has date-only semantics, but the order stores full ISO
 * timestamps. `formatIsoJalali` accepts `YYYY-MM-DD` only, so trim the time
 * part before formatting — otherwise a real timestamp renders as "—".
 */
function isoDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1]! : null;
}

/** Locate a Vazirmatn TTF, searching up from the app directory. */
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

/** A flowing cursor that carries content down the page and adds pages as needed. */
class Layout {
  page: PDFPage;
  y = PAGE_HEIGHT - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  private ensure(space: number): void {
    if (this.y - space < FOOTER_TOP) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  /** Letterhead mark + document title, ruled off from the body. */
  header(title: string, subtitle: string, logo: PDFImage | null): void {
    if (logo) {
      const h = 34;
      const w = (logo.width / logo.height) * h;
      this.page.drawImage(logo, { x: MARGIN, y: this.y - h, width: w, height: h });
    }
    drawRtl(this.page, this.fonts.bold, title, {
      y: this.y - 22,
      size: 19,
      color: INK,
      right: RIGHT,
    });
    this.y -= 25;
    drawRtl(this.page, this.fonts.regular, subtitle, {
      y: this.y - 11,
      size: 10.5,
      color: MUTED,
      right: RIGHT,
    });
    this.y -= 18;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: RIGHT, y: this.y },
      thickness: 1,
      color: RULE,
    });
    this.y -= 15;
  }

  /**
   * A titled band that starts a section. The reserve covers the band plus two
   * body rows, so a heading is never orphaned alone at the bottom of a page.
   */
  section(title: string): void {
    const h = 20;
    this.ensure(h + 6 + 2 * (ROW_SIZE + ROW_LEAD));
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - h,
      width: CONTENT_WIDTH,
      height: h,
      color: BAND,
    });
    drawRtl(this.page, this.fonts.bold, title, {
      y: this.y - h + 5.5,
      size: 10.5,
      color: BAND_INK,
      right: RIGHT - 8,
    });
    this.y -= h + 6;
  }

  /**
   * One label/value row. A value too wide for the remaining space wraps onto
   * its own line, right-aligned, rather than colliding with the label.
   */
  row(label: string, value: string): void {
    const size = ROW_SIZE;
    const GAP = 14;
    this.ensure(size + ROW_LEAD);
    drawRtl(this.page, this.fonts.regular, label, {
      y: this.y - size,
      size,
      color: MUTED,
      right: RIGHT,
    });
    const labelW = measureRtl(this.fonts.regular, label, size);
    const valueW = measureRtl(this.fonts.bold, value, size);
    if (labelW + GAP + valueW <= CONTENT_WIDTH) {
      drawRtl(this.page, this.fonts.bold, value, {
        y: this.y - size,
        size,
        color: INK,
        right: RIGHT - labelW - GAP,
      });
      this.y -= size + ROW_LEAD;
      return;
    }
    this.y -= size + 4;
    drawRtl(this.page, this.fonts.bold, value, { y: this.y - size, size, color: INK, right: RIGHT });
    this.y -= size + 7;
  }

  /**
   * An amount line: the description on the right, the figure beside the LEFT
   * margin — how an invoice column reads, and it keeps the numbers from
   * drifting with the label length.
   */
  amount(label: string, value: string, opts: { strong?: boolean } = {}): void {
    const size = ROW_SIZE;
    this.ensure(size + ROW_LEAD);
    const font = opts.strong ? this.fonts.bold : this.fonts.regular;
    if (opts.strong) {
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - size - 6,
        width: CONTENT_WIDTH,
        height: size + 9,
        color: BAND,
      });
    }
    drawRtl(this.page, font, label, {
      y: this.y - size,
      size,
      color: opts.strong ? INK : MUTED,
      right: RIGHT - 4,
    });
    drawRtl(this.page, this.fonts.bold, value, {
      y: this.y - size,
      size: size + (opts.strong ? 1 : 0),
      color: INK,
      right: MARGIN + measureRtl(this.fonts.bold, value, size) + 4,
    });
    this.y -= size + ROW_LEAD;
  }

  /**
   * One or more wrapped, right-aligned paragraphs of muted note text. The whole
   * block is measured first and moved to a fresh page when it does not fit, so
   * the closing lines of the invoice never stand alone on an otherwise blank
   * sheet.
   */
  note(text: string | string[], size = 9): void {
    const paragraphs = Array.isArray(text) ? text : [text];
    const lines = paragraphs.flatMap((p) => this.wrap(p, this.fonts.regular, size));
    const lineHeight = size + 6;
    this.ensure(lines.length * lineHeight);
    for (const line of lines) {
      drawRtl(this.page, this.fonts.regular, line, {
        y: this.y - size,
        size,
        color: MUTED,
        right: RIGHT,
      });
      this.y -= lineHeight;
    }
  }

  spacer(h = 6): void {
    this.y -= h;
  }

  private wrap(text: string, font: PDFFont, size: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureRtl(font, candidate, size) <= CONTENT_WIDTH) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }
}

/**
 * Draw the official seal + print-only hologram on EVERY page, in the band
 * reserved below the content. A missing asset is skipped — the invoice is
 * still issued, and the caption says no seal was drawn rather than pretending
 * one exists.
 */
function drawStampBand(
  doc: PDFDocument,
  fonts: Fonts,
  seal: PDFImage | null,
  hologram: PDFImage | null
): void {
  const theta = (STAMP_ANGLE * Math.PI) / 180;
  const pages = doc.getPages();

  pages.forEach((page, index) => {
    // A hairline above the band separates the record from the mark. Both
    // caption lines sit ABOVE it, so the statement about the mark never reads
    // as part of the images below.
    page.drawLine({
      start: { x: MARGIN, y: STAMP_BASE_Y + 106 },
      end: { x: RIGHT, y: STAMP_BASE_Y + 106 },
      thickness: 0.6,
      color: RULE,
    });

    // Physical bottom-left: «hologram · seal», the same order the contract
    // sheet uses, so the two documents carry the mark in the same corner.
    let x = MARGIN;
    if (hologram) {
      const hh = HOLOGRAM_DRAW_HEIGHT;
      const hw = (hologram.width / hologram.height) * hh;
      page.drawImage(hologram, { x, y: STAMP_BASE_Y, width: hw, height: hh });

      // The security ink INSIDE the hologram — print/PDF only. Its position
      // mirrors the source artwork (49.3% / 57% of the label, centred).
      const inkSize = 4.2 * (hh / 46);
      const inkTop = STAMP_BASE_Y + hh;
      const brand = HOLOGRAM_PRINT_INK.brand;
      drawRtl(page, fonts.bold, brand, {
        y: inkTop - hh * 0.493 - inkSize,
        size: inkSize,
        color: rgb(0, 0, 0),
        x: x + hw / 2 - measureRtl(fonts.bold, brand, inkSize) / 2,
      });
      const serial = HOLOGRAM_PRINT_INK.serial;
      drawRtl(page, fonts.bold, serial, {
        y: inkTop - hh * 0.57 - inkSize,
        size: inkSize,
        color: rgb(0, 0, 0),
        x: x + hw / 2 - measureRtl(fonts.bold, serial, inkSize) / 2,
      });
      x += hw + 14;
    }

    if (seal) {
      const sh = SEAL_DRAW_HEIGHT;
      const sw = (seal.width / seal.height) * sh;
      // pdf-lib rotates around the anchor, so offset it to keep the image's
      // visual centre where the layout puts it — a hand-applied tilt.
      const swc = sw / 2;
      const shc = sh / 2;
      page.drawImage(seal, {
        x: x + swc * Math.cos(theta) + shc * Math.sin(theta),
        y: STAMP_BASE_Y + shc - swc * Math.sin(theta) - shc * Math.cos(theta),
        width: sw,
        height: sh,
        rotate: degrees(STAMP_ANGLE),
        opacity: 0.92,
      });
    }

    // What the mark above certifies — stated, never implied.
    const captionY = STAMP_BASE_Y + 134;
    const caption = seal
      ? "مهر رسمی سامانهٔ لگالیر، تأییدِ صدور این سند"
      : "این نسخه بدون مهر رسمی صادر شده است";
    drawRtl(page, fonts.bold, caption, {
      y: captionY,
      size: 8.5,
      color: seal ? INK : MUTED,
      right: RIGHT,
    });
    drawRtl(page, fonts.regular, "این سند صورتحساب مالی است و تأییدیهٔ بررسی حقوقی محسوب نمی‌شود.", {
      y: captionY - 14,
      size: 7.5,
      color: MUTED,
      right: RIGHT,
    });

    const pageNo = `صفحهٔ ${formatAmount(index + 1)} از ${formatAmount(pages.length)}`;
    drawRtl(page, fonts.regular, pageNo, {
      y: STAMP_BASE_Y + 2,
      size: 7.5,
      color: MUTED,
      right: RIGHT,
    });
  });
}

/**
 * Render the invoice PDF for a confirmed order. Throws when the font files
 * are missing so the caller can surface a real error rather than a half-drawn
 * document.
 */
export async function renderOrderReceiptPdf(receipt: AdminOrderReceipt): Promise<Uint8Array> {
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
  doc.setTitle(`صورتحساب ${receipt.referenceId}`);
  doc.setProducer("LegalIR");
  doc.setCreator("LegalIR");

  const logoBytes = loadDocumentLogo();
  const sealAsset = loadReviewStamp();
  const hologramAsset = loadHologram();

  let logo: PDFImage | null = null;
  if (logoBytes) {
    try {
      logo = await doc.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }
  let seal: PDFImage | null = null;
  if (sealAsset) {
    try {
      seal = await doc.embedPng(sealAsset.bytes);
    } catch {
      seal = null;
    }
  }
  let hologram: PDFImage | null = null;
  if (hologramAsset) {
    try {
      hologram = await doc.embedPng(hologramAsset.bytes);
    } catch {
      hologram = null;
    }
  }

  const layout = new Layout(doc, fonts);
  layout.header("صورتحساب / رسید پرداخت", "سامانهٔ حقوقی لگالیر", logo);

  // --- what was bought ---------------------------------------------------
  layout.section("مشخصات سفارش");
  layout.row("شناسهٔ سفارش", receipt.referenceId);
  layout.row("خدمت / پلن", receipt.serviceFa ?? "ثبت نشده");
  if (receipt.invoice) {
    layout.row("مدت", `${formatAmount(receipt.invoice.durationDays)} روز`);
  }
  layout.row("تاریخ خرید", formatIsoJalali(isoDateOnly(receipt.paidAt)));

  // --- who bought it -----------------------------------------------------
  layout.section("مشخصات خریدار");
  layout.row("خریدار", receipt.payerDisplayName ?? "بدون نام");
  layout.row("موبایل (پوشیده)", receipt.payerMobileMasked);

  // --- the amount lines --------------------------------------------------
  layout.section("اقلام و مبالغ");
  const inv = receipt.invoice;
  if (inv) {
    layout.amount("مبلغ فهرست", formatAmount(inv.listPrice));
    if (inv.discountAmount > 0) {
      const label = inv.couponCode
        ? `تخفیف (کد ${inv.couponCode}${
            inv.discountPercent > 0 ? `، ${formatPercent(inv.discountPercent)}٪` : ""
          })`
        : "تخفیف";
      layout.amount(label, `− ${formatAmount(inv.discountAmount)}`);
    }
    if (inv.taxAmount > 0) {
      layout.amount(
        `مالیات بر ارزش افزوده (${formatPercent(inv.taxRatePercent)}٪)`,
        formatAmount(inv.taxAmount)
      );
    }
    if (inv.otherAmount !== 0) {
      layout.amount("سایر اقلام", formatAmount(inv.otherAmount));
    }
    layout.amount("مبلغ قابل پرداخت", formatAmount(inv.finalAmount), { strong: true });
    if (inv.collectedAmount !== inv.finalAmount) {
      layout.amount("مبلغ وصول‌شده", formatAmount(inv.collectedAmount));
    }
  } else {
    // A legacy subscription recorded only the settled amount. Say so instead
    // of printing invented zero lines for discount/tax.
    layout.amount("مبلغ فروش", formatAmount(receipt.amount), { strong: true });
    layout.note("این سفارش از سابقهٔ اشتراک قدیمی صادر شده است و ریز اقلام در آن ثبت نشده است.");
  }
  if (receipt.refundedAmount > 0) {
    layout.amount("بازگشتی", `− ${formatAmount(receipt.refundedAmount)}`);
  }
  layout.amount("خالص پرداختی", formatAmount(receipt.amount - receipt.refundedAmount), {
    strong: true,
  });
  layout.row("واحد پول", receipt.currency === "IRT" ? "تومان" : receipt.currency);

  // --- how it was paid ---------------------------------------------------
  layout.section("اطلاعات پرداخت");
  layout.row("شناسهٔ تراکنش", receipt.transactionId ?? receipt.referenceId);
  layout.row("وضعیت پرداخت", receipt.statusFa);
  layout.row(
    "درگاه پرداخت",
    receipt.gatewaySimulated ? "شبیه‌سازی‌شده (این محیط)" : receipt.gateway
  );
  if (receipt.trackingId) layout.row("کد پیگیری درگاه", receipt.trackingId);

  // --- notes -------------------------------------------------------------
  layout.spacer(4);
  layout.section("یادداشت");
  const notes = [
    "این صورتحساب به‌طور خودکار توسط سامانهٔ لگالیر بر پایهٔ اطلاعات ثبت‌شدهٔ سفارش تولید شده است.",
  ];
  if (receipt.gatewaySimulated) {
    notes.push("توجه: در این محیط، درگاه پرداخت شبیه‌سازی‌شده است و تراکنش بانکی واقعی انجام نشده است.");
  }
  if (sealAsset) {
    notes.push(`شناسهٔ اثر انگشت مهر: ${sealAsset.sha256}`);
  }
  notes.push(`تاریخ تولید سند: ${formatIsoJalali(isoDateOnly(receipt.generatedAt))}`);
  layout.note(notes);

  drawStampBand(doc, fonts, seal, hologram);
  return doc.save();
}
