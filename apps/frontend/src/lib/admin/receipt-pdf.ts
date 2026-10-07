// ============================================================
// LEGALIR — System payment receipt PDF renderer (server-only)
// ============================================================
// Renders the platform's OWN receipt for a confirmed purchase. This is a
// `system_receipt`: the gateway is simulated in this environment, so there is
// no gateway file to attach — the receipt is generated from the real order
// row. Every printed field comes from the passed descriptor; a field that is
// unknown is omitted, never zero-filled or invented.
//
// Persian is laid out right-to-left by the shared RTL shaping module
// (`@/lib/pdf/rtl`): the Unicode Bidirectional Algorithm splits each line into
// directional runs and forces fontkit's direction, so letters connect, numbers
// (`۳٬۵۰۰٬۰۰۰`, dates, masked phone) keep their true order and Latin ids are
// not scrambled. Vazirmatn is embedded via fontkit, the font the product uses.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AdminOrderReceipt } from "@legalir/types";
import { formatIsoJalali } from "@/lib/contracts/dates";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;

const INK = rgb(0.09, 0.13, 0.2); // matches the brand navy
const MUTED = rgb(0.35, 0.38, 0.44);
const RULE = rgb(0.85, 0.86, 0.89);

/** Format an integer amount with Persian digits and thousands separators. */
function formatAmount(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u066C");
  return grouped.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

/**
 * The receipt has date-only semantics, but the order stores full ISO
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

/** A one-page cursor that flows content down the page, adding pages as needed. */
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
    if (this.y - space < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  /** Title, ruled off from the body. */
  header(title: string, subtitle: string): void {
    drawRtl(this.page, this.fonts.bold, title, {
      y: this.y - 20,
      size: 20,
      color: INK,
      right: RIGHT,
    });
    this.y -= 28;
    drawRtl(this.page, this.fonts.regular, subtitle, {
      y: this.y - 13,
      size: 12,
      color: MUTED,
      right: RIGHT,
    });
    this.y -= 20;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: RIGHT, y: this.y },
      thickness: 1,
      color: RULE,
    });
    this.y -= 24;
  }

  /**
   * One field row: a right-aligned Persian label and its value placed to its
   * left. A value too wide for the remaining space wraps onto its own line,
   * right-aligned, rather than colliding with the label.
   */
  field(label: string, value: string): void {
    const size = 12;
    const GAP = 14;
    this.ensure(size + 16);
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
      this.y -= size + 16;
      return;
    }
    // Too wide to sit beside the label — put the value on its own line below.
    this.y -= size + 8;
    drawRtl(this.page, this.fonts.bold, value, { y: this.y - size, size, color: INK, right: RIGHT });
    this.y -= size + 12;
  }

  /** A wrapped, right-aligned paragraph of muted note text. */
  note(text: string, size = 10): void {
    for (const line of this.wrap(text, this.fonts.regular, size)) {
      this.ensure(size + 6);
      drawRtl(this.page, this.fonts.regular, line, {
        y: this.y - size,
        size,
        color: MUTED,
        right: RIGHT,
      });
      this.y -= size + 6;
    }
  }

  spacer(h = 8): void {
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
  doc.registerFontkit(orientedFontkit);
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
  layout.field("تاریخ پرداخت", formatIsoJalali(isoDateOnly(receipt.paidAt)));
  layout.field("مبلغ (تومان)", formatAmount(receipt.amount));
  layout.field("وضعیت پرداخت", receipt.statusFa);
  if (receipt.serviceFa) layout.field("خدمت/پلن", receipt.serviceFa);
  layout.field("پرداخت‌کننده", receipt.payerDisplayName ? receipt.payerDisplayName : "بدون نام");
  layout.field("موبایل پرداخت‌کننده (پوشیده)", receipt.payerMobileMasked);
  layout.field(
    "درگاه پرداخت",
    receipt.gatewaySimulated ? "شبیه‌سازی‌شده (این محیط)" : receipt.gateway
  );
  if (receipt.trackingId) {
    layout.field("کد پیگیری درگاه", receipt.trackingId);
  }

  layout.spacer(8);
  layout.note("این رسید به‌طور خودکار توسط سامانهٔ لگالیر بر پایهٔ اطلاعات ثبت‌شدهٔ سفارش تولید شده است.");
  if (receipt.gatewaySimulated) {
    layout.note(
      "توجه: در این محیط، درگاه پرداخت شبیه‌سازی‌شده است و تراکنش بانکی واقعی انجام نشده است."
    );
  }
  layout.note(`تاریخ تولید رسید: ${formatIsoJalali(isoDateOnly(receipt.generatedAt))}`);

  return doc.save();
}
