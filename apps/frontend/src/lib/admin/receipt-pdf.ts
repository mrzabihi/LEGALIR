// ============================================================
// LEGALIR — System payment receipt PDF renderer (server-only)
// ============================================================
// Renders the platform's OWN receipt for a confirmed purchase. This is a
// `system_receipt`: the gateway is simulated in this environment, so there is
// no gateway file to attach — the receipt is generated from the real order
// row. Every printed field comes from the passed descriptor; a field that is
// unknown is omitted, never zero-filled or invented.
//
// Persian is laid out right-to-left with a small bidi pass that keeps digit
// runs (amounts, dates, ids) in left-to-right order — a financial document
// must not print a reversed number. Vazirmatn is embedded via fontkit, the
// same font the rest of the product uses.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AdminOrderReceipt } from "@legalir/types";
import { formatIsoJalali } from "@/lib/contracts/dates";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.09, 0.13, 0.2); // matches the brand navy
const MUTED = rgb(0.35, 0.38, 0.44);
const RULE = rgb(0.85, 0.86, 0.89);

// --- Bidi: keep digit/ASCII runs LTR, reverse the RTL run order -------------

const LTR_TOKEN = /^[\d\u06F0-\u06F9\u0660-\u0669A-Za-z][\d\u06F0-\u06F9\u0660-\u0669A-Za-z._/@:\-]*$/;
const TOKEN_SPLIT =
  /[\d\u06F0-\u06F9\u0660-\u0669A-Za-z][\d\u06F0-\u06F9\u0660-\u0669A-Za-z._/@:\-]*|[^\d\u06F0-\u06F9\u0660-\u0669A-Za-z]+/g;

/**
 * Prepare a logical string for a left-to-right pdf-lib draw so that an RTL
 * reader sees it correctly: reverse the token order, reverse characters
 * within Persian tokens, and leave digit/ASCII tokens intact (so a number is
 * printed in its true order).
 */
function bidi(text: string): string {
  const tokens = text.match(TOKEN_SPLIT) ?? [];
  const mapped = tokens.map((t) => (LTR_TOKEN.test(t) ? t : Array.from(t).reverse().join("")));
  return mapped.reverse().join("");
}

/** Format an integer amount with Persian digits and thousands separators. */
function formatAmount(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u066C");
  return grouped.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
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

/** A one-page cursor that flows content down the page. */
class Layout {
  readonly page: PDFPage;
  y = PAGE_HEIGHT - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  /** Title, ruled off from the body. */
  header(title: string, subtitle: string): void {
    this.page.drawText(bidi(title), {
      x: MARGIN,
      y: this.y - 20,
      size: 20,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= 28;
    this.page.drawText(bidi(subtitle), {
      x: MARGIN,
      y: this.y - 13,
      size: 12,
      font: this.fonts.regular,
      color: MUTED,
    });
    this.y -= 20;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: RULE,
    });
    this.y -= 22;
  }

  /**
   * One field row: a right-aligned Persian label and a left-aligned value.
   * Values that are digit/ASCII heavy stay in their true order.
   */
  field(label: string, value: string): void {
    const size = 12;
    const labelVisual = bidi(label);
    const labelW = this.fonts.regular.widthOfTextAtSize(labelVisual, size);
    // Label right-aligned at the right margin.
    this.page.drawText(labelVisual, {
      x: PAGE_WIDTH - MARGIN - labelW,
      y: this.y - size,
      size,
      font: this.fonts.regular,
      color: MUTED,
    });
    // Value left-aligned at the left margin, bold ink.
    this.page.drawText(bidi(value), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= size + 14;
  }

  note(text: string): void {
    const size = 10;
    const lines = this.wrap(bidi(text), size);
    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y - size,
        size,
        font: this.fonts.regular,
        color: MUTED,
      });
      this.y -= size + 5;
    }
  }

  private wrap(text: string, size: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.fonts.regular.widthOfTextAtSize(candidate, size) <= CONTENT_WIDTH) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  spacer(h = 8): void {
    this.y -= h;
  }
}

/**
 * Render the system receipt PDF for a confirmed order. Throws when the font
 * files are missing so the caller can surface a real error rather than a
 * half-drawn document.
 */
export async function renderOrderReceiptPdf(receipt: AdminOrderReceipt): Promise<Uint8Array> {
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
  doc.setTitle(`رسید پرداخت ${receipt.referenceId}`);
  doc.setProducer("LegalIR");
  doc.setCreator("LegalIR");

  const layout = new Layout(doc, fonts);
  layout.header("رسید پرداخت", "سامانهٔ حقوقی لگالیر");

  layout.field("شناسهٔ تراکنش", receipt.transactionId ?? receipt.referenceId);
  layout.field("تاریخ پرداخت", receipt.paidAt ? formatIsoJalali(receipt.paidAt) : "ثبت نشده");
  layout.field("مبلغ (تومان)", formatAmount(receipt.amount));
  layout.field("وضعیت پرداخت", receipt.statusFa);
  if (receipt.serviceFa) layout.field("خدمت/پلن", receipt.serviceFa);
  layout.field(
    "پرداخت‌کننده",
    receipt.payerDisplayName ? receipt.payerDisplayName : "بدون نام"
  );
  layout.field("موبایل پرداخت‌کننده (پوشیده)", receipt.payerMobileMasked);
  layout.field(
    "درگاه پرداخت",
    receipt.gatewaySimulated ? "شبیه‌سازی‌شده (این محیط)" : receipt.gateway
  );
  if (receipt.trackingId) {
    layout.field("کد پیگیری درگاه", receipt.trackingId);
  }

  layout.spacer(6);
  layout.note("این رسید به‌طور خودکار توسط سامانهٔ لگالیر بر پایهٔ اطلاعات ثبت‌شدهٔ سفارش تولید شده است.");
  if (receipt.gatewaySimulated) {
    layout.note(
      "توجه: در این محیط، درگاه پرداخت شبیه‌سازی‌شده است و تراکنش بانکی واقعی انجام نشده است."
    );
  }
  layout.note(`تاریخ تولید رسید: ${formatIsoJalali(receipt.generatedAt)}`);

  return doc.save();
}
