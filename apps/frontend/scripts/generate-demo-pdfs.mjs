// ============================================================
// LEGALIR — Demo Document PDF Generator
// ============================================================
// Generates the real, multi-page, RTL Persian PDFs that back the
// "اسناد من" (My Documents) demo dataset. Uses pdf-lib + @pdf-lib/fontkit
// with the Vazirmatn typeface. fontkit applies full Arabic shaping and
// bidi reordering, so we only have to handle right-alignment + wrapping.
//
// Run: node scripts/generate-demo-pdfs.mjs
// Output: public/demo-documents/*.pdf
// ============================================================

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "demo-documents");

const FONT_REGULAR = path.join(
  root,
  "..",
  "..",
  "node_modules",
  "vazirmatn",
  "fonts",
  "ttf",
  "Vazirmatn-Regular.ttf"
);
const FONT_BOLD = path.join(
  root,
  "..",
  "..",
  "node_modules",
  "vazirmatn",
  "fonts",
  "ttf",
  "Vazirmatn-Bold.ttf"
);

// Design tokens (A4 portrait, points)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NAVY = rgb(0.07, 0.13, 0.25);
const GOLD = rgb(0.72, 0.6, 0.36);
const INK = rgb(0.16, 0.18, 0.22);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.89, 0.91);
const DARK = rgb(0.09, 0.1, 0.12);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function width(font, text, size) {
  return font.widthOfTextAtSize(text, size);
}

function wrapLines(font, text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (!cur || width(font, test, size) <= maxWidth) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw a single right-aligned line. Returns the new (lower) y.
function drawLine(page, font, text, size, rightX, y, color) {
  const w = width(font, text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
  return y - size * 1.6;
}

// Draw a wrapped, right-aligned paragraph.
function drawParagraph(page, font, text, size, rightX, y, color, lineHeight) {
  const lh = lineHeight ?? size * 1.7;
  for (const line of wrapLines(font, text, size, CONTENT_W)) {
    y = drawLine(page, font, line, size, rightX, y, color);
  }
  return y;
}

function drawRule(page, y) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: LINE,
  });
  return y;
}

function drawFooter(page, font, index, total) {
  const footerY = 36;
  page.drawText("نمونه آزمایشی — این سند صرفاً برای نمایش قابلیت‌های LEGALIR تولید شده است.", {
    x: MARGIN,
    y: footerY,
    size: 8,
    font,
    color: MUTED,
  });
  const pageNo = `صفحه ${index} از ${total}`;
  const w = width(font, pageNo, 8);
  page.drawText(pageNo, {
    x: PAGE_W - MARGIN - w,
    y: footerY,
    size: 8,
    font,
    color: MUTED,
  });
}

// Draw the brand header for a document's first page.
function drawHeader(page, reg, bold, title, subtitle) {
  let y = PAGE_H - MARGIN;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - 96,
    width: CONTENT_W,
    height: 40,
    color: NAVY,
  });
  page.drawText("LEGALIR", {
    x: PAGE_W - MARGIN - 10 - width(bold, "LEGALIR", 12),
    y: PAGE_H - 92,
    size: 12,
    font: bold,
    color: GOLD,
  });
  page.drawText(title, {
    x: MARGIN + 10,
    y: PAGE_H - 92,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y -= 40;
  y = drawParagraph(page, bold, subtitle, 13, PAGE_W - MARGIN, y - 8, DARK, 22);
  y = drawRule(page, y - 6);
  return y - 10;
}

function newPage(doc, reg, bold, title) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y = drawRule(page, y - 10);
  return { page, y: y - 12 };
}

// Draw a numbered article (ماده) with an optional body paragraph.
function drawArticle(doc, ctx, reg, bold, n, title, body) {
  let { page, y } = ctx;
  if (y < 120) {
    const np = newPage(doc, reg, bold, "ادامه قرارداد");
    page = np.page;
    y = np.y;
  }
  const heading = `ماده ${n} — ${title}`;
  y = drawLine(page, bold, heading, 13, PAGE_W - MARGIN, y, NAVY);
  if (body) y = drawParagraph(page, reg, body, 12, PAGE_W - MARGIN, y - 4, INK, 24);
  y -= 16;
  return { page, y };
}

