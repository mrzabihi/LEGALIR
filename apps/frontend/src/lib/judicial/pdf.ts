// ============================================================
// LEGALIR — Judicial final-document renderer (server-only)
// ============================================================
// Renders the ISSUED artifact for one approved judicial request. This
// module is deliberately the last step of the pipeline and owns no
// decision of its own:
//
//   • the caller only invokes it after an admin approval that is bound
//     to the exact submitted version hash (see `finalize.ts`);
//   • `reviewEvents` arrives ALREADY filtered for owner visibility, so an
//     internal operator note can never leak into the printed PDF;
//   • the official LEGALIR seal and the print-only hologram are loaded
//     from the SAME private masters the contract PDF uses — never a drawn
//     substitute. A missing master degrades the page to the unapproved
//     watermark instead of fabricating a mark.
//
// The sheet mirrors the contract sheet: letterhead + identity group at the
// top-left, title centred beneath it, a slim running head on pages 2+,
// «صفحه N از M» on every page, and a reserved footer band that holds the
// seal, the hologram and the mandatory disclaimer without ever touching
// body text.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type {
  JudicialRequestStatus,
  JudicialReviewEvent,
  JudicialReviewEventKind,
  JudicialServiceId,
  JudicialStatusEvent,
} from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  JUDICIAL_REQUEST_STATUS_FA,
} from "@legalir/types";
import { drawRtl, measureRtl, orientedFontkit } from "@/lib/pdf/rtl";
import {
  HOLOGRAM_PRINT_INK,
  loadDocumentLogo,
  loadHologram,
  loadReviewStamp,
} from "@/lib/contracts/stamp-asset";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { toPersianDigits } from "@/lib/persian-utils";

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
const BODY_INK = rgb(0.15, 0.15, 0.2);

/** Letterhead logo height, matching the contract sheet (~32pt). */
const LETTERHEAD_LOGO_HEIGHT = 32;

/**
 * The footer band reserved on EVERY page. Body text bottoms out above it,
 * so the seal/hologram and the disclaimer can never overlap text or the
 * page number.
 */
const FOOTER_BAND = 104;
/** Height of the drawn seal/hologram, in points. */
const STAMP_DRAW_HEIGHT = 46;
/** The slight angle of the seal — a hand-applied look, never a straight box. */
const STAMP_ANGLE = -8;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

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