// Draw a signature block (two columns).
function drawSignatures(doc, ctx, reg, bold, parties) {
  let { page, y } = ctx;
  if (y < 160) {
    const np = newPage(doc, reg, bold, "امضا و مهر طرفین");
    page = np.page;
    y = np.y;
  }
  const colW = CONTENT_W / 2 - 12;
  const leftColX = MARGIN;
  const rightColX = MARGIN + colW + 24;

  y = drawLine(page, bold, "امضا و مهر طرفین", 12, PAGE_W - MARGIN, y, NAVY);
  y -= 6;

  const topY = y;
  for (const p of parties) {
    const x = p.side === "right" ? rightColX : leftColX;
    page.drawRectangle({
      x,
      y: topY - 96,
      width: colW,
      height: 88,
      borderColor: LINE,
      borderWidth: 1,
    });
    let yy = topY - 14;
    for (const [label, value] of p.fields) {
      yy = drawLine(page, reg, `${label}: ${value}`, 8.5, x + colW - 6, yy, INK);
    }
    yy -= 8;
    drawLine(page, reg, "امضا:", 8.5, x + colW - 6, yy, MUTED);
  }
  y = topY - 96 - 20;
  return { page, y };
}

async function buildPdf(outName, build) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fs.readFileSync(FONT_REGULAR));
  const bold = await doc.embedFont(fs.readFileSync(FONT_BOLD));

  const page = doc.addPage([PAGE_W, PAGE_H]);
  await build({ doc, reg, bold, first: page });

  const bytes = await doc.save();
  const total = doc.getPageCount();
  fs.writeFileSync(path.join(outDir, outName), bytes);
  console.log(`✓ ${outName} (${total} pages, ${(bytes.length / 1024).toFixed(1)} KB)`);
}

// ------------------------------------------------------------
// 1) Employment contract — the flagship document
// ------------------------------------------------------------