/**
 * Wrap `text` to `maxWidth`. Explicit newlines start a new line so a
 * user-authored draft keeps its paragraphs verbatim.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureRtl(font, candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        out.push(current);
        current = word;
      }
    }
    if (current) out.push(current);
  }
  return out.length > 0 ? out : [""];
}

/** A cursor that flows text down the page, adding pages as needed. */
class Layout {
  page: PDFPage;
  y: number;
  private readonly bottom: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts
  ) {
    // The footer band is always reserved: an issued artifact always has a
    // seal on every page, so body text must never flow into that space.
    this.bottom = MARGIN + FOOTER_BAND;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensure(space: number): void {
    if (this.y - space < this.bottom) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  spacer(height = 10): void {
    this.y -= height;
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
   * The cover letterhead: the LEGALIR mark and the identifying group at the
   * physical TOP-LEFT; the document title on its own centred line BELOW
   * them, so mark, metadata and title can never overlap.
   */
  letterhead(args: {
    logo: PDFImage | null;
    titleFa: string;
    serviceFa: string;
    serialFa: string;
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

    const meta = [
      { text: args.serviceFa, size: 11, bold: true, accent: true },
      { text: `شمارهٔ سند: ${args.serialFa}`, size: 9, bold: false, accent: false },
      { text: `تاریخ صدور: ${args.issuedOnFa}`, size: 9, bold: false, accent: false },
      { text: args.versionLabelFa, size: 9, bold: false, accent: false },
      { text: `SHA-256: ${args.documentHash}`, size: 7, bold: false, accent: false },
    ];
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

  /** A slim identity head on every page AFTER the first. */
  runningHeads(serviceFa: string, serialFa: string, versionLabelFa: string): void {
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
      drawRtl(page, this.fonts.bold, serviceFa, {
        y: ruleY + 5,
        size,
        color: BRAND_ACCENT,
        right: RIGHT,
      });
      drawRtl(page, this.fonts.regular, serialFa, {
        y: ruleY + 5,
        size,
        color: MUTED_INK,
        x: MARGIN,
      });
      drawRtl(page, this.fonts.regular, versionLabelFa, {
        y: ruleY + 5,
        size,
        color: MUTED_INK,
        right: RIGHT - measureRtl(this.fonts.bold, serviceFa, size) - 14,
      });
    }
  }

  paragraph(text: string, size = 10.5): void {
    const lines = wrapText(text, this.fonts.regular, size, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensure(size + 6);
      if (line !== "") {
        drawRtl(this.page, this.fonts.regular, line, {
          y: this.y - size,
          size,
          color: BODY_INK,
          right: RIGHT,
        });
      }
      this.y -= size + 5;
    }
    this.y -= 4;
  }

  /**
   * A label/value table with the label right-aligned (RTL reading order)
   * and the value wrapped in the remaining width. Used for the recorded
   * questionnaire answers, so the issued artifact carries the information
   * the document was built from.
   */
  keyValues(rows: readonly { labelFa: string; valueFa: string }[], size = 10): void {
    if (rows.length === 0) return;
    const labelWidth = Math.max(
      90,
      ...rows.map((r) => measureRtl(this.fonts.bold, r.labelFa, size))
    );
    const gap = 14;
    const valueWidth = Math.max(80, CONTENT_WIDTH - labelWidth - gap);
    const valueRight = RIGHT - labelWidth - gap;

    for (const row of rows) {
      const lines = wrapText(row.valueFa || "—", this.fonts.regular, size, valueWidth);
      const blockHeight = Math.max(size, lines.length * (size + 5)) + 6;
      this.ensure(blockHeight);

      drawRtl(this.page, this.fonts.bold, row.labelFa, {
        y: this.y - size,
        size,
        color: MUTED_INK,
        right: RIGHT,
      });
      let valueY = this.y;
      for (const line of lines) {
        drawRtl(this.page, this.fonts.regular, line, {
          y: valueY - size,
          size,
          color: BODY_INK,
          right: valueRight,
        });
        valueY -= size + 5;
      }
      this.y = valueY - 2;
    }
    this.y -= 4;
  }

  /**
   * Draw the OFFICIAL LEGALIR seal and the print-only hologram inside the
   * reserved footer band on EVERY page. Geometry is byte-identical to the
   * contract renderer, so the same approval produces the same mark on both
   * artifacts. Only ever called when the caller has confirmed approval.
   */
  officialMarkPages(seal: PDFImage, hologram: PDFImage | null, disclaimerFa: string): void {
    const sealHeight = STAMP_DRAW_HEIGHT;
    const sealWidth = (seal.width / seal.height) * sealHeight;
    const gap = 18;
    const holoHeight = STAMP_DRAW_HEIGHT;
    const holoWidth = hologram ? (hologram.width / hologram.height) * holoHeight : 0;
    const totalWidth = sealWidth + (hologram ? gap + holoWidth : 0);

    const cy = MARGIN + 34;
    const left = PAGE_WIDTH / 2 - totalWidth / 2;
    const theta = (STAMP_ANGLE * Math.PI) / 180;

    for (const page of this.doc.getPages()) {
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
        page.drawImage(hologram, {
          x: hx,
          y: cy - holoHeight / 2,
          width: holoWidth,
          height: holoHeight,
        });

        // The print-only security ink, positioned as in the source asset.
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
   * The closing integrity block. Judicial artifacts have NO public
   * verification page, so this prints the identity a reader would quote to
   * the Ligalir office — the unique serial and the exact content hash — and
   * says so plainly. It deliberately draws NO QR code: a code that resolved
   * to nothing would imply a verification service that does not exist.
   */
  integrityBlock(lines: readonly string[]): void {
    if (lines.length === 0) return;
    const size = 8.5;
    const wrapped = lines.flatMap((line) => wrapText(line, this.fonts.regular, size, CONTENT_WIDTH));
    const blockHeight = wrapped.length * (size + 4) + 22;
    this.ensure(blockHeight);

    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 6 },
      end: { x: RIGHT, y: this.y - 6 },
      thickness: 0.5,
      color: HAIRLINE,
    });
    this.y -= 16;
    for (const line of wrapped) {
      drawRtl(this.page, this.fonts.regular, line, {
        y: this.y - size,
        size,
        color: MUTED_INK,
        right: RIGHT,
      });
      this.y -= size + 4;
    }
    this.y -= 6;
  }

  /**
   * «صفحه N از M» at the bottom of every page — below the footer band, so a
   * page number can never be covered by the seal.
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
   * The faint diagonal «پیش‌نویس ـ تأییدنشده» watermark. Only reached when a
   * caller explicitly renders an unapproved artifact — the issuance path
   * never does — so a printed draft can never be mistaken for a final one.
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

export interface JudicialPdfParams {
  /** The service title, e.g. «تنظیم دادخواست حقوقی». */
  serviceFa: string;
  /** The document title printed under the letterhead. */
  titleFa: string;
  /** The allocated unique serial, e.g. «LGR-JD-1405-000123». */
  serialFa: string;
  versionNumber: number;
  /** ISO timestamp of issuance. */
  issuedAt: string;
  /** SHA-256 of the approved text. */
  documentHash: string;
  /** The approved draft text, verbatim. */
  bodyText: string;
  /** The recorded questionnaire answers, as label/value pairs. */
  answers: readonly { labelFa: string; valueFa: string }[];
  /**
   * Owner-visible review history. The caller MUST pass an already-filtered
   * list (`ownerReviewEvents`) — internal operator notes never reach print.
   */
  reviewEvents: readonly JudicialReviewEvent[];
  statusHistory: readonly JudicialStatusEvent[];
  /** Review lane label, e.g. «بررسی لیگالیر». */
  reviewKindFa: string;
  reviewOfficeFa: string;
  reviewerInitials: string | null;
  /** True only when a bound admin approval authorises this artifact. */
  approved: boolean;
}

export interface JudicialPdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

const REVIEW_EVENT_KIND_FA: Record<JudicialReviewEventKind, string> = {
  submitted: "ارسال برای بررسی",
  assigned: "ارجاع به کارشناس",
  note: "یادداشت",
  change_request: "درخواست اصلاح",
  approval_note: "یادداشت تأیید",
  revision: "نسخهٔ اصلاح‌شده",
  user_reply: "پاسخ کاربر",
  resubmitted: "ارسال مجدد",
  approved: "تأیید",
  rejected: "رد",
  cancelled: "لغو",
  final_issued: "صدور نسخهٔ نهایی",
  status_changed: "تغییر وضعیت",
};

export function reviewKindFa(kind: JudicialReviewEventKind): string {
  return REVIEW_EVENT_KIND_FA[kind];
}

const SERVICE_TITLE_FA: Record<JudicialServiceId, string> = {
  judicial_statement: "تنظیم اظهارنامه قضایی",
  judicial_brief: "تنظیم لایحه",
  judicial_petition: "تنظیم دادخواست حقوقی",
  judicial_complaint: "تنظیم شکواییه کیفری",
  judicial_criminal_record: "گواهی عدم سوءپیشینه",
  judicial_credit_check: "استعلام اعتبار معاملاتی",
};

export function serviceTitleFa(serviceId: JudicialServiceId): string {
  return SERVICE_TITLE_FA[serviceId];
}

function statusFa(status: JudicialRequestStatus): string {
  return JUDICIAL_REQUEST_STATUS_FA[status] ?? status;
}

/**
 * Render the issued PDF. The content is the approved draft text plus the
 * recorded answers and the owner-visible history; the official mark is
 * drawn only when `approved` is true and the genuine masters are present.
 */
export async function renderJudicialPdf(
  params: JudicialPdfParams
): Promise<JudicialPdfResult> {
  const regularPath = findFontPath("Vazirmatn-Regular.ttf");
  const boldPath = findFontPath("Vazirmatn-Bold.ttf");
  if (!regularPath || !boldPath) {
    throw new Error("VAZIRMATN_MISSING");
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(orientedFontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(fs.readFileSync(regularPath), { subset: true }),
    bold: await doc.embedFont(fs.readFileSync(boldPath), { subset: true }),
  };

  // The OFFICIAL seal: only when approved AND the master is present. A
  // missing master never becomes a drawn substitute — the artifact then
  // carries the unapproved watermark instead.
  let sealImage: PDFImage | null = null;
  let hologramImage: PDFImage | null = null;
  if (params.approved) {
    const asset = loadReviewStamp();
    if (asset) {
      try {
        sealImage = await doc.embedPng(asset.bytes);
      } catch {
        sealImage = null;
      }
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

  let logoImage: PDFImage | null = null;
  const logoBytes = loadDocumentLogo();
  if (logoBytes) {
    try {
      logoImage = await doc.embedPng(logoBytes);
    } catch {
      logoImage = null;
    }
  }

  const layout = new Layout(doc, fonts);
  const versionLabelFa = `نسخهٔ ${toPersianDigits(params.versionNumber)}`;

  layout.letterhead({
    logo: logoImage,
    titleFa: params.titleFa,
    serviceFa: params.serviceFa,
    serialFa: params.serialFa,
    issuedOnFa: formatIsoJalali(params.issuedAt.slice(0, 10)),
    versionLabelFa,
    documentHash: params.documentHash,
  });

  // --- The approved text, verbatim ---
  layout.heading("متن سند", 12);
  layout.paragraph(params.bodyText || "—");

  // --- Recorded answers ---
  if (params.answers.length > 0) {
    layout.heading("اطلاعات ثبت‌شده", 12);
    layout.keyValues(params.answers);
  }

  // --- Owner-visible review history ---
  if (params.reviewEvents.length > 0) {
    layout.heading("سابقهٔ بررسی", 12);
    layout.keyValues(
      [
        { labelFa: "نوع بررسی", valueFa: params.reviewKindFa },
        { labelFa: "واحد بررسی", valueFa: params.reviewOfficeFa },
        ...(params.reviewerInitials
          ? [{ labelFa: "بررسی‌کننده", valueFa: params.reviewerInitials }]
          : []),
      ],
      10
    );
    for (const event of params.reviewEvents) {
      const head = `${reviewKindFa(event.kind)} — ${event.authorLabelFa} — ${formatIsoJalaliDateTime(event.createdAt)}${event.versionNumber ? ` — نسخهٔ ${toPersianDigits(event.versionNumber)}` : ""}`;
      layout.paragraph(head, 9);
      if (event.bodyFa && event.bodyFa.trim() !== "") {
        layout.paragraph(event.bodyFa, 9.5);
      }
    }
    layout.spacer(2);
  }

  // --- Status history ---
  if (params.statusHistory.length > 0) {
    layout.heading("تاریخچهٔ وضعیت", 12);
    for (const event of params.statusHistory) {
      const from = event.fromStatus ? `${statusFa(event.fromStatus)} ← ` : "";
      const line = `${from}${statusFa(event.toStatus)} — ${event.actorLabelFa} — ${formatIsoJalaliDateTime(event.createdAt)}${event.noteFa ? ` — ${event.noteFa}` : ""}`;
      layout.paragraph(line, 9);
    }
    layout.spacer(2);
  }

  // --- Closing integrity block ---
  // No public verification page exists for judicial artifacts, so the sheet
  // states the serial and the content hash it was rendered from instead of
  // printing a QR code that would resolve to nothing.
  layout.integrityBlock([
    `این سند با شمارهٔ ${params.serialFa} و اثر انگشت محتوای زیر صادر شده است:`,
    `SHA-256: ${params.documentHash}`,
    "برای بررسی اصالت، همین شماره و اثر انگشت را به واحد بررسی حقوقی لیگالیر اعلام کنید.",
  ]);

  // --- Repeated identification + the mark on every page ---
  layout.runningHeads(params.serviceFa, params.serialFa, versionLabelFa);
  if (params.approved && sealImage) {
    layout.officialMarkPages(sealImage, hologramImage, CONTRACT_REVIEW_STAMP_DISCLAIMER_FA);
  } else {
    // A caller that asked for an unapproved render still gets an honest
    // sheet — watermarked, never sealed.
    layout.draftWatermark();
  }
  layout.pageNumbers();

  const bytes = await doc.save();
  return { bytes, pageCount: doc.getPageCount() };
}