async function employmentContract() {
  await buildPdf("قرارداد-کار-و-تعهدات-بیمه.pdf", async ({ doc, reg, bold, first }) => {
    let ctx = { page: first, y: 0 };
    ctx.y = drawHeader(
      first,
      reg,
      bold,
      "قرارداد کار و تعهدات بیمه تأمین اجتماعی",
      "این سند یک نمونه آزمایشی است و ارزش حقوقی ندارد."
    );

    const intro =
      "این قرارداد مطابق ماده ۷ قانون کار جمهوری اسلامی ایران و مقررات سازمان تأمین اجتماعی، فی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» به نمایندگی آقای امیر رضایی (کارفرما) و آقای سعید مرادی به شماره ملی ۰۰۷۹۸۵۴۳۲۱ (کارگر/کارمند) منعقد می‌گردد. طرفین با علم و آگاهی کامل، شرایط زیر را می‌پذیرند.";
    ctx.y = drawParagraph(ctx.page, reg, intro, 11, PAGE_W - MARGIN, ctx.y, INK, 20);
    ctx.y -= 10;

    // Parties details block
    const partyRows = [
      ["کارفرما", "شرکت خدمات فنی و مهندسی رهام پارس — به نمایندگی امیر رضایی"],
      ["شناسه ملی", "۱۰۱۰۲۳۴۵۶۷۸"],
      ["نشانی", "تهران، خیابان ولیعصر، بالاتر از میدان ونک، برج رهام، طبقه ششم"],
      ["کارمند", "سعید مرادی"],
      ["شماره ملی کارمند", "۰۰۷۹۸۵۴۳۲۱"],
      ["سمت", "کارشناس ارشد شبکه و زیرساخت"],
    ];
    ctx.y = drawLine(ctx.page, bold, "مشخصات طرفین", 12, PAGE_W - MARGIN, ctx.y, NAVY);
    ctx.y -= 2;
    for (const [k, v] of partyRows) {
      ctx.y = drawLine(ctx.page, reg, `${k}: ${v}`, 10.5, PAGE_W - MARGIN, ctx.y, INK);
    }
    ctx.y = drawRule(ctx.page, ctx.y - 6);
    ctx.y -= 10;

    const articles = [
      ["۱", "موضوع قرارداد", "موضوع این قرارداد، اشتغال کارمند در سمت «کارشناس ارشد شبکه و زیرساخت» در واحد فنی شرکت با شرح وظایف مندرج در پیوست شماره یک می‌باشد. شرح وظایف شامل طراحی، پیاده‌سازی، نگهداری و عیب‌یابی زیرساخت شبکه، سرورها و سامانه‌های امنیتی شرکت است."],
      ["۲", "مدت قرارداد", "مدت قرارداد از تاریخ ۱۴۰۵/۰۳/۰۱ به مدت یک سال شمسی بوده و با توافق کتبی طرفین قابل تمدید است. سه ماه نخست به عنوان دوره آزمایشی محسوب می‌گردد که در صورت عدم تأیید عملکرد کارمند از سوی کارفرما، قرارداد بدون پرداخت خسارت قابل فسخ است."],
      ["۳", "حقوق و مزایا", "حقوق ماهانه کارمند مبلغ ۱۸۵/۰۰۰/۰۰۰ ریال است که حداکثر تا پایان هر ماه شمسی پرداخت می‌گردد. علاوه بر آن، حق اولاد، بن کارگری و سنوات طبق مقررات قانون کار محاسبه و پرداخت می‌شود. هرگونه افزایش حقوق تابع مصوبات شورای عالی کار و توافق طرفین است."],
      ["۴", "بیمه تأمین اجتماعی", "کارفرما مکلف است از تاریخ شروع به کار، کارمند را نزد سازمان تأمین اجتماعی بیمه نموده و حق بیمه سهم کارگر و کارفرما را در مواعد قانونی پرداخت نماید. در صورت قصور کارفرما در پرداخت حق بیمه، مسئولیت کلیه عواقب قانونی و جبران خسارات بر عهده وی خواهد بود."],
      ["۵", "ساعات کار", "ساعات کار هفتگی ۴۴ ساعت مطابق ماده ۵۱ قانون کار است. اضافه‌کاری با توافق قبلی و پرداخت فوق‌العاده اضافه‌کار مطابق مقررات انجام می‌شود. تعطیل رسمی هفتگی روز جمعه و ساعات کاری اداری از شنبه تا چهارشنبه از ساعت ۸ تا ۱۶ تعیین می‌گردد."],
      ["۶", "مرخصی‌ها", "کارمند از کلیه مرخصی‌های قانونی از جمله مرخصی استحقاقی سالانه، استعلاجی و مرخصی زایمان مطابق قانون کار بهره‌مند می‌گردد. مرخصی استحقاقی سالانه سی روز کاری است و ذخیره آن حداکثر تا ۹ روز در سال مجاز می‌باشد."],
      ["۷", "محل انجام کار", "محل انجام کار، دفتر مرکزی شرکت واقع در تهران، خیابان ولیعصر، بالاتر از میدان ونک، برج رهام، طبقه ششم می‌باشد. در صورت نیاز و بنا به تشخیص کارفرما، کارمند ممکن است به سایر شعب یا سایت‌های پروژه اعزام گردد."],
      ["۸", "اسرار و محرمانگی", "کارمند موظف است اطلاعات فنی، تجاری و مشتریان شرکت را محرمانه تلقی کرده و در طول مدت قرارداد و پس از آن از افشای آنها خودداری نماید. نقض این تعهد موجب مسئولیت مدنی و کیفری کارمند و جبران خسارات وارده خواهد بود."],
      ["۹", "اختراعات و مالکیت معنوی", "کلیه دستاوردها، کدهای نرم‌افزاری و اختراعاتی که در طول دوره همکاری و در ارتباط با فعالیت شرکت حاصل شود، متعلق به شرکت است مگر توافق دیگری صورت گیرد."],
      ["۱۰", "عدم رقابت", "کارمند متعهد می‌شود در طول مدت قرارداد و تا یک سال پس از خاتمه آن، بدون موافقت کتبی کارفرما با شرکت رقیب همکاری ننماید و فعالیتی که منجر به تضییع منافع شرکت شود، انجام ندهد."],
      ["۱۱", "انضباط کاری", "کارمند مکلف به رعایت آیین‌نامه‌های انضباطی و شئونات اداری شرکت می‌باشد. تخلفات انضباطی طبق مقررات قانون کار رسیدگی خواهد شد و در صورت تکرار، مشمول برخوردهای مقرر در ماده ۲۷ قانون کار می‌گردد."],
      ["۱۲", "تعلیق قرارداد", "موارد تعلیق قرارداد کار از قبیل خدمت نظام وظیفه، مرخصی بدون حقوق و بیماری، مطابق مواد ۱۴ تا ۲۰ قانون کار خواهد بود."],
      ["۱۳", "خاتمه قرارداد", "خاتمه قرارداد کار حسب مورد از طریق فسخ، استعفا، بازنشستگی، ازکارافتادگی یا انقضای مدت انجام می‌گیرد و کلیه حقوق و مزایای قانونی تا تاریخ خاتمه پرداخت می‌شود. در صورت استعفا، کارمند مکلف به رعایت مهلت یک‌ماهه قانونی است."],
      ["۱۴", "حل اختلاف", "در صورت بروز اختلاف، ابتدا از طریق مذاکره و در صورت عدم حصول نتیجه، از طریق هیأت‌های تشخیص و حل اختلاف اداره کار وفق قانون رسیدگی می‌گردد."],
      ["۱۵", "نسخ قرارداد", "این قرارداد در دو نسخه که هر دو دارای اعتبار واحد است، تنظیم و به امضای طرفین رسید."],
    ];

    for (const [n, t, b] of articles) {
      ctx = drawArticle(doc, ctx, reg, bold, n, t, b);
    }

    // Appendix: تعهدات بیمه تأمین اجتماعی
    if (ctx.y < 160) {
      const np = newPage(doc, reg, bold, "پیوست — تعهدات بیمه تأمین اجتماعی");
      ctx = { page: np.page, y: np.y };
    }
    ctx.y = drawLine(ctx.page, bold, "پیوست — تعهدات بیمه تأمین اجتماعی", 13, PAGE_W - MARGIN, ctx.y, NAVY);
    ctx.y -= 4;
    const insurance =
      "به موجب ماده ۱۴۸ قانون کار و ماده ۳۹ قانون تأمین اجتماعی، کارفرما مکلف است حداکثر ظرف پانزده روز از تاریخ اشتغال، نسبت به معرفی کارمند به شعبه ذی‌ربط سازمان تأمین اجتماعی اقدام نماید. حق بیمه ماهانه معادل سی درصد دستمزد مشمول بیمه است که هفت درصد آن سهم کارمند، بیست درصد سهم کارفرما و سه درصد سهم دولت می‌باشد. سهم کارمند از محل حقوق ماهانه کسر و همراه سهم کارفرما حداکثر تا پایان ماه بعد به حساب سازمان واریز می‌گردد. کارمند مشمول کلیه حمایت‌های بیمه‌ای از جمله بازنشستگی، ازکارافتادگی، فوت، بیماری و بیکاری خواهد بود.";
    ctx.y = drawParagraph(ctx.page, reg, insurance, 11, PAGE_W - MARGIN, ctx.y, INK, 20);
    ctx.y -= 8;

    ctx.y = drawLine(ctx.page, bold, "پیش‌گفتار", 12, PAGE_W - MARGIN, ctx.y, NAVY);
    const preamble =
      "طرفین این قرارداد با تأیید کامل اهلیت قانونی خود، و با رعایت قوانین و مقررات جاری کشور از جمله قانون کار مصوب ۱۳۶۹ و اصلاحات بعدی آن، قانون تأمین اجتماعی مصوب ۱۳۵۴، قانون مسئولیت مدنی و سایر مقررات مرتبط، نسبت به انعقاد این قرارداد اقدام نموده‌اند. هیچ‌یک از طرفین این قرارداد را تحت اجبار یا اکراه منعقد ننموده و کلیه شروط و مفاد آن مورد قبول طرفین واقع گردیده است.";

    ctx.y = drawParagraph(ctx.page, reg, preamble, 11, PAGE_W - MARGIN, ctx.y - 2, INK, 20);

    // Appendix 2: شرح وظایف تفصیلی
    if (ctx.y < 200) {
      const np = newPage(doc, reg, bold, "پیوست — شرح وظایف تفصیلی");
      ctx = { page: np.page, y: np.y };
    }
    ctx.y = drawLine(ctx.page, bold, "پیوست — شرح وظایف تفصیلی", 13, PAGE_W - MARGIN, ctx.y, NAVY);
    ctx.y -= 4;
    const duties = [
      "طراحی و مستندسازی معماری شبکه داخلی شرکت و سامانه‌های متصل به آن.",
      "نصب، پیکربندی و نگهداری تجهیزات اکتیو شبکه شامل سوئیچ، روتر و فایروال.",
      "پایش مستمر عملکرد شبکه و شناسایی و رفع اشکالات احتمالی در کوتاه‌ترین زمان.",
      "مدیریت امنیت شبکه شامل کنترل دسترسی، تشخیص نفوذ و به‌روزرسانی سیاست‌های امنیتی.",
      "پشتیبان‌گیری دوره‌ای از داده‌ها و تضمین قابلیت بازیابی در شرایط بحرانی.",
      "همکاری با تیم توسعه نرم‌افزار در استقرار و نگهداری سرویس‌های آنلاین.",
      "تهیه گزارش‌های فنی ماهانه و ارائه به مدیرعامل یا سرپرست مستقیم.",
      "آموزش کاربران داخلی در استفاده صحیح از زیرساخت‌ها و ابزارهای ارتباطی.",
    ];
    duties.forEach((d, i) => {
      if (ctx.y < 90) {
        const np = newPage(doc, reg, bold, "پیوست — شرح وظایف تفصیلی");
        ctx = { page: np.page, y: np.y };
      }
      ctx.y = drawLine(ctx.page, reg, `${i + 1}. ${d}`, 11, PAGE_W - MARGIN, ctx.y, INK);
      ctx.y -= 6;
    });
    ctx.y -= 10;

    // Appendix 3: قوانین حاکم
    if (ctx.y < 120) {
      const np = newPage(doc, reg, bold, "قوانین حاکم");
      ctx = { page: np.page, y: np.y };
    }
    ctx.y = drawLine(ctx.page, bold, "قوانین حاکم", 13, PAGE_W - MARGIN, ctx.y, NAVY);
    ctx.y -= 4;
    const laws =
      "این قرارداد تابع قوانین جمهوری اسلامی ایران است. در مواردی که در این قرارداد پیش‌بینی نشده باشد، به ترتیب قانون کار مصوب ۱۳۶۹، قانون تأمین اجتماعی مصوب ۱۳۵۴، قانون مدنی و سایر قوانین و مقررات مرتبط مراجعه خواهد شد. ارجاع به مواد قانونی در این قرارداد صرفاً جهت اطلاع است و خللی به اعتبار سایر مقررات وارد نمی‌سازد.";
    ctx.y = drawParagraph(ctx.page, reg, laws, 11, PAGE_W - MARGIN, ctx.y, INK, 20);

    ctx = drawSignatures(doc, ctx, reg, bold, [
      { side: "right", fields: [["کارفرما", "امیر رضایی"], ["سمت", "مدیرعامل شرکت رهام پارس"], ["تاریخ", "۱۴۰۵/۰۳/۰۱"]] },
      { side: "left", fields: [["کارمند", "سعید مرادی"], ["کد ملی", "۰۰۷۹۸۵۴۳۲۱"], ["تاریخ", "۱۴۰۵/۰۳/۰۱"]] },
    ]);

    const pages = doc.getPages();
    pages.forEach((p, i) => drawFooter(p, reg, i + 1, pages.length));
  });
}

// ------------------------------------------------------------
// 2) NDA (توافقنامه محرمانگی)
// ------------------------------------------------------------

async function ndaContract() {
  await buildPdf("توافقنامه-محرمانگی-NDA.pdf", async ({ doc, reg, bold, first }) => {
    let ctx = { page: first, y: 0 };
    ctx.y = drawHeader(first, reg, bold, "توافقنامه عدم افشای اطلاعات (NDA)", "نمونه آزمایشی — بدون ارزش حقوقی");

    const intro =
      "این توافقنامه فی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» (افشاکننده) و «شرکت توسعه نرم‌افزار آریا» (گیرنده) به منظور حفظ محرمانگی اطلاعات مبادله‌شده در جریان پروژه مشترک منعقد می‌گردد.";
    ctx.y = drawParagraph(ctx.page, reg, intro, 10, PAGE_W - MARGIN, ctx.y, INK, 17);
    ctx.y -= 8;

    const articles = [
      ["۱", "تعریف اطلاعات محرمانه", "شامل کلیه اطلاعات فنی، تجاری، مالی، کدهای منبع، مستندات، نقشه‌ها و داده‌های مشتریان است که به صورت کتبی، شفاهی یا الکترونیکی میان طرفین مبادله شود."],
      ["۲", "تعهدات گیرنده", "گیرنده متعهد است اطلاعات محرمانه را صرفاً در راستای موضوع پروژه استفاده کرده و از افشای آن به اشخاص ثالث خودداری نماید."],
      ["۳", "مدت اعتبار", "این توافقنامه از تاریخ امضا به مدت سه سال معتبر بوده و تعهد محرمانگی نسبت به اسرار تجاری حتی پس از انقضای مدت نیز ادامه دارد."],
      ["۴", "استثنائات", "اطلاعاتی که پیش از افشا نزد عموم شناخته‌شده بوده یا مستقلاً توسط گیرنده تولید شده باشد، مشمول تعهد محرمانگی نخواهد بود."],
      ["۵", "بازگشت اطلاعات", "پس از خاتمه همکاری، گیرنده مکلف است کلیه اسناد و داده‌های محرمانه را مسترد نموده و نسخه‌های الکترونیکی را حذف نماید."],
      ["۶", "جبران خسارت", "در صورت نقض این توافقنامه، طرف خاطی مسئول جبران کلیه خسارات وارده خواهد بود."],
      ["۷", "حل اختلاف", "اختلافات ناشی از این توافقنامه از طریق داوری و در صورت عدم حصول نتیجه در دادگاه صالح رسیدگی می‌گردد."],
    ];

    for (const [n, t, b] of articles) {
      ctx = drawArticle(doc, ctx, reg, bold, n, t, b);
    }

    ctx = drawSignatures(doc, ctx, reg, bold, [
      { side: "right", fields: [["افشاکننده", "امیر رضایی"], ["شرکت", "رهام پارس"], ["تاریخ", "۱۴۰۵/۰۴/۱۵"]] },
      { side: "left", fields: [["گیرنده", "مهدی کریمی"], ["شرکت", "توسعه نرم‌افزار آریا"], ["تاریخ", "۱۴۰۵/۰۴/۱۵"]] },
    ]);

    const pages = doc.getPages();
    pages.forEach((p, i) => drawFooter(p, reg, i + 1, pages.length));
  });
}

// ------------------------------------------------------------
// 3) Contracting (قرارداد پیمانکاری خدمات فنی)
// ------------------------------------------------------------

async function contractingContract() {
  await buildPdf("قرارداد-پیمانکاری-خدمات-فنی.pdf", async ({ doc, reg, bold, first }) => {
    let ctx = { page: first, y: 0 };
    ctx.y = drawHeader(first, reg, bold, "قرارداد پیمانکاری خدمات فنی و پشتیبانی شبکه", "نمونه آزمایشی — بدون ارزش حقوقی");

    const intro =
      "این قرارداد فی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» به نمایندگی آقای امیر رضایی (کارفرما) و «شرکت پشتیبانی شبکه داده‌گستر» به نمایندگی آقای بهنام صادقی (پیمانکار) به منظور ارائه خدمات نگهداری، پشتیبانی و ارتقای زیرساخت شبکه منعقد می‌گردد.";
    ctx.y = drawParagraph(ctx.page, reg, intro, 10, PAGE_W - MARGIN, ctx.y, INK, 17);
    ctx.y -= 8;

    const articles = [
      ["۱", "موضوع قرارداد", "ارائه خدمات پشتیبانی، نگهداری پیشگیرانه و رفع اشکال زیرساخت شبکه، سرورها و تجهیزات اکتیو شرکت کارفرما در محل‌های تعیین‌شده."],
      ["۲", "مدت قرارداد", "این قرارداد از تاریخ ۱۴۰۵/۰۲/۰۱ به مدت یک سال منعقد و در صورت رضایت طرفین قابل تمدید است."],
      ["۳", "مبلغ قرارداد", "مبلغ کل قرارداد ۲/۴۰۰/۰۰۰/۰۰۰ ریال است که در قالب اقساط ماهانه مساوی پرداخت می‌گردد."],
      ["۴", "سطح خدمات", "زمان پاسخگویی به خرابی‌های بحرانی حداکثر ۴ ساعت کاری و زمان رفع حداکثر ۲۴ ساعت کاری تعیین می‌گردد."],
      ["۵", "تعهدات پیمانکار", "پیمانکار مکلف به ارائه گزارش ماهانه، رعایت استانداردهای امنیتی و تأمین نیروی متخصص در طول مدت قرارداد می‌باشد."],
      ["۶", "تعهدات کارفرما", "کارفرما مکلف به فراهم نمودن دسترسی فیزیکی، تأمین برق و شرایط محیطی مناسب و پرداخت به‌موقع اقساط می‌باشد."],
      ["۷", "خسارت و جریمه", "در صورت تأخیر پیمانکار در رفع اشکالات بحرانی، به ازای هر روز تأخیر، یک‌دهم درصد از مبلغ قرارداد به عنوان جریمه کسر می‌گردد."],
      ["۸", "حل اختلاف", "اختلافات ابتدا از طریق مذاکره و در صورت عدم حصول نتیجه از طریق داوری و سپس دادگاه صالح رسیدگی می‌شود."],
    ];

    for (const [n, t, b] of articles) {
      ctx = drawArticle(doc, ctx, reg, bold, n, t, b);
    }

    ctx = drawSignatures(doc, ctx, reg, bold, [
      { side: "right", fields: [["کارفرما", "امیر رضایی"], ["شرکت", "رهام پارس"], ["تاریخ", "۱۴۰۵/۰۲/۰۱"]] },
      { side: "left", fields: [["پیمانکار", "بهنام صادقی"], ["شرکت", "داده‌گستر"], ["تاریخ", "۱۴۰۵/۰۲/۰۱"]] },
    ]);

    const pages = doc.getPages();
    pages.forEach((p, i) => drawFooter(p, reg, i + 1, pages.length));
  });
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  await employmentContract();
  await ndaContract();
  await contractingContract();
  console.log("Demo PDFs generated in", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
